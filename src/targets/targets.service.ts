import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { User } from '../users/user.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepo: Repository<Indikator>,
    @InjectRepository(TargetUniversitas)
    private targetUniRepo: Repository<TargetUniversitas>,
    @InjectRepository(TargetUnit)
    private targetUnitRepo: Repository<TargetUnit>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
    @InjectRepository(Realisasi)
    private realisasiRepo: Repository<Realisasi>,
  ) {}

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  private buildIndikatorRootFinder(allIndikators: Indikator[]) {
    const map = new Map(allIndikators.map((i) => [i.id, i]));
    return (id: number): number => {
      let current = map.get(id);
      while (current && current.parentId) current = map.get(current.parentId);
      return current ? current.id : id;
    };
  }

  async getAll(): Promise<any[]> {
    const targets = await this.targetUniRepo.find({ relations: ['indikator'] });
    return targets.map((t) => ({
      date: this.formatDate(t.createdAt),
      title: t.indikator?.nama || '',
      sasaran: '',
      capaian: t.persentase != null ? `${t.persentase}%` : '',
    }));
  }

  async getTargetDetailByRole(roleId: number): Promise<any[]> {
    const targets = await this.targetUnitRepo.find({
      where: { roleId },
      relations: ['indikator', 'role'],
    });
    return targets.map((t) => ({
      id: t.id,
      tenggat: this.formatDate(t.createdAt),
      targetNama: t.indikator?.nama || '',
      sasaranStrategis: t.indikator?.nama || '',
      capaian: '0%',
      roleNama: t.role?.name || '',
      unitNama: t.role?.unitNama || '',
      tahun: t.tahun,
      nilaiTarget: t.nilaiTarget,
    }));
  }

  async getTargetsForAdminFIK(): Promise<any[]> {
    const indikators = await this.indikatorRepo.find();
    const result: any[] = [];
    for (const indikator of indikators) {
      const targets = await this.targetUnitRepo.find({
        where: { indikatorId: indikator.id },
        relations: ['role'],
      });
      result.push({
        indikatorId: indikator.id,
        indikatorNama: indikator.nama,
        indikatorKode: indikator.kode,
        indikatorJenis: indikator.jenis,
        parentId: indikator.parentId,
        indikatorTipe: indikator.parentId === null ? 'SASARAN STRATEGIS' : 'INDIKATOR KINERJA KEGIATAN',
        targets: targets.map((t) => ({
          id: t.id,
          roleId: t.roleId,
          roleNama: t.role?.name || '',
          unitNama: t.role?.unitNama || '',
          tahun: t.tahun,
          nilaiTarget: t.nilaiTarget,
          createdAt: t.createdAt,
        })),
      });
    }
    return result;
  }

  async getAdminTargetsGrouped(): Promise<any[]> {
    const targets = await this.targetUnitRepo.find({ relations: ['indikator', 'role'] });
    if (targets.length === 0) return [];
    const allIndikators = await this.indikatorRepo.find();
    const findRoot = this.buildIndikatorRootFinder(allIndikators);
    const indikatorMap = new Map(allIndikators.map((i) => [i.id, i]));
    const seen = new Map<string, boolean>();
    const results: any[] = [];
    for (const t of targets) {
      const rootId = findRoot(t.indikatorId);
      const key = `${rootId}_${t.tahun}_${t.roleId}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      const rootIndikator = indikatorMap.get(rootId);
      const jenisLabel = rootIndikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja';
      const statusLabel =
        t.statusValidasi === 'draft' ? 'Belum Diajukan'
        : t.statusValidasi === 'diajukan' ? 'Menunggu Validasi Pimpinan'
        : t.statusValidasi === 'disetujui' ? 'Disetujui'
        : t.statusValidasi === 'ditolak' ? 'Ditolak'
        : t.statusValidasi;
      results.push({
        id: t.id,
        indikatorId: rootId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: rootIndikator?.nama || '',
        nilaiTarget: Number(t.nilaiTarget) || 0,
        roleId: t.roleId,
        roleNama: t.role?.name || '',
        unitNama: t.role?.unitNama || '',
        status: statusLabel,
        createdAt: t.createdAt,
      });
    }
    return results;
  }

  async getIkuPk(roleId: number, userId?: number): Promise<any[]> {
    if (userId) {
      const userRoles = await this.userRoleRepo.find({ where: { userId }, relations: ['role'] });
      const primaryRole = userRoles.find((ur) => ur.isPrimary) ?? userRoles[0];
      const isPimpinan = primaryRole && primaryRole.role.level <= 1;
      if (!isPimpinan) {
        const disposisis = await this.disposisiRepo.find({
          where: { toUserId: userId },
          relations: ['indikator'],
        });
        return disposisis.map((d) => ({
          id: d.id,
          indikatorId: d.indikatorId,
          tahun: d.tahun,
          target: d.indikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja',
          sasaranStrategis: d.indikator?.nama || '',
          jumlahTarget: Number(d.jumlahTarget) || 0,
          roleId,
        }));
      }
    }
    const targets = await this.targetUnitRepo.find({ where: { roleId }, relations: ['indikator'] });
    return targets.map((t) => ({
      id: t.id,
      indikatorId: t.indikatorId,
      tahun: t.tahun,
      target: t.indikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja',
      sasaranStrategis: t.indikator?.nama || '',
      nilaiTarget: Number(t.nilaiTarget) || 0,
      roleId: t.roleId,
    }));
  }

  async create(data: { indikatorId: number; roleId?: number; tahun: string; nilai?: number | null }): Promise<TargetUniversitas | TargetUnit> {
    const indikator = await this.indikatorRepo.findOneBy({ id: data.indikatorId });
    if (indikator?.level === 0) {
      const t = this.targetUniRepo.create({ indikatorId: data.indikatorId, tahun: data.tahun, persentase: data.nilai ?? 0 });
      return this.targetUniRepo.save(t);
    }
    const t = this.targetUnitRepo.create({ indikatorId: data.indikatorId, roleId: data.roleId!, tahun: data.tahun, nilaiTarget: data.nilai ?? null, statusValidasi: 'draft' });
    return this.targetUnitRepo.save(t);
  }

  async getPendingFakultas(roleId: number): Promise<any[]> {
    const targets = await this.targetUnitRepo.find({ where: { roleId, statusValidasi: 'draft' }, relations: ['indikator'] });
    const allIndikators = await this.indikatorRepo.find();
    const findRoot = this.buildIndikatorRootFinder(allIndikators);
    const indikatorMap = new Map(allIndikators.map((i) => [i.id, i]));
    const seen = new Map<string, boolean>();
    const results: any[] = [];
    for (const t of targets) {
      const rootId = findRoot(t.indikatorId);
      const key = `${rootId}_${t.tahun}`;
      if (seen.has(key)) continue;
      seen.set(key, true);
      const rootIndikator = indikatorMap.get(rootId);
      results.push({
        id: t.id,
        indikatorId: rootId,
        tahun: t.tahun,
        target: rootIndikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja',
        sasaranStrategis: rootIndikator?.nama || '',
        nilaiTarget: Number(t.nilaiTarget) || 0,
        status: 'draft',
        createdAt: t.createdAt,
      });
    }
    return results;
  }

  async getTargetItemsByRoot(roleId: number, rootIndikatorId: number, tahun: string): Promise<any[]> {
    const allIndikators = await this.indikatorRepo.find();
    const findRoot = this.buildIndikatorRootFinder(allIndikators);
    const childIds = allIndikators.filter((i) => findRoot(i.id) === rootIndikatorId).map((i) => i.id);
    if (childIds.length === 0) return [];
    const targets = await this.targetUnitRepo.find({
      where: childIds.map((cid) => ({ indikatorId: cid, roleId, tahun })),
      relations: ['indikator'],
    });
    return targets.map((t) => ({
      targetId: t.id,
      indikatorId: t.indikatorId,
      indikatorNama: t.indikator?.nama || '',
      indikatorKode: t.indikator?.kode || '',
      nilaiTarget: Number(t.nilaiTarget) || 0,
      status: t.statusValidasi,
    }));
  }

  async inputTargetFakultas(id: number, nilaiTarget: number): Promise<TargetUnit> {
    await this.targetUnitRepo.update(id, { nilaiTarget, statusValidasi: 'diajukan' });
    return this.targetUnitRepo.findOneOrFail({ where: { id }, relations: ['indikator'] });
  }

  async submitTargetFakultas(items: { targetId: number; targetUniversitas: number }[]): Promise<void> {
    for (const item of items) {
      await this.targetUnitRepo.update(item.targetId, { nilaiTarget: item.targetUniversitas });
    }
  }

  async getForPimpinanValidasi(roleId: number): Promise<any[]> {
    const targets = await this.targetUnitRepo.find({ where: { roleId, statusValidasi: 'diajukan' }, relations: ['indikator'] });
    const allIndikators = await this.indikatorRepo.find();
    const findRoot = this.buildIndikatorRootFinder(allIndikators);
    const indikatorMap = new Map(allIndikators.map((i) => [i.id, i]));
    return targets.map((t) => {
      const rootId = findRoot(t.indikatorId);
      const rootIndikator = indikatorMap.get(rootId);
      return {
        id: t.id,
        indikatorId: t.indikatorId,
        tahun: t.tahun,
        target: t.indikator?.jenis?.toUpperCase() === 'IKU' ? 'Indikator Kinerja Utama' : 'Perjanjian Kerja',
        sasaranStrategis: rootIndikator?.nama || t.indikator?.nama || '',
        nilaiTarget: Number(t.nilaiTarget) || 0,
        status: t.statusValidasi,
        createdAt: t.createdAt,
      };
    });
  }

  async updateStatus(id: number, status: string): Promise<TargetUnit> {
    await this.targetUnitRepo.update(id, { statusValidasi: status });
    return this.targetUnitRepo.findOneOrFail({ where: { id } });
  }

  async getTargetUniversitasByIndikator(indikatorId: number, tahun: string) {
    const t = await this.targetUniRepo.findOne({ where: { indikatorId, tahun } });
    if (!t) return null;
    return { id: t.id, indikatorId: t.indikatorId, tahun: t.tahun, targetAngka: Number(t.persentase), satuan: t.satuan ?? null, tenggat: t.tenggat ?? null };
  }

  async upsertTargetUniversitas(indikatorId: number, _roleId: number, tahun: string, persentase: number, tenggat?: string, satuan?: string): Promise<TargetUniversitas> {
    let target = await this.targetUniRepo.findOne({ where: { indikatorId, tahun } });
    if (target) {
      target.persentase = persentase;
      if (tenggat !== undefined) target.tenggat = tenggat ?? null;
      if (satuan !== undefined) target.satuan = satuan ?? null;
      return this.targetUniRepo.save(target);
    }
    target = this.targetUniRepo.create({ indikatorId, tahun, persentase, tenggat: tenggat ?? null, satuan: satuan ?? null });
    return this.targetUniRepo.save(target);
  }

  async disposisi(indikatorId: number, roleId: number, tahun: string, _assignedTo: number): Promise<TargetUnit | null> {
    const target = await this.targetUnitRepo.findOne({ where: { indikatorId, roleId, tahun } });
    if (target) {
      target.statusValidasi = 'diajukan';
      return this.targetUnitRepo.save(target);
    }
    return null;
  }

  async upsertTargetFakultas(indikatorId: number, roleId: number, tahun: string, nilaiTarget: number): Promise<TargetUnit> {
    let target = await this.targetUnitRepo.findOne({ where: { indikatorId, roleId, tahun } });
    if (target) {
      target.nilaiTarget = nilaiTarget;
      return this.targetUnitRepo.save(target);
    }
    target = this.targetUnitRepo.create({ indikatorId, roleId, tahun, nilaiTarget, statusValidasi: 'draft' });
    return this.targetUnitRepo.save(target);
  }

  async getMasterSKP(tahun?: string, roleId?: number): Promise<any[]> {
    const disposisiWhere: any = {};
    if (tahun) disposisiWhere.tahun = tahun;
    const allDisposisi = await this.disposisiRepo.find({
      where: disposisiWhere,
      relations: ['toUser', 'toUser.userRoles', 'toUser.userRoles.role', 'indikator'],
    });
    if (allDisposisi.length === 0) return [];
    const realisasiWhere: any = {};
    if (tahun) realisasiWhere.tahun = tahun;
    const allRealisasi = await this.realisasiRepo.find({ where: realisasiWhere });
    const userDisposisiMap = new Map<number, Disposisi[]>();
    for (const d of allDisposisi) {
      if (!d.toUserId) continue;
      const list = userDisposisiMap.get(d.toUserId) ?? [];
      list.push(d);
      userDisposisiMap.set(d.toUserId, list);
    }
    const results: any[] = [];
    for (const [userId, disposisiList] of userDisposisiMap.entries()) {
      const user = disposisiList[0].toUser;
      if (!user) continue;
      if (roleId) {
        const hasRole = user.userRoles?.some((ur) => ur.roleId === roleId);
        if (!hasRole) continue;
      }
      const primaryRole = user.userRoles?.find((ur) => ur.isPrimary) ?? user.userRoles?.[0];
      const jumlahIndikator = disposisiList.length;
      const userRealisasi = allRealisasi.filter((r) => r.createdBy === userId);
      const tervalidasi = userRealisasi.filter((r) => r.status === 'approved').length;
      let totalCapaian = 0;
      let countCapaian = 0;
      for (const d of disposisiList) {
        const rel = allRealisasi.find((r) => r.createdBy === userId && r.indikatorId === d.indikatorId);
        if (rel && Number(d.jumlahTarget) > 0) {
          const pct = (Number(rel.realisasiAngka) / Number(d.jumlahTarget)) * 100;
          totalCapaian += Math.min(pct, 100);
          countCapaian++;
        }
      }
      const rataCapaian = countCapaian > 0 ? Math.round((totalCapaian / countCapaian) * 10) / 10 : null;
      let statusSKP: 'draft' | 'submitted' | 'approved' | 'rejected' = 'draft';
      if (tervalidasi === jumlahIndikator && jumlahIndikator > 0) statusSKP = 'approved';
      else if (userRealisasi.length > 0) statusSKP = 'submitted';
      results.push({
        id: userId,
        userId,
        nip: user.nip || '',
        namaPegawai: user.nama || '',
        jabatan: primaryRole?.role?.name || user.jenis || '',
        unitKerja: primaryRole?.role?.unitNama || '',
        roleId: primaryRole?.roleId ?? null,
        periode: disposisiList[0].tahun,
        jumlahIndikator,
        tervalidasi,
        statusSKP,
        rataCapaian,
      });
    }
    return results;
  }

  async updateUserSKPStatus(userId: number, status: 'approved' | 'rejected', tahun?: string): Promise<void> {
    const where: any = { createdBy: userId };
    if (tahun) where.tahun = tahun;
    await this.realisasiRepo.update(where, { status });
  }

  /** Traverse indikator tree to find L0 and return satuan from target_universitas. */
  private async getSatuanForIndikator(indikatorId: number, tahun: string): Promise<string> {
    const allInds = await this.indikatorRepo.find();
    const map = new Map(allInds.map((i) => [i.id, i]));
    let cur = map.get(indikatorId);
    while (cur && cur.parentId) cur = map.get(cur.parentId);
    if (!cur) return '';
    const uniTarget = await this.targetUniRepo.findOne({ where: { indikatorId: cur.id, tahun } });
    return uniTarget?.satuan ?? '';
  }

  async getForValidation(roleId?: number, tahun?: string, statusValidasi?: string): Promise<any[]> {
    const where: any = {};
    if (roleId) where.roleId = roleId;
    if (tahun) where.tahun = tahun;
    if (statusValidasi) where.statusValidasi = statusValidasi;
    const targets = await this.targetUnitRepo.find({ where, relations: ['indikator', 'role'] });
    const results: any[] = [];
    for (let idx = 0; idx < targets.length; idx++) {
      const t = targets[idx];
      const satuan = await this.getSatuanForIndikator(t.indikatorId, t.tahun);
      results.push({
        id: t.id,
        no: idx + 1,
        unitKerja: t.role?.unitNama || '',
        roleNama: t.role?.name || '',
        namaIndikator: t.indikator?.nama || '',
        kodeIndikator: t.indikator?.kode || '',
        nilaiTarget: Number(t.nilaiTarget) || null,
        satuan,
        periode: t.tahun,
        statusValidasi: t.statusValidasi || 'draft',
        catatan: t.catatan,
      });
    }
    return results;
  }

  async updateValidationStatus(id: number, status: 'pending' | 'approved' | 'rejected', catatanAdmin?: string): Promise<any> {
    const mappedStatus = status === 'pending' ? 'diajukan' : status === 'approved' ? 'disetujui' : 'ditolak';
    await this.targetUnitRepo.update(id, { statusValidasi: mappedStatus, catatan: catatanAdmin || null });
    const target = await this.targetUnitRepo.findOne({ where: { id }, relations: ['indikator', 'role'] });
    if (!target) throw new Error('Target not found');
    const satuan = await this.getSatuanForIndikator(target.indikatorId, target.tahun);
    return {
      id: target.id,
      unitKerja: target.role?.unitNama || '',
      roleNama: target.role?.name || '',
      namaIndikator: target.indikator?.nama || '',
      kodeIndikator: target.indikator?.kode || '',
      nilaiTarget: Number(target.nilaiTarget) || null,
      satuan,
      periode: target.tahun,
      statusValidasi: target.statusValidasi,
      catatan: target.catatan,
    };
  }
}
