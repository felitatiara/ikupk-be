import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Realisasi } from './realisasi.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { UserRelation } from '../users/user_relation.entity';
import { Indikator } from '../indikator/indikator.entity';

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(Disposisi)
    private readonly disposisiRepository: Repository<Disposisi>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepository: Repository<TargetUnit>,
    @InjectRepository(UserRelation)
    private readonly userRelationRepository: Repository<UserRelation>,
    @InjectRepository(Indikator)
    private readonly indikatorRepository: Repository<Indikator>,
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

  /** Semua submission realisasi oleh dosen untuk indikator + tahun tertentu (dipakai atasan untuk validasi) */
  async getSubmissions(indikatorId: number, tahun: string): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      where: { indikatorId, tahun },
      relations: ['creator'],
      order: { createdAt: 'ASC' },
    });
    return list.map((r) => ({
      id: r.id,
      dosenId: r.createdBy,
      dosenNama: r.creator?.nama || `User ${r.createdBy}`,
      dosenEmail: (r.creator as any)?.email || '',
      fileCount: Number(r.realisasiAngka),
      validFileCount: r.validFileCount ?? null,
      status: r.status,
      tahun: r.tahun,
      periode: r.periode,
    }));
  }

  /** Semua submission realisasi dari bawahan langsung seorang atasan, dikelompokkan per indikator */
  async getSubmissionsForAtasan(atasanId: number, tahun: string): Promise<any[]> {
    // Cari bawahan dari UserRelation, fallback ke disposisi jika belum dikonfigurasi
    const relations = await this.userRelationRepository.find({
      where: { parentId: atasanId },
      relations: ['user'],
    });

    let bawahanIds: number[] = relations.map((r) => r.userId);

    if (bawahanIds.length === 0) {
      // Fallback: siapapun yang menerima disposisi dari atasan ini untuk tahun ini
      const disposisiRecords = await this.disposisiRepository.find({
        where: { fromUserId: atasanId, tahun },
      });
      bawahanIds = [...new Set(disposisiRecords.map(d => d.toUserId).filter(Boolean))];
    }

    // Jangan tampilkan submission dari atasan sendiri (mencegah self-validasi)
    bawahanIds = bawahanIds.filter(id => id !== atasanId);

    if (bawahanIds.length === 0) return [];

    // Ambil semua realisasi dari bawahan untuk tahun tertentu
    const realisasiList = await this.realisasiRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.indikator', 'indikator')
      .where('r.created_by IN (:...ids)', { ids: bawahanIds })
      .andWhere('r.tahun = :tahun', { tahun })
      .orderBy('indikator.kode', 'ASC')
      .addOrderBy('creator.nama', 'ASC')
      .getMany();

    // Fetch disposisi targets for all dosen-indikator pairs in one query
    const allDosenIds = [...new Set(realisasiList.map(r => r.createdBy).filter(Boolean))];
    const disposisiList = allDosenIds.length > 0
      ? await this.disposisiRepository.find({ where: { toUserId: In(allDosenIds), tahun } })
      : [];
    const disposisiMap = new Map<string, number>();
    for (const d of disposisiList) {
      disposisiMap.set(`${d.toUserId}:${d.indikatorId}`, Number(d.jumlahTarget));
    }

    // Kelompokkan per indikator
    const byIndikator = new Map<number, { indikator: any; submissions: any[] }>();
    for (const r of realisasiList) {
      const indId = r.indikatorId;
      if (!byIndikator.has(indId)) {
        byIndikator.set(indId, {
          indikator: {
            id: r.indikator?.id ?? indId,
            kode: r.indikator?.kode ?? '',
            nama: r.indikator?.nama ?? '',
            jenis: r.indikator?.jenis ?? '',
            level: r.indikator?.level ?? 0,
          },
          submissions: [],
        });
      }
      byIndikator.get(indId)!.submissions.push({
        id: r.id,
        dosenId: r.createdBy,
        dosenNama: r.creator?.nama ?? `User ${r.createdBy}`,
        dosenEmail: (r.creator as any)?.email ?? '',
        fileCount: Number(r.realisasiAngka),
        validFileCount: r.validFileCount ?? null,
        targetDosen: disposisiMap.get(`${r.createdBy}:${r.indikatorId}`) ?? null,
        status: r.status,
        tahun: r.tahun,
        periode: r.periode,
      });
    }

    return Array.from(byIndikator.values());
  }

  /** SKP summary per-bawahan untuk ditampilkan di halaman SKP atasan */
  async getSkpBawahan(atasanId: number, tahun: string): Promise<any[]> {
    const relations = await this.userRelationRepository.find({
      where: { parentId: atasanId },
      relations: ['user'],
    });

    // Fallback: bawahan dari disposisi jika UserRelation belum dikonfigurasi
    const bawahanMap = new Map<number, any>();
    for (const rel of relations) {
      bawahanMap.set(rel.userId, rel.user);
    }
    if (bawahanMap.size === 0) {
      const disposisiRecords = await this.disposisiRepository.find({
        where: { fromUserId: atasanId, tahun },
        relations: ['toUser'],
      });
      for (const d of disposisiRecords) {
        if (d.toUser && !bawahanMap.has(d.toUserId)) {
          bawahanMap.set(d.toUserId, d.toUser);
        }
      }
    }

    if (bawahanMap.size === 0) return [];

    const result: any[] = [];
    for (const [, bawahan] of bawahanMap) {
      const realisasiList = await this.realisasiRepository.find({
        where: { createdBy: bawahan.id, tahun },
        relations: ['indikator'],
      });

      const totalIndikator = new Set(realisasiList.map(r => r.indikatorId)).size;
      const validatedCount = realisasiList.filter(r => r.validFileCount !== null).length;

      const capaianArr = realisasiList
        .filter(r => r.validFileCount !== null)
        .map(r => {
          const disp = realisasiList.find(x => x.id === r.id);
          return disp ? Math.min((Number(r.validFileCount) / Math.max(Number(r.realisasiAngka), 1)) * 100, 100) : 0;
        });
      const avgCapaian = capaianArr.length > 0
        ? Number((capaianArr.reduce((a, b) => a + b, 0) / capaianArr.length).toFixed(1))
        : null;

      const statuses = realisasiList.map(r => r.status);
      const skpStatus = statuses.every(s => s === 'approved')
        ? 'approved'
        : statuses.some(s => s === 'rejected')
        ? 'rejected'
        : 'pending';

      result.push({
        userId: bawahan.id,
        nama: (bawahan as any).nama ?? bawahan.id,
        email: (bawahan as any).email ?? '',
        totalIndikator,
        validatedCount,
        avgCapaian,
        skpStatus,
        realisasi: realisasiList.map(r => ({
          id: r.id,
          indikatorId: r.indikatorId,
          kodeIndikator: r.indikator?.kode ?? '',
          namaIndikator: r.indikator?.nama ?? '',
          realisasiAngka: Number(r.realisasiAngka),
          validFileCount: r.validFileCount,
          status: r.status,
          tahun: r.tahun,
          periode: r.periode,
        })),
      });
    }
    return result;
  }

  /** Approve atau reject semua realisasi seorang bawahan untuk tahun tertentu */
  async approveBawahanSkp(bawahanId: number, action: 'approved' | 'rejected', tahun: string): Promise<void> {
    await this.realisasiRepository.update({ createdBy: bawahanId, tahun }, { status: action });
  }

  /** Status SKP milik sendiri: status aggregate + daftar realisasi + info atasan */
  async getMySkpStatus(userId: number, tahun: string): Promise<{
    status: 'approved' | 'rejected' | 'pending';
    realisasi: any[];
    atasan: { nama: string; nip: string | null } | null;
  }> {
    const realisasiList = await this.realisasiRepository.find({
      where: { createdBy: userId, tahun },
      relations: ['indikator'],
    });

    if (realisasiList.length === 0) {
      return { status: 'pending', realisasi: [], atasan: null };
    }

    const statuses = realisasiList.map((r) => r.status);
    const status: 'approved' | 'rejected' | 'pending' = statuses.every((s) => s === 'approved')
      ? 'approved'
      : statuses.some((s) => s === 'rejected')
      ? 'rejected'
      : 'pending';

    const relation = await this.userRelationRepository.findOne({
      where: { userId },
      relations: ['parent'],
    });

    return {
      status,
      realisasi: realisasiList.map((r) => ({
        id: r.id,
        indikatorId: r.indikatorId,
        kodeIndikator: r.indikator?.kode ?? '',
        namaIndikator: r.indikator?.nama ?? '',
        realisasiAngka: Number(r.realisasiAngka),
        validFileCount: r.validFileCount,
        status: r.status,
      })),
      atasan: relation?.parent
        ? { nama: relation.parent.nama, nip: relation.parent.nip ?? null }
        : null,
    };
  }

  /** Atasan memvalidasi submission: menetapkan berapa file yang valid */
  async validateSubmission(id: number, validFileCount: number): Promise<Realisasi> {
    await this.realisasiRepository.update(id, { validFileCount });
    return this.realisasiRepository.findOneOrFail({ where: { id } });
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }

  async submitFromFile(data: {
    indikatorId: number;
    roleId: number | null;
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
    // Gunakan IsNull() untuk kolom nullable agar TypeORM menghasilkan WHERE role_id IS NULL
    const roleIdWhere = roleId !== null ? roleId : IsNull();
    let existing = await this.realisasiRepository.findOne({
      where: { indikatorId, roleId: roleIdWhere as any, tahun, periode, createdBy: userId },
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

    // TargetUnit.roleId adalah non-nullable; skip jika roleId null
    const targetUnit = roleId !== null
      ? await this.targetUnitRepository.findOne({ where: { indikatorId, roleId, tahun } })
      : null;
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
