import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Realisasi } from './realisasi.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { TargetUnit } from '../target/target-unit.entity';

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(Disposisi)
    private readonly disposisiRepository: Repository<Disposisi>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepository: Repository<TargetUnit>,
  ) {}

  async findAll(): Promise<Realisasi[]> {
    return this.realisasiRepository.find({
      relations: ['indikator', 'disposisi', 'creator'],
    });
  }

  async getForValidasi(): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      relations: ['indikator'],
    });
    return list.map((r) => ({
      id: r.id,
      tahun: r.tahun || '',
      target: r.indikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja',
      sasaranStrategis: r.indikator?.nama || '',
      realisasiAngka: Number(r.realisasiAngka),
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  async updateStatus(id: number, status: string): Promise<Realisasi> {
    await this.realisasiRepository.update(id, { status });
    return this.realisasiRepository.findOneOrFail({ where: { id } });
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }

  async submitFromFile(data: {
    indikatorId: number;
    roleId: number;
    tahun: string;
    periode: string;
    fileCount: number;
    userId: number;
  }): Promise<{
    userRealisasi: Realisasi;
    totalRealisasi: number;
    nilaiTarget: number | null;
    disposisiUsers: { userId: number; nama: string; jumlahTarget: number; realisasi: number }[];
  }> {
    const { indikatorId, roleId, tahun, periode, fileCount, userId } = data;

    // Upsert realisasi user ini
    let existing = await this.realisasiRepository.findOne({
      where: { indikatorId, roleId, tahun, periode, createdBy: userId },
    });
    if (existing) {
      existing.realisasiAngka = fileCount;
      existing = await this.realisasiRepository.save(existing);
    } else {
      existing = await this.realisasiRepository.save(
        this.realisasiRepository.create({
          indikatorId,
          roleId,
          tahun,
          periode,
          realisasiAngka: fileCount,
          createdBy: userId,
          status: 'pending',
        }),
      );
    }

    const targetUnit = await this.targetUnitRepository.findOne({ where: { indikatorId, roleId, tahun } });
    const disposisiList = await this.disposisiRepository.find({
      where: { indikatorId, toUserId: userId, tahun },
      relations: ['toUser'],
    });

    const disposisiUsers: { userId: number; nama: string; jumlahTarget: number; realisasi: number }[] = [];
    let totalRealisasi = 0;
    for (const d of disposisiList) {
      const userRealisasi = await this.realisasiRepository.findOne({
        where: { indikatorId, tahun, periode, createdBy: d.toUserId },
      });
      const realisasiAngka = userRealisasi ? Number(userRealisasi.realisasiAngka) : 0;
      totalRealisasi += realisasiAngka;
      disposisiUsers.push({
        userId: d.toUserId,
        nama: d.toUser?.nama || `User ${d.toUserId}`,
        jumlahTarget: Number(d.jumlahTarget),
        realisasi: realisasiAngka,
      });
    }

    return {
      userRealisasi: existing,
      totalRealisasi,
      nilaiTarget: targetUnit ? Number(targetUnit.nilaiTarget) : null,
      disposisiUsers,
    };
  }
}
