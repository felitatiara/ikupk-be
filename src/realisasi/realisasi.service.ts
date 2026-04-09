import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { Realisasi } from './realisasi.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Target } from '../target/target.entity';

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(Disposisi)
    private readonly disposisiRepository: Repository<Disposisi>,
    @InjectRepository(Target)
    private readonly targetRepository: Repository<Target>,
  ) {}

  async findAll(): Promise<Realisasi[]> {
    return this.realisasiRepository.find({
      relations: ['target', 'target.indikator', 'creator'],
    });
  }

  async getForValidasi(): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      relations: ['target', 'target.indikator'],
    });

    return list.map((r) => {
      const indikator = (r.target as any)?.indikator;
      const jenis = indikator?.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      return {
        id: r.id,
        targetId: r.targetId,
        tahun: (r.target as any)?.tahun || r.tahun || '',
        target: jenis,
        sasaranStrategis: indikator?.nama || '',
        realisasiAngka: Number(r.realisasiAngka),
        status: r.status,
        createdAt: r.createdAt,
      };
    });
  }

  async updateStatus(id: number, status: string): Promise<Realisasi> {
    await this.realisasiRepository.update(id, { status });
    return this.realisasiRepository.findOneOrFail({ where: { id } });
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }

  /**
   * Submit realisasi from file repository.
   * Upserts the user's realisasi for this indikator+unit+tahun+periode,
   * then aggregates all disposisi users' realisasi to compute the total.
   */
  async submitFromFile(data: {
    indikatorId: number;
    unitId: number;
    tahun: string;
    periode: string;
    fileCount: number;
    userId: number;
  }): Promise<{
    userRealisasi: Realisasi;
    totalRealisasi: number;
    targetFakultas: number | null;
    targetUniversitas: number | null;
    disposisiUsers: { userId: number; nama: string; jumlah: number; realisasi: number }[];
  }> {
    const { indikatorId, unitId, tahun, periode, fileCount, userId } = data;

    // Upsert: find existing realisasi for this user+indikator+unit+tahun+periode
    let existing = await this.realisasiRepository.findOne({
      where: { indikatorId, unitId, tahun, periode, createdBy: userId },
    });

    if (existing) {
      existing.realisasiAngka = fileCount;
      existing = await this.realisasiRepository.save(existing);
    } else {
      existing = await this.realisasiRepository.save(
        this.realisasiRepository.create({
          indikatorId,
          unitId,
          tahun,
          periode,
          realisasiAngka: fileCount,
          createdBy: userId,
          status: 'pending',
        }),
      );
    }

    // Get the target for this indikator+unit+tahun
    const target = await this.targetRepository.findOne({
      where: { indikatorId, unitId, tahun },
    });

    // Get all disposisi users for this indikator+unit+tahun (admin-level, disposedBy=null)
    const disposisiList = await this.disposisiRepository.find({
      where: { indikatorId, unitId, tahun, disposedBy: IsNull() },
      relations: ['assignedUser'],
    });

    // For each disposisi user, find their realisasi for this periode
    const disposisiUsers: { userId: number; nama: string; jumlah: number; realisasi: number }[] = [];
    let totalRealisasi = 0;

    for (const d of disposisiList) {
      const userRealisasi = await this.realisasiRepository.findOne({
        where: { indikatorId, unitId, tahun, periode, createdBy: d.assignedTo },
      });
      const realisasiAngka = userRealisasi ? Number(userRealisasi.realisasiAngka) : 0;
      totalRealisasi += realisasiAngka;
      disposisiUsers.push({
        userId: d.assignedTo,
        nama: d.assignedUser?.nama || `User ${d.assignedTo}`,
        jumlah: Number(d.jumlah),
        realisasi: realisasiAngka,
      });
    }

    return {
      userRealisasi: existing,
      totalRealisasi,
      targetFakultas: target ? Number(target.targetFakultas) : null,
      targetUniversitas: target ? Number(target.targetUniversitas) : null,
      disposisiUsers,
    };
  }
}
