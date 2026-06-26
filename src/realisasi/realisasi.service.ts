import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';
import { Realisasi } from './realisasi.entity';
import { RealisasiFile } from './realisasi-file.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { UserRelation } from '../users/user_relation.entity';
import { Indikator } from '../indikator/indikator.entity';
import { UserRole } from '../roles/user-role.entity';

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(RealisasiFile)
    private readonly realisasiFileRepository: Repository<RealisasiFile>,
    @InjectRepository(Disposisi)
    private readonly disposisiRepository: Repository<Disposisi>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepository: Repository<TargetUnit>,
    @InjectRepository(UserRelation)
    private readonly userRelationRepository: Repository<UserRelation>,
    @InjectRepository(Indikator)
    private readonly indikatorRepository: Repository<Indikator>,
    @InjectRepository(UserRole)
    private readonly userRoleRepository: Repository<UserRole>,
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
      target: r.indikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kinerja',
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
    // Ambil disposisi yang dikirim OLEH atasan ini
    const myDisposisi = await this.disposisiRepository.find({
      where: { fromUserId: atasanId, tahun },
    });

    // Bangun set pasangan (toUserId, indikatorId) yang boleh divalidasi atasan ini
    const allowedKeys = new Set<string>();
    const allowedMap = new Map<number, Set<number>>();
    for (const d of myDisposisi) {
      if (!d.toUserId || !d.indikatorId) continue;
      allowedKeys.add(`${d.toUserId}:${d.indikatorId}`);
      if (!allowedMap.has(d.toUserId)) allowedMap.set(d.toUserId, new Set());
      allowedMap.get(d.toUserId)!.add(d.indikatorId);
    }

    let bawahanIds: number[] = [...allowedMap.keys()].filter(id => id !== atasanId);
    let useAllowedFilter = true;

    if (bawahanIds.length === 0) {
      // Fallback: UserRelation (struktur org) jika belum ada disposisi
      const relations = await this.userRelationRepository.find({
        where: { parentId: atasanId },
        relations: ['user'],
      });
      bawahanIds = relations.map((r) => r.userId).filter(id => id !== atasanId);
      useAllowedFilter = false;
    }

    if (bawahanIds.length === 0) return [];

    const realisasiListRaw = await this.realisasiRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.indikator', 'indikator')
      .where('r.created_by IN (:...ids)', { ids: bawahanIds })
      .andWhere('r.tahun = :tahun', { tahun })
      .orderBy('indikator.kode', 'ASC')
      .addOrderBy('creator.nama', 'ASC')
      .getMany();

    // Hanya tampilkan submission untuk (bawahan, indikator) yang DIDISPOSISIKAN oleh atasan ini
    const realisasiList = useAllowedFilter
      ? realisasiListRaw.filter(r => allowedKeys.has(`${r.createdBy}:${r.indikatorId}`))
      : realisasiListRaw;

    // Target: hanya dari disposisi atasan ini ke bawahan ini
    const allDosenIds = [...new Set(realisasiList.map(r => r.createdBy).filter(Boolean))];
    const disposisiList = allDosenIds.length > 0
      ? await this.disposisiRepository.find({
          where: { fromUserId: atasanId, toUserId: In(allDosenIds), tahun },
        })
      : [];
    const disposisiMap = new Map<string, number>();
    for (const d of disposisiList) {
      disposisiMap.set(`${d.toUserId}:${d.indikatorId}`, Number(d.jumlahTarget));
    }

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

  /** SKP summary per-bawahan untuk ditampilkan di halaman SKP atasan.
   *  forDekan=true → semua user (dari seluruh hirarki) yang sudah submit realisasi. */
  async getSkpBawahan(atasanId: number, tahun: string, forDekan = false): Promise<any[]> {
    const bawahanMap = new Map<number, any>();

    if (forDekan) {
      // Dekan: tampilkan user yang punya realisasi validated_wd2, approved, atau rejected
      const allRealisasi = await this.realisasiRepository
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.creator', 'creator')
        .where('r.tahun = :tahun', { tahun })
        .andWhere('r.created_by != :atasanId', { atasanId })
        .andWhere('r.status IN (:...statuses)', { statuses: ['validated_wd2', 'approved', 'rejected'] })
        .getMany();
      for (const r of allRealisasi) {
        if (r.creator && !bawahanMap.has(r.createdBy)) {
          bawahanMap.set(r.createdBy, r.creator);
        }
      }
    } else {
      // Prioritaskan disposisi (rantai tugas nyata)
      const disposisiRecords = await this.disposisiRepository.find({
        where: { fromUserId: atasanId, tahun },
        relations: ['toUser'],
      });
      for (const d of disposisiRecords) {
        if (d.toUser && !bawahanMap.has(d.toUserId)) {
          bawahanMap.set(d.toUserId, d.toUser);
        }
      }
      // Fallback: UserRelation (struktur org) jika belum ada disposisi
      if (bawahanMap.size === 0) {
        const relations = await this.userRelationRepository.find({
          where: { parentId: atasanId },
          relations: ['user'],
        });
        for (const rel of relations) {
          bawahanMap.set(rel.userId, rel.user);
        }
      }
      // Cegah self-entry
      bawahanMap.delete(atasanId);
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
        : statuses.every(s => s === 'validated_wd2' || s === 'approved')
        ? 'validated_wd2'
        : statuses.every(s => s === 'validated_atasan' || s === 'validated_wd2' || s === 'approved')
        ? 'validated_atasan'
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

  /** Dekan: approve atau reject semua realisasi validated_wd2 milik seorang bawahan */
  async approveBawahanSkp(bawahanId: number, action: 'approved' | 'rejected', tahun: string): Promise<void> {
    await this.realisasiRepository.update(
      { createdBy: bawahanId, tahun, status: 'validated_wd2' },
      { status: action },
    );
  }

  /** Status SKP milik sendiri: status aggregate + daftar realisasi + info atasan */
  async getMySkpStatus(userId: number, tahun: string): Promise<{
    status: 'approved' | 'rejected' | 'pending';
    realisasi: any[];
    atasan: { nama: string; nip: string | null } | null;
    atasanPenilai: { nama: string; nip: string | null } | null;
  }> {
    const realisasiList = await this.realisasiRepository.find({
      where: { createdBy: userId, tahun },
      relations: ['indikator'],
    });

    if (realisasiList.length === 0) {
      return { status: 'pending', realisasi: [], atasan: null, atasanPenilai: null };
    }

    const statuses = realisasiList.map((r) => r.status);
    const status: 'approved' | 'rejected' | 'pending' = statuses.every((s) => s === 'approved')
      ? 'approved'
      : statuses.some((s) => s === 'rejected')
      ? 'rejected'
      : 'pending';

    // Cek role user ini
    const myUserRole = await this.userRoleRepository.findOne({
      where: { userId, isPrimary: true },
      relations: ['role'],
    });
    const myRoleName = (myUserRole?.role?.name ?? '').toLowerCase();
    const isWD1 =
      myRoleName.includes('wakil dekan 1') ||
      myRoleName.includes('wd1') ||
      myRoleName.includes('wakil dekan bidang akademik');

    // Cari WD1 (Pejabat Penilai Kinerja) dan Dekan (Atasan Pejabat Penilai Kinerja)
    const wd1Row = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoinAndSelect('ur.user', 'u')
      .innerJoinAndSelect('ur.role', 'r')
      .where('ur.isPrimary = true')
      .andWhere(
        "LOWER(r.name) LIKE :n1 OR LOWER(r.name) LIKE :n2 OR LOWER(r.name) LIKE :n3",
        { n1: '%wakil dekan 1%', n2: '%wd1%', n3: '%wakil dekan bidang akademik%' },
      )
      .getOne();

    const dekanRow = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoinAndSelect('ur.user', 'u')
      .innerJoinAndSelect('ur.role', 'r')
      .where('ur.isPrimary = true')
      .andWhere("LOWER(r.name) = 'dekan'")
      .getOne();

    let penilai: { nama: string; nip: string | null } | null = null;
    let atasanPenilai: { nama: string; nip: string | null } | null = null;

    if (isWD1) {
      // Penilai WD1 adalah Dekan (sebagai Atasan Pejabat Penilai Kinerja)
      penilai = dekanRow?.user
        ? { nama: dekanRow.user.nama, nip: (dekanRow.user as any).nip ?? null }
        : null;
      atasanPenilai = null;
    } else {
      // Pejabat Penilai Kinerja untuk dosen/tendik adalah WD1
      penilai = wd1Row?.user
        ? { nama: wd1Row.user.nama, nip: (wd1Row.user as any).nip ?? null }
        : null;
      // Atasan Pejabat Penilai Kinerja adalah Dekan
      atasanPenilai = dekanRow?.user
        ? { nama: dekanRow.user.nama, nip: (dekanRow.user as any).nip ?? null }
        : null;
    }

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
      atasan: penilai,
      atasanPenilai,
    };
  }

  /** Atasan memvalidasi submission: menetapkan berapa file yang valid + set status validated_atasan */
  async validateSubmission(id: number, validFileCount: number): Promise<Realisasi> {
    await this.realisasiRepository.update(id, { validFileCount, status: 'validated_atasan' });
    return this.realisasiRepository.findOneOrFail({ where: { id } });
  }

  /** WD2: ambil semua user yang punya realisasi dengan status validated_atasan */
  async getSubmissionsForWD2(tahun: string): Promise<any[]> {
    const realisasiList = await this.realisasiRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.creator', 'creator')
      .leftJoinAndSelect('r.indikator', 'indikator')
      .where('r.tahun = :tahun', { tahun })
      .andWhere('r.status = :status', { status: 'validated_atasan' })
      .orderBy('creator.nama', 'ASC')
      .addOrderBy('indikator.kode', 'ASC')
      .getMany();

    const byUser = new Map<number, any>();
    for (const r of realisasiList) {
      if (!byUser.has(r.createdBy)) {
        byUser.set(r.createdBy, {
          userId: r.createdBy,
          nama: r.creator?.nama ?? `User ${r.createdBy}`,
          email: (r.creator as any)?.email ?? '',
          realisasi: [],
        });
      }
      byUser.get(r.createdBy)!.realisasi.push({
        id: r.id,
        indikatorId: r.indikatorId,
        kodeIndikator: r.indikator?.kode ?? '',
        namaIndikator: r.indikator?.nama ?? '',
        realisasiAngka: Number(r.realisasiAngka),
        validFileCount: r.validFileCount,
        status: r.status,
        tahun: r.tahun,
        periode: r.periode,
      });
    }
    return Array.from(byUser.values());
  }

  /** WD2: validasi semua realisasi validated_atasan milik seorang user → validated_wd2 */
  async validateWD2Batch(bawahanId: number, tahun: string): Promise<void> {
    await this.realisasiRepository.update(
      { createdBy: bawahanId, tahun, status: 'validated_atasan' },
      { status: 'validated_wd2' },
    );
  }

  /** Ambil semua submission direct-input milik userId untuk indikator + tahun tertentu */
  async getMyRealisasiDirect(indikatorId: number, tahun: string, userId: number): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      where: { indikatorId, tahun, createdBy: userId },
      order: { createdAt: 'DESC' },
    });
    return list.map(r => ({
      id: r.id,
      realisasiAngka: Number(r.realisasiAngka),
      periode: r.periode,
      keterangan: r.keterangan ?? null,
      status: r.status,
      createdAt: r.createdAt,
    }));
  }

  /** Submit atau upsert realisasi direct-input (sumberData = 'ikupk') */
  async submitDirect(data: {
    indikatorId: number;
    roleId: number | null;
    tahun: string;
    periode: string;
    realisasiAngka: number;
    keterangan?: string;
    userId: number;
  }): Promise<Realisasi> {
    const { indikatorId, roleId, tahun, periode, realisasiAngka, keterangan, userId } = data;
    const roleIdWhere = roleId !== null ? roleId : IsNull();
    let existing = await this.realisasiRepository.findOne({
      where: { indikatorId, roleId: roleIdWhere as any, tahun, periode, createdBy: userId },
    });
    if (existing) {
      existing.realisasiAngka = realisasiAngka;
      existing.keterangan = keterangan ?? null;
      return this.realisasiRepository.save(existing);
    }
    return this.realisasiRepository.save(
      this.realisasiRepository.create({
        indikatorId,
        roleId,
        tahun,
        periode,
        realisasiAngka,
        keterangan: keterangan ?? null,
        createdBy: userId,
        status: 'pending',
      }),
    );
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }

  async saveIkupkFile(data: {
    indikatorId: number;
    tahun: string;
    periode: string;
    fileName: string;
    fileUrl: string;
    createdBy: number;
  }): Promise<RealisasiFile> {
    return this.realisasiFileRepository.save(
      this.realisasiFileRepository.create({
        indikatorId: data.indikatorId,
        tahun: data.tahun,
        periode: data.periode,
        fileName: data.fileName,
        fileUrl: data.fileUrl,
        createdBy: data.createdBy,
        realisasiId: null,
      }),
    );
  }

  async getIkupkFiles(indikatorId: number, tahun: string, userId: number): Promise<any[]> {
    const files = await this.realisasiFileRepository.find({
      where: { indikatorId, tahun, createdBy: userId },
      order: { createdAt: 'DESC' },
    });
    return files.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileUrl: f.fileUrl,
      periode: f.periode,
      createdAt: f.createdAt,
    }));
  }

  async deleteIkupkFile(id: number, userId: number): Promise<void> {
    const file = await this.realisasiFileRepository.findOne({ where: { id, createdBy: userId } });
    if (!file) return;
    const relativePath = file.fileUrl.startsWith('/') ? file.fileUrl.slice(1) : file.fileUrl;
    const fullPath = path.join(process.cwd(), relativePath);
    try {
      if (fs.existsSync(fullPath)) await fs.promises.unlink(fullPath);
    } catch { /* ignore file system errors */ }
    await this.realisasiFileRepository.delete(id);
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
