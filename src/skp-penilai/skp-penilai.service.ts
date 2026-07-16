import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SkpPenilaiConfig } from './skp-penilai.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { SkpRencanaStatus } from '../skp-rencana/skp-rencana.entity';
import { SkpHasilStatus } from '../skp-hasil/skp-hasil.entity';

@Injectable()
export class SkpPenilaiService {
  constructor(
    @InjectRepository(SkpPenilaiConfig)
    private readonly repo: Repository<SkpPenilaiConfig>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Realisasi)
    private readonly realisasiRepo: Repository<Realisasi>,
    @InjectRepository(SkpRencanaStatus)
    private readonly skpRencanaRepo: Repository<SkpRencanaStatus>,
    @InjectRepository(SkpHasilStatus)
    private readonly skpHasilRepo: Repository<SkpHasilStatus>,
  ) {}

  async findAll() {
    const configs = await this.repo.find({
      relations: ['role', 'checkerUser', 'pihakKeduaUser', 'penilaiUser'],
      order: { role: { level: 'ASC' } },
    });
    return configs.map((c) => ({
      id: c.id,
      roleId: c.roleId,
      roleName: c.role?.name ?? '',
      roleLevel: c.role?.level ?? 0,
      unitNama: c.role?.unitNama ?? '',
      // Checker (Rencana SKP — step 1)
      checkerUserId: c.checkerUserId ?? null,
      checkerNama: c.checkerUser?.nama ?? null,
      // Pihak Kedua (Rencana SKP — step 2)
      pihakKeduaUserId: c.pihakKeduaUserId ?? null,
      pihakKeduaNama: c.pihakKeduaUser?.nama ?? null,
      // EKP
      penilaiUserId: c.penilaiUserId ?? null,
      penilaiNama: c.penilaiUser?.nama ?? null,
      penilaiNip: c.penilaiUser?.nip ?? null,
    }));
  }

  async findAllRoles() {
    return this.roleRepo.find({ order: { level: 'ASC', name: 'ASC' } });
  }

  async findAllUsers() {
    const users = await this.userRepo.find({ order: { nama: 'ASC' } });
    const userRoles = await this.userRoleRepo.find({
      where: { isPrimary: true },
      relations: ['role'],
    });
    // Jika user punya >1 role primary, ambil yang level-nya terendah (jabatan tertinggi)
    const roleMap = new Map<number, string>();
    const sorted = [...userRoles].sort((a, b) => (b.role?.level ?? 99) - (a.role?.level ?? 99));
    for (const ur of sorted) {
      roleMap.set(ur.userId, ur.role?.name ?? '');
    }
    return users.map((u) => ({
      id: u.id,
      nama: u.nama,
      nip: u.nip,
      jabatan: roleMap.get(u.id) ?? '',
    }));
  }

  /** Cari Pihak Kedua (Rencana SKP) untuk roleId */
  async findPihakKeduaForRole(roleId: number): Promise<User | null> {
    const config = await this.repo.findOne({
      where: { roleId },
      relations: ['pihakKeduaUser'],
    });
    return config?.pihakKeduaUser ?? null;
  }

  /** Cari Pejabat Penilai (EKP) untuk roleId */
  async findPenilaiForRole(roleId: number): Promise<User | null> {
    const config = await this.repo.findOne({
      where: { roleId },
      relations: ['penilaiUser'],
    });
    return config?.penilaiUser ?? null;
  }

  /** Upsert config by roleId — semua field opsional */
  async upsert(roleId: number, body: { checkerUserId?: number | null; pihakKeduaUserId?: number | null; penilaiUserId?: number | null }) {
    const existing = await this.repo.findOne({ where: { roleId } });
    if (existing) {
      const updates: Partial<SkpPenilaiConfig> = {};
      if (body.checkerUserId !== undefined) updates.checkerUserId = body.checkerUserId;
      if (body.pihakKeduaUserId !== undefined) updates.pihakKeduaUserId = body.pihakKeduaUserId;
      if (body.penilaiUserId !== undefined) updates.penilaiUserId = body.penilaiUserId;
      await this.repo.update(existing.id, updates);
    } else {
      const created = this.repo.create({
        roleId,
        checkerUserId: body.checkerUserId ?? null,
        pihakKeduaUserId: body.pihakKeduaUserId ?? null,
        penilaiUserId: body.penilaiUserId ?? null,
      });
      await this.repo.save(created);
    }
    return this.repo.findOne({
      where: { roleId },
      relations: ['role', 'checkerUser', 'pihakKeduaUser', 'penilaiUser'],
    });
  }

  async remove(id: number) {
    await this.repo.delete(id);
    return { success: true };
  }

  private computeSkpStatus(statuses: string[]): string {
    if (statuses.length === 0) return 'pending';
    if (statuses.every((s) => s === 'approved')) return 'approved';
    if (statuses.some((s) => s === 'rejected')) return 'rejected';
    if (statuses.every((s) => s === 'validated_wd2' || s === 'approved')) return 'validated_wd2';
    if (statuses.every((s) => s === 'validated_atasan' || s === 'validated_wd2' || s === 'approved')) return 'validated_atasan';
    return 'pending';
  }

  /** Normalize status lama ke nama baru */
  private normalizeRencanaStatus(s: string): string {
    if (s === 'disetujui_pegawai') return 'signed_pegawai';
    if (s === 'tervalidasi_atasan') return 'checked';
    return s;
  }

  /** Ambil bawahan untuk checker, pihak kedua, dan penilai berdasarkan konfigurasi.
   *  - checkerBawahan   : bawahan yang perlu dicek (status signed_pegawai)
   *  - rencanaSKPBawahan: bawahan yang siap di-TTD Pihak Kedua (status checked, atau signed_pegawai jika tanpa checker)
   *  - ekpBawahan       : bawahan yang sudah divalidasi atasan langsung
   */
  async getCheckerBawahan(userId: number, tahun: string) {
    const configs = await this.repo.find({ relations: ['role'] });

    const checkerRoleIds = configs
      .filter((c) => c.checkerUserId === userId)
      .map((c) => c.roleId);

    const pihakKeduaRoleIds = configs
      .filter((c) => c.pihakKeduaUserId === userId)
      .map((c) => c.roleId);

    const penilaiRoleIds = configs
      .filter((c) => c.penilaiUserId === userId)
      .map((c) => c.roleId);

    // Map roleId → apakah ada checker dikonfigurasi
    const roleHasChecker = new Map(configs.map((c) => [c.roleId, !!c.checkerUserId]));

    const allRoleIds = [...new Set([...checkerRoleIds, ...pihakKeduaRoleIds, ...penilaiRoleIds])];
    if (allRoleIds.length === 0) {
      return { checkerBawahan: [], rencanaSKPBawahan: [], ekpBawahan: [], hasilCheckerBawahan: [], hasilPenilaiDapatTTD: [] };
    }

    const userRolesFiltered = await this.userRoleRepo.find({
      where: { roleId: In(allRoleIds) },
      relations: ['user', 'role'],
    });

    const dedup = <T extends { userId: number }>(arr: T[]) =>
      arr.filter((v, i, a) => a.findIndex((x) => x.userId === v.userId) === i);

    const mapUser = (ur: (typeof userRolesFiltered)[0]) => ({
      userId: ur.userId,
      nama: ur.user?.nama ?? '',
      nip: ur.user?.nip ?? null,
      email: ur.user?.email ?? '',
      jabatan: ur.role?.name ?? '',
      roleId: ur.roleId,
    });

    // Build initial candidates
    const rawCheckerCandidates = dedup(
      userRolesFiltered.filter((ur) => checkerRoleIds.includes(ur.roleId)).map(mapUser),
    );
    const rawRencanaCandidates = dedup(
      userRolesFiltered.filter((ur) => pihakKeduaRoleIds.includes(ur.roleId)).map(mapUser),
    );
    const rawEkpCandidates = dedup(
      userRolesFiltered.filter((ur) => penilaiRoleIds.includes(ur.roleId)).map(mapUser),
    );

    // ── Dual-role filter: pimpinan users follow their highest-priority configured role ──
    // If a user has role A (e.g. Wadek 2, level 2) and role B (e.g. Dosen, level 5),
    // and BOTH roles have a Master SKP config, they should only appear under role A.
    // This prevents Wadek 2+Dosen from appearing in Kajur's checker list.
    const configuredRoleIds = new Set(configs.map((c) => c.roleId));
    const configuredRoleLevels = new Map(configs.map((c) => [c.roleId, c.role?.level ?? 99]));

    const allCandidateUserIds = [...new Set([
      ...rawCheckerCandidates.map((c) => c.userId),
      ...rawRencanaCandidates.map((c) => c.userId),
      ...rawEkpCandidates.map((c) => c.userId),
    ])];

    // For each candidate user, find their highest-priority configured role
    const userHighestConfiguredRole = new Map<number, number>(); // userId → roleId
    if (allCandidateUserIds.length > 0) {
      const allCandidateRoles = await this.userRoleRepo.find({
        where: { userId: In(allCandidateUserIds) },
        relations: ['role'],
      });
      for (const ur of allCandidateRoles) {
        if (!configuredRoleIds.has(ur.roleId)) continue;
        const level = ur.role?.level ?? 99;
        const existing = userHighestConfiguredRole.get(ur.userId);
        const existingLevel = existing !== undefined ? (configuredRoleLevels.get(existing) ?? 99) : 99;
        if (existing === undefined || level < existingLevel) {
          userHighestConfiguredRole.set(ur.userId, ur.roleId);
        }
      }
    }

    // Keep a candidate only if the roleId they were found under IS their highest configured role
    const isEligibleForRole = (candidateUserId: number, forRoleId: number): boolean => {
      const highestRoleId = userHighestConfiguredRole.get(candidateUserId);
      return highestRoleId === undefined || highestRoleId === forRoleId;
    };

    const checkerCandidates = rawCheckerCandidates.filter((c) => isEligibleForRole(c.userId, c.roleId));
    const rencanaCandidates = rawRencanaCandidates.filter((c) => isEligibleForRole(c.userId, c.roleId));
    const ekpCandidates = rawEkpCandidates.filter((c) => isEligibleForRole(c.userId, c.roleId));

    // Ambil status rencana untuk semua candidate yang relevan
    const allRencanaUserIds = [...new Set([
      ...checkerCandidates.map((c) => c.userId),
      ...rencanaCandidates.map((c) => c.userId),
    ])];
    const rencanaRecords = allRencanaUserIds.length
      ? await this.skpRencanaRepo
          .createQueryBuilder('s')
          .where('s.user_id IN (:...ids)', { ids: allRencanaUserIds })
          .andWhere('s.tahun = :tahun', { tahun })
          .getMany()
      : [];
    const rencanaStatusMap = new Map(
      rencanaRecords.map((r) => [r.userId, this.normalizeRencanaStatus(r.status)]),
    );

    // Checker: tampilkan SEMUA bawahan yang dikonfigurasi dengan status masing-masing
    // (frontend menentukan action berdasarkan status)
    const checkerBawahan = checkerCandidates.map((c) => ({
      ...c,
      rencanaStatus: rencanaStatusMap.get(c.userId) ?? 'draft',
    }));

    // Pihak Kedua: tampilkan SEMUA bawahan yang dikonfigurasi dengan status masing-masing
    // Frontend menampilkan TTD button hanya ketika status sudah eligible
    const rencanaSKPBawahan = rencanaCandidates.map((c) => ({
      ...c,
      rencanaStatus: rencanaStatusMap.get(c.userId) ?? 'draft',
      hasChecker: roleHasChecker.get(c.roleId) ?? false,
    }));

    // EKP: hanya tampilkan yang sudah divalidasi atasan langsung
    const ekpBawahan: (typeof ekpCandidates[0] & { skpStatus: string; hasilStatus: string })[] = [];
    for (const candidate of ekpCandidates) {
      const realisasiList = await this.realisasiRepo.find({
        where: { createdBy: candidate.userId, tahun },
      });
      const skpStatus = this.computeSkpStatus(realisasiList.map((r) => r.status));
      if (skpStatus !== 'pending') {
        ekpBawahan.push({ ...candidate, skpStatus, hasilStatus: 'pending' });
      }
    }

    // Ambil status hasil SKP untuk semua kandidat relevan
    const allHasilUserIds = [...new Set([
      ...checkerCandidates.map((c) => c.userId),
      ...ekpCandidates.map((c) => c.userId),
    ])];
    const hasilRecords = allHasilUserIds.length
      ? await this.skpHasilRepo
          .createQueryBuilder('h')
          .where('h.user_id IN (:...ids)', { ids: allHasilUserIds })
          .andWhere('h.tahun = :tahun', { tahun })
          .getMany()
      : [];
    const hasilStatusMap = new Map(hasilRecords.map((r) => [r.userId, r.status]));

    // Patch hasilStatus onto ekpBawahan
    for (const b of ekpBawahan) {
      b.hasilStatus = hasilStatusMap.get(b.userId) ?? 'pending';
    }

    // Hasil SKP Checker: semua bawahan yang sudah submit (non-pending) — untuk riwayat
    const hasilCheckerBawahan = checkerCandidates
      .map((c) => ({ ...c, hasilStatus: hasilStatusMap.get(c.userId) ?? 'pending' }))
      .filter((c) => c.hasilStatus !== 'pending');

    // Pejabat Penilai: semua bawahan yang sudah submit (non-pending) — untuk riwayat
    const hasilPenilaiDapatTTD = ekpCandidates
      .map((c) => ({ ...c, hasilStatus: hasilStatusMap.get(c.userId) ?? 'pending' }))
      .filter((c) => c.hasilStatus !== 'pending');

    return { checkerBawahan, rencanaSKPBawahan, ekpBawahan, hasilCheckerBawahan, hasilPenilaiDapatTTD };
  }
}
