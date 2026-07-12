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
import { SkpPenilaiConfig } from '../skp-penilai/skp-penilai.entity';
import { VerifikasiEkspektasi } from './verifikasi-ekspektasi.entity';
import { Notification } from '../notifications/notification.entity';

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
    @InjectRepository(SkpPenilaiConfig)
    private readonly skpPenilaiRepo: Repository<SkpPenilaiConfig>,
    @InjectRepository(VerifikasiEkspektasi)
    private readonly verifikasiEkspektasiRepo: Repository<VerifikasiEkspektasi>,
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
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
      catatanRevisi: r.catatanRevisi ?? null,
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

    // Hanya tampilkan submission untuk (bawahan, indikator) yang DIDISPOSISIKAN oleh atasan ini.
    // Exclude record sintetis '_summary' yang dibuat oleh validatePimpinanForBawahan.
    const realisasiList = (useAllowedFilter
      ? realisasiListRaw.filter(r => allowedKeys.has(`${r.createdBy}:${r.indikatorId}`))
      : realisasiListRaw
    ).filter(r => r.periode !== '_summary');

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
        catatanRevisi: r.catatanRevisi ?? null,
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
    atasan: { nama: string; nip: string | null; jabatan: string | null } | null;
    atasanPenilai: { nama: string; nip: string | null; jabatan: string | null } | null;
  }> {
    const realisasiList = await this.realisasiRepository.find({
      where: { createdBy: userId, tahun },
      relations: ['indikator'],
    });

    const statuses = realisasiList.map((r) => r.status);
    const status: 'approved' | 'rejected' | 'pending' = realisasiList.length === 0
      ? 'pending'
      : statuses.every((s) => s === 'approved')
      ? 'approved'
      : statuses.some((s) => s === 'rejected')
      ? 'rejected'
      : 'pending';

    // Cari role dengan prioritas tertinggi yang terdaftar di Master SKP config.
    // Untuk user dual-role (misal Wadek 2 + Dosen), gunakan config Wadek 2 (level lebih rendah),
    // bukan config Dosen. Fallback ke role isPrimary jika tidak ada config ditemukan.
    const allMyUserRoles = await this.userRoleRepository.find({
      where: { userId },
      relations: ['role'],
    });
    allMyUserRoles.sort((a, b) => (a.role?.level ?? 99) - (b.role?.level ?? 99));

    let myRoleId: number | null = null;
    for (const ur of allMyUserRoles) {
      const cfgExists = await this.skpPenilaiRepo.findOne({ where: { roleId: ur.roleId } });
      if (cfgExists) { myRoleId = ur.roleId; break; }
    }
    if (!myRoleId) {
      myRoleId = allMyUserRoles.find((ur) => ur.isPrimary)?.roleId ?? null;
    }

    // Cari Dekan (selalu dipakai sebagai Atasan Pejabat Penilai / Pihak Kedua Rencana SKP)
    const dekanRow = await this.userRoleRepository
      .createQueryBuilder('ur')
      .innerJoinAndSelect('ur.user', 'u')
      .innerJoinAndSelect('ur.role', 'r')
      .where('ur.isPrimary = true')
      .andWhere("LOWER(r.name) = 'dekan'")
      .getOne();

    let penilai: { nama: string; nip: string | null; jabatan: string | null } | null = null;
    let atasanPenilai: { nama: string; nip: string | null; jabatan: string | null } | null = null;

    // Ambil config dari master (admin-set) — dua field terpisah
    if (myRoleId) {
      const config = await this.skpPenilaiRepo.findOne({
        where: { roleId: myRoleId },
        relations: ['pihakKeduaUser', 'penilaiUser'],
      });

      // Pihak Kedua Rencana SKP (atasanPenilai dalam response)
      if (config?.pihakKeduaUser) {
        const pihakKeduaRoles = await this.userRoleRepository.find({
          where: { userId: config.pihakKeduaUser.id },
          relations: ['role'],
        });
        const pkSenior = [...pihakKeduaRoles].sort((a, b) => (a.role?.level ?? 99) - (b.role?.level ?? 99))[0];
        atasanPenilai = {
          nama: config.pihakKeduaUser.nama,
          nip: config.pihakKeduaUser.nip ?? null,
          jabatan: pkSenior?.role?.name ?? null,
        };
      }

      // Pejabat Penilai Kinerja EKP (penilai dalam response)
      if (config?.penilaiUser) {
        const penilaiRoles = await this.userRoleRepository.find({
          where: { userId: config.penilaiUser.id },
          relations: ['role'],
        });
        const pnSenior = [...penilaiRoles].sort((a, b) => (a.role?.level ?? 99) - (b.role?.level ?? 99))[0];
        penilai = {
          nama: config.penilaiUser.nama,
          nip: config.penilaiUser.nip ?? null,
          jabatan: pnSenior?.role?.name ?? null,
        };
      }
    }

    // Fallback Pejabat Penilai → WD1 jika belum dikonfigurasi
    if (!penilai) {
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
      penilai = wd1Row?.user
        ? { nama: wd1Row.user.nama, nip: wd1Row.user.nip ?? null, jabatan: wd1Row.role?.name ?? null }
        : null;
    }

    // Fallback Pihak Kedua Rencana SKP → Dekan jika belum dikonfigurasi
    if (!atasanPenilai) {
      const dekanUser = dekanRow?.user ?? null;
      if (dekanUser) {
        atasanPenilai = { nama: dekanUser.nama, nip: dekanUser.nip ?? null, jabatan: dekanRow?.role?.name ?? null };
      }
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

  /** Atasan meminta user merevisi submission — set needs_revision, PERTAHANKAN validFileCount, kirim notifikasi */
  async requestRevision(id: number, catatan?: string): Promise<void> {
    const realisasi = await this.realisasiRepository.findOne({
      where: { id },
      relations: ['indikator'],
    });
    if (!realisasi) throw new Error('Realisasi tidak ditemukan');
    const allowed = ['pending', 'validated_atasan', 'validated_wd2', 'needs_revision'];
    if (!allowed.includes(realisasi.status)) {
      throw new Error('Status tidak dapat direvisi');
    }
    // Pertahankan validFileCount agar hasil validasi sebagian tidak hilang
    await this.realisasiRepository.update(id, {
      status: 'needs_revision',
      ...(catatan !== undefined && catatan !== '' ? { catatanRevisi: catatan } : {}),
    });

    // Kirim notifikasi otomatis ke pemilik dokumen
    if (realisasi.createdBy) {
      const kode = realisasi.indikator?.kode ?? '';
      const nama = realisasi.indikator?.nama ?? 'Indikator';
      const catatanMsg = catatan ? ` Catatan: "${catatan}"` : '';
      await this.notificationRepository.save(
        this.notificationRepository.create({
          userId: realisasi.createdBy,
          type: 'permintaan_revisi',
          indikatorId: realisasi.indikatorId,
          tahun: realisasi.tahun,
          message: `Validator meminta revisi dokumen Anda untuk indikator ${kode} ${nama}.${catatanMsg} Segera unggah ulang dokumen yang diperlukan.`,
          isRead: false,
        }),
      );
    }
  }

  /** Daftar realisasi milik user yang sedang menunggu revisi (needs_revision) */
  async getMyNeedsRevision(userId: number, tahun: string): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      where: { createdBy: userId, tahun, status: 'needs_revision' },
      relations: ['indikator'],
      order: { createdAt: 'DESC' },
    });
    return list
      .filter((r) => r.periode !== '_summary')
      .map((r) => ({
        id: r.id,
        indikatorId: r.indikatorId,
        indikatorKode: r.indikator?.kode ?? '',
        indikatorNama: r.indikator?.nama ?? '',
        periode: r.periode,
        realisasiAngka: Number(r.realisasiAngka),
        validFileCount: r.validFileCount ?? null,
        keterangan: r.keterangan ?? null,
        catatanRevisi: r.catatanRevisi ?? null,
        createdAt: r.createdAt,
      }));
  }

  /**
   * Pimpinan (Wadek3 / Kajur / siapapun yang mendisposisi ke level bawah):
   * Ambil semua realisasi dosen yang sudah divalidasi atasan langsung (validated_atasan),
   * dikelompokkan per bawahan (Kaprodi/atasan-bawah) lalu per indikator.
   *
   * Logika:
   *  1. Cari semua disposisi yang dikirim OLEH pimpinanId (fromUserId = pimpinanId) → bawahan set
   *  2. Untuk setiap pasangan (bawahan, indikator), cari disposisi DARI bawahan tersebut
   *     ke para dosennya → child disposisi
   *  3. Cari realisasi yang disposisiId-nya ada di child disposisi itu
   *  4. Tampilkan yang statusnya validated_atasan (siap divalidasi pimpinan)
   */
  async getSubmissionsForPimpinan(pimpinanId: number, tahun: string): Promise<any[]> {
    // 1. Disposisi yang pimpinan kirim ke bawahannya
    const myDisposisi = await this.disposisiRepository.find({
      where: { fromUserId: pimpinanId, tahun },
      relations: ['toUser', 'indikator'],
    });

    if (myDisposisi.length === 0) return [];

    // Kelompokkan per (bawahanId, indikatorId)
    const bawahanIndikatorMap = new Map<string, { bawahanId: number; indikatorId: number; targetBawahan: number; bawahan: any; indikator: any }>();
    for (const d of myDisposisi) {
      if (!d.toUserId || !d.indikatorId) continue;
      const key = `${d.toUserId}:${d.indikatorId}`;
      if (!bawahanIndikatorMap.has(key)) {
        bawahanIndikatorMap.set(key, {
          bawahanId: d.toUserId,
          indikatorId: d.indikatorId,
          targetBawahan: Number(d.jumlahTarget),
          bawahan: d.toUser,
          indikator: d.indikator,
        });
      }
    }

    const result = new Map<number, any>(); // keyed by bawahanId

    for (const { bawahanId, indikatorId, targetBawahan, bawahan, indikator } of bawahanIndikatorMap.values()) {
      // Jangan izinkan user memvalidasi dirinya sendiri
      if (bawahanId === pimpinanId) continue;

      // 2. Disposisi DARI bawahan ke dosen untuk indikator ini
      const childDisposisi = await this.disposisiRepository.find({
        where: { fromUserId: bawahanId, indikatorId, tahun },
        relations: ['toUser'],
      });

      if (childDisposisi.length === 0) continue;

      // Dosen yang menerima disposisi dari bawahan untuk indikator ini
      const dosenIds = childDisposisi.map((d) => d.toUserId).filter(Boolean);
      if (dosenIds.length === 0) continue;

      // 3. Realisasi dosen berdasarkan (createdBy, indikatorId) — tidak bergantung pada disposisiId
      //    karena banyak realisasi dikirim tanpa melampirkan disposisiId
      const realisasiList = await this.realisasiRepository
        .createQueryBuilder('r')
        .leftJoinAndSelect('r.creator', 'creator')
        .leftJoinAndSelect('r.indikator', 'ind')
        .where('r.created_by IN (:...dosenIds)', { dosenIds })
        .andWhere('r.indikator_id = :indikatorId', { indikatorId })
        .andWhere('r.status IN (:...statuses)', { statuses: ['validated_atasan', 'validated_wd2'] })
        .andWhere('r.tahun = :tahun', { tahun })
        .getMany();

      if (realisasiList.length === 0) continue;

      // Bangun entry bawahan
      if (!result.has(bawahanId)) {
        result.set(bawahanId, {
          bawahanId,
          bawahanNama: bawahan?.nama ?? `User ${bawahanId}`,
          bawahanEmail: (bawahan as any)?.email ?? '',
          indikators: [],
        });
      }

      const childDisposisiTargetMap = new Map<number, number>();
      for (const cd of childDisposisi) {
        childDisposisiTargetMap.set(cd.toUserId, Number(cd.jumlahTarget));
      }

      const dosenList = realisasiList.map((r) => ({
        realisasiId: r.id,
        dosenId: r.createdBy,
        dosenNama: r.creator?.nama ?? `User ${r.createdBy}`,
        dosenEmail: (r.creator as any)?.email ?? '',
        targetDosen: childDisposisiTargetMap.get(r.createdBy) ?? null,
        validFileCount: r.validFileCount,
        status: r.status,
        tahun: r.tahun,
        periode: r.periode,
      }));

      result.get(bawahanId)!.indikators.push({
        indikatorId,
        kodeIndikator: indikator?.kode ?? '',
        namaIndikator: indikator?.nama ?? '',
        targetBawahan,
        totalValidFiles: dosenList.reduce((s, d) => s + (d.validFileCount ?? 0), 0),
        dosenCount: dosenList.length,
        pendingCount: dosenList.filter((d) => d.status === 'validated_atasan').length,
        dosenList,
      });
    }

    return Array.from(result.values()).map((b) => ({
      ...b,
      indikators: b.indikators.sort((a: any, z: any) => a.kodeIndikator.localeCompare(z.kodeIndikator)),
    }));
  }

  /**
   * Pimpinan memvalidasi capaian bawahan (Kaprodi) untuk satu indikator:
   * Update semua realisasi dosen di bawah rantai pimpinan→bawahan→indikator
   * dari validated_atasan → validated_wd2.
   */
  async validatePimpinanForBawahan(pimpinanId: number, bawahanId: number, indikatorId: number, tahun: string): Promise<void> {
    if (bawahanId === pimpinanId) throw new Error('Tidak dapat memvalidasi diri sendiri');

    // Verifikasi pimpinan memang mendisposisi ke bawahan untuk indikator ini
    const parentDisp = await this.disposisiRepository.findOne({
      where: { fromUserId: pimpinanId, toUserId: bawahanId, indikatorId, tahun },
    });
    if (!parentDisp) throw new Error('Disposisi tidak ditemukan');

    // Cari semua child disposisi dari bawahan ke dosen untuk indikator ini
    const childDisposisi = await this.disposisiRepository.find({
      where: { fromUserId: bawahanId, indikatorId, tahun },
    });

    if (childDisposisi.length === 0) return;

    const dosenIds = childDisposisi.map((d) => d.toUserId).filter(Boolean);
    if (dosenIds.length === 0) return;

    await this.realisasiRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'validated_wd2' })
      .where('created_by IN (:...dosenIds)', { dosenIds })
      .andWhere('indikator_id = :indikatorId', { indikatorId })
      .andWhere('status = :status', { status: 'validated_atasan' })
      .andWhere('tahun = :tahun', { tahun })
      .execute();

    // Buat "summary record" untuk bawahan sehingga SKP bawahan menampilkan
    // aggregate validated dosen-nya. Hanya berlaku jika ada dosen selain bawahan
    // itu sendiri (hindari double-count pada kasus disposisi self-referential).
    const nonSelfDosenIds = dosenIds.filter((id) => id !== bawahanId);
    if (nonSelfDosenIds.length > 0) {
      const validatedRecords = await this.realisasiRepository
        .createQueryBuilder('r')
        .where('r.created_by IN (:...ids)', { ids: nonSelfDosenIds })
        .andWhere('r.indikator_id = :indikatorId', { indikatorId })
        .andWhere('r.status IN (:...statuses)', {
          statuses: ['validated_atasan', 'validated_wd2', 'approved'],
        })
        .andWhere('r.tahun = :tahun', { tahun })
        .getMany();

      const totalVal = validatedRecords.reduce((sum, r) => {
        const v =
          r.validFileCount !== null
            ? Number(r.validFileCount)
            : Number(r.realisasiAngka ?? 0);
        return sum + v;
      }, 0);

      // Hapus summary lama lalu sisipkan yang baru
      await this.realisasiRepository.delete({
        createdBy: bawahanId,
        indikatorId,
        tahun,
        periode: '_summary',
      } as any);

      if (totalVal > 0) {
        await this.realisasiRepository.save(
          this.realisasiRepository.create({
            createdBy: bawahanId,
            indikatorId,
            tahun,
            periode: '_summary',
            realisasiAngka: totalVal,
            validFileCount: totalVal,
            status: 'validated_wd2',
            disposisiId: parentDisp.id,
            roleId: null,
            keterangan: 'Summary pimpinan validation',
          }),
        );
      }
    }
  }

  /** @deprecated Gunakan getSubmissionsForPimpinan. Tetap ada untuk backward-compat. */
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

  /** @deprecated Gunakan validatePimpinanForBawahan. */
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

    // Prioritaskan record needs_revision agar re-submit user langsung mereset status ke pending
    const revisionRecord = await this.realisasiRepository.findOne({
      where: { indikatorId, tahun, periode, createdBy: userId, status: 'needs_revision' },
    });
    if (revisionRecord) {
      revisionRecord.realisasiAngka = realisasiAngka;
      revisionRecord.keterangan = keterangan ?? null;
      revisionRecord.status = 'pending';
      revisionRecord.validFileCount = null;
      revisionRecord.catatanRevisi = null;
      if (roleId !== null) revisionRecord.roleId = roleId;
      return this.realisasiRepository.save(revisionRecord);
    }

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
    // Prioritaskan record needs_revision agar re-submit langsung mereset status ke pending
    let existing: Realisasi;
    const revisionRecord = await this.realisasiRepository.findOne({
      where: { indikatorId, tahun, periode, createdBy: userId, status: 'needs_revision' },
    });
    if (revisionRecord) {
      revisionRecord.realisasiAngka = fileCount;
      revisionRecord.status = 'pending';
      revisionRecord.validFileCount = null;
      revisionRecord.catatanRevisi = null;
      if (roleId !== null) revisionRecord.roleId = roleId;
      existing = await this.realisasiRepository.save(revisionRecord);
    } else {
      // Gunakan IsNull() untuk kolom nullable agar TypeORM menghasilkan WHERE role_id IS NULL
      const roleIdWhere = roleId !== null ? roleId : IsNull();
      const found = await this.realisasiRepository.findOne({
        where: { indikatorId, roleId: roleIdWhere as any, tahun, periode, createdBy: userId },
      });
      if (found) {
        found.realisasiAngka = fileCount;
        existing = await this.realisasiRepository.save(found);
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

  /** Pejabat Penilai: daftar user yang harus dinilai ekspektasinya + ringkasan capaian + nilai saat ini */
  async getEkspektasiBawahanForPenilai(penilaiId: number, tahun: string): Promise<any[]> {
    const penilaiConfigs = await this.skpPenilaiRepo.find({ where: { penilaiUserId: penilaiId } });
    if (penilaiConfigs.length === 0) return [];

    const roleIds = penilaiConfigs.map(c => c.roleId);

    const userRoles = await this.userRoleRepository.find({
      where: { roleId: In(roleIds), isPrimary: true },
      relations: ['user'],
    });
    if (userRoles.length === 0) return [];

    const userIds = userRoles.map(ur => ur.userId);

    const realisasiStats = await this.realisasiRepository
      .createQueryBuilder('r')
      .select('r.created_by', 'userId')
      .addSelect('COUNT(*)', 'total')
      .addSelect(
        `COUNT(CASE WHEN r.status IN ('validated_atasan','validated_wd2','approved') THEN 1 END)`,
        'validated',
      )
      .where('r.tahun = :tahun', { tahun })
      .andWhere('r.created_by IN (:...userIds)', { userIds })
      .groupBy('r.created_by')
      .getRawMany();

    const statsMap = new Map<number, { total: number; validated: number }>();
    for (const row of realisasiStats) {
      statsMap.set(Number(row.userId), { total: Number(row.total), validated: Number(row.validated) });
    }

    const ekspektasiList = await this.verifikasiEkspektasiRepo.find({
      where: { penilaiUserId: penilaiId, targetUserId: In(userIds), tahun },
    });
    const ekspektasiMap = new Map<number, VerifikasiEkspektasi>();
    for (const e of ekspektasiList) {
      ekspektasiMap.set(e.targetUserId, e);
    }

    return userRoles
      .map(ur => {
        const stats = statsMap.get(ur.userId) ?? { total: 0, validated: 0 };
        const eks = ekspektasiMap.get(ur.userId);
        return {
          userId: ur.userId,
          nama: ur.user?.nama ?? `User ${ur.userId}`,
          email: (ur.user as any)?.email ?? '',
          totalIndikator: stats.total,
          validatedCount: stats.validated,
          ekspektasi: eks?.ekspektasi ?? null,
          catatan: eks?.catatan ?? null,
        };
      })
      .sort((a, b) => a.nama.localeCompare(b.nama));
  }

  /** Simpan atau perbarui penilaian ekspektasi */
  async upsertEkspektasi(data: {
    penilaiId: number;
    targetUserId: number;
    tahun: string;
    ekspektasi: string;
    catatan?: string;
  }): Promise<void> {
    const { penilaiId, targetUserId, tahun, ekspektasi, catatan } = data;
    const existing = await this.verifikasiEkspektasiRepo.findOne({
      where: { targetUserId, penilaiUserId: penilaiId, tahun },
    });
    if (existing) {
      existing.ekspektasi = ekspektasi;
      existing.catatan = catatan ?? null;
      await this.verifikasiEkspektasiRepo.save(existing);
    } else {
      await this.verifikasiEkspektasiRepo.save(
        this.verifikasiEkspektasiRepo.create({
          targetUserId,
          penilaiUserId: penilaiId,
          tahun,
          ekspektasi,
          catatan: catatan ?? null,
        }),
      );
    }
  }
}
