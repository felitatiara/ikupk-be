import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { SkpPenilaiConfig } from './skp-penilai.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { SkpRencanaStatus } from '../skp-rencana/skp-rencana.entity';

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
  ) {}

  async findAll() {
    const configs = await this.repo.find({
      relations: ['role', 'pihakKeduaUser', 'penilaiUser'],
      order: { role: { level: 'ASC' } },
    });
    return configs.map((c) => ({
      id: c.id,
      roleId: c.roleId,
      roleName: c.role?.name ?? '',
      roleLevel: c.role?.level ?? 0,
      unitNama: c.role?.unitNama ?? '',
      // Rencana SKP
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
    const roleMap = new Map(userRoles.map((ur) => [ur.userId, ur.role?.name ?? '']));
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
  async upsert(roleId: number, body: { pihakKeduaUserId?: number | null; penilaiUserId?: number | null }) {
    const existing = await this.repo.findOne({ where: { roleId } });
    if (existing) {
      const updates: Partial<SkpPenilaiConfig> = {};
      if (body.pihakKeduaUserId !== undefined) updates.pihakKeduaUserId = body.pihakKeduaUserId;
      if (body.penilaiUserId !== undefined) updates.penilaiUserId = body.penilaiUserId;
      await this.repo.update(existing.id, updates);
    } else {
      const created = this.repo.create({
        roleId,
        pihakKeduaUserId: body.pihakKeduaUserId ?? null,
        penilaiUserId: body.penilaiUserId ?? null,
      });
      await this.repo.save(created);
    }
    return this.repo.findOne({
      where: { roleId },
      relations: ['role', 'pihakKeduaUser', 'penilaiUser'],
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

  /** Ambil semua bawahan yang dikonfigurasi untuk userId ini sebagai Pihak Kedua atau Penilai.
   *  ekpBawahan hanya dikembalikan jika SKP bawahan sudah divalidasi oleh atasan langsung. */
  async getCheckerBawahan(userId: number, tahun: string) {
    const configs = await this.repo.find({ relations: ['role'] });

    const pihakKeduaRoleIds = configs
      .filter((c) => c.pihakKeduaUserId === userId)
      .map((c) => c.roleId);

    const penilaiRoleIds = configs
      .filter((c) => c.penilaiUserId === userId)
      .map((c) => c.roleId);

    const allRoleIds = [...new Set([...pihakKeduaRoleIds, ...penilaiRoleIds])];
    if (allRoleIds.length === 0) {
      return { rencanaSKPBawahan: [], ekpBawahan: [] };
    }

    const userRolesFiltered = await this.userRoleRepo.find({
      where: { roleId: In(allRoleIds) },
      relations: ['user', 'role'],
    });

    const dedup = <T extends { userId: number }>(arr: T[]) =>
      arr.filter((v, i, a) => a.findIndex((x) => x.userId === v.userId) === i);

    const rencanaCandidates = dedup(
      userRolesFiltered
        .filter((ur) => pihakKeduaRoleIds.includes(ur.roleId))
        .map((ur) => ({
          userId: ur.userId,
          nama: ur.user?.nama ?? '',
          nip: ur.user?.nip ?? null,
          email: ur.user?.email ?? '',
          jabatan: ur.role?.name ?? '',
          roleId: ur.roleId,
        })),
    );

    const ekpCandidates = dedup(
      userRolesFiltered
        .filter((ur) => penilaiRoleIds.includes(ur.roleId))
        .map((ur) => ({
          userId: ur.userId,
          nama: ur.user?.nama ?? '',
          nip: ur.user?.nip ?? null,
          email: ur.user?.email ?? '',
          jabatan: ur.role?.name ?? '',
          roleId: ur.roleId,
        })),
    );

    // Rencana SKP: tampilkan semua dosen yang dikonfigurasi, dengan status TTD masing-masing
    const rencanaUserIds = rencanaCandidates.map((c) => c.userId);
    const rencanaRecords = rencanaUserIds.length
      ? await this.skpRencanaRepo
          .createQueryBuilder('s')
          .where('s.user_id IN (:...ids)', { ids: rencanaUserIds })
          .andWhere('s.tahun = :tahun', { tahun })
          .getMany()
      : [];
    const rencanaStatusMap = new Map(rencanaRecords.map((r) => [r.userId, r.status]));

    const rencanaSKPBawahan = rencanaCandidates
      .map((c) => ({ ...c, rencanaStatus: rencanaStatusMap.get(c.userId) ?? 'draft' }));

    // EKP: hanya tampilkan yang sudah divalidasi atasan langsung
    const ekpBawahan: (typeof ekpCandidates[0] & { skpStatus: string })[] = [];
    for (const candidate of ekpCandidates) {
      const realisasiList = await this.realisasiRepo.find({
        where: { createdBy: candidate.userId, tahun },
      });
      const skpStatus = this.computeSkpStatus(realisasiList.map((r) => r.status));
      if (skpStatus !== 'pending') {
        ekpBawahan.push({ ...candidate, skpStatus });
      }
    }

    return { rencanaSKPBawahan, ekpBawahan };
  }
}
