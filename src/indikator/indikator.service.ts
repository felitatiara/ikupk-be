import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Indikator } from './indikator.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { RealisasiFile } from '../realisasi/realisasi-file.entity';
import { UserRelation } from '../users/user_relation.entity';
import { UserRole } from '../roles/user-role.entity';

const MAX_LEVEL: Record<string, number> = { IKU: 2, PK: 3 };

function isPastYear(tahun: string): boolean {
  return Number(tahun) < new Date().getFullYear();
}

function naturalSortKode(a: { kode: string }, b: { kode: string }): number {
  const ap = a.kode.split('.').map(Number);
  const bp = b.kode.split('.').map(Number);
  for (let i = 0; i < Math.max(ap.length, bp.length); i++) {
    const diff = (ap[i] ?? 0) - (bp[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

@Injectable()
export class IndikatorService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepository: Repository<Indikator>,
    @InjectRepository(TargetUniversitas)
    private targetUniRepo: Repository<TargetUniversitas>,
    @InjectRepository(TargetUnit)
    private targetUnitRepo: Repository<TargetUnit>,
    @InjectRepository(BaselineData)
    private baselineRepo: Repository<BaselineData>,
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
    @InjectRepository(Realisasi)
    private realisasiRepo: Repository<Realisasi>,
    @InjectRepository(RealisasiFile)
    private realisasiFileRepo: Repository<RealisasiFile>,
    @InjectRepository(UserRelation)
    private userRelationRepo: Repository<UserRelation>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
  ) {}

  async findAll(tahun?: string): Promise<Indikator[]> {
    const where: any = {};
    if (tahun) where.tahun = tahun;
    const rows = await this.indikatorRepository.find({ where });
    return rows.sort(naturalSortKode);
  }

  async findOne(id: number): Promise<Indikator | null> {
    return this.indikatorRepository.findOneBy({ id });
  }

  async create(data: Partial<Indikator>): Promise<Indikator> {
    // Enforce level max per jenis
    const jenis = data.jenis?.toUpperCase() ?? '';
    const maxLevel = MAX_LEVEL[jenis];
    if (
      maxLevel !== undefined &&
      data.level !== undefined &&
      data.level > maxLevel
    ) {
      throw new ConflictException(
        `Level maksimum untuk ${jenis} adalah ${maxLevel}`,
      );
    }
    const t = this.indikatorRepository.create(data);
    return this.indikatorRepository.save(t);
  }

  async getCascadeChain(id: number): Promise<number[]> {
    const ind = await this.indikatorRepository.findOneBy({ id });
    if (!ind || !ind.cascadeChain) return [];
    try {
      return JSON.parse(ind.cascadeChain);
    } catch {
      return [];
    }
  }

  async saveCascadeChain(
    id: number,
    chain: (number | number[])[],
  ): Promise<{ success: boolean }> {
    await this.indikatorRepository.update(id, {
      cascadeChain: JSON.stringify(chain),
    });
    return { success: true };
  }

  async update(
    id: number,
    data: Partial<Indikator>,
  ): Promise<Indikator> {
    await this.indikatorRepository.update(id, data);
    const updated = await this.findOne(id);
    if (!updated) throw new NotFoundException(`Indikator ID ${id} tidak ditemukan`);
    return updated;
  }

  async remove(id: number): Promise<void> {
    const indikator = await this.indikatorRepository.findOneBy({ id });
    if (!indikator)
      throw new NotFoundException(`Indikator ID ${id} tidak ditemukan`);
    await this.indikatorRepository.delete(id);
  }

  async removeAll(tahun?: string): Promise<void> {
    if (tahun) {
      // Hapus semua indikator untuk tahun tertentu (termasuk arsip — admin bisa koreksi)
      await this.indikatorRepository.delete({ tahun });
    } else {
      // Tanpa tahun: HANYA hapus tahun sekarang ke atas — arsip tahun lampau tetap aman
      const currentYear = new Date().getFullYear();
      await this.indikatorRepository
        .createQueryBuilder()
        .delete()
        .where('CAST(tahun AS INTEGER) >= :year', { year: currentYear })
        .execute();
    }
  }

  async findSubindikator(tahun?: string) {
    if (tahun) {
      return this.indikatorRepository.query(
        "SELECT * FROM indikator WHERE array_length(string_to_array(kode, '.'), 1) = 3 AND tahun = $1",
        [tahun],
      );
    }
    return this.indikatorRepository.query(
      "SELECT * FROM indikator WHERE array_length(string_to_array(kode, '.'), 1) = 3",
    );
  }

  /**
   * Copy semua indikator dari satu tahun ke tahun baru.
   * Berguna saat struktur indikator tidak banyak berubah tahun ke tahun.
   */
  async copyFromYear(
    fromTahun: string,
    toTahun: string,
  ): Promise<{ copied: number }> {
    if (isPastYear(toTahun)) {
      throw new ForbiddenException(
        `Tidak bisa copy ke tahun ${toTahun} karena sudah lampau`,
      );
    }

    const existing = await this.indikatorRepository.find({
      where: { tahun: toTahun },
    });
    if (existing.length > 0) {
      throw new ConflictException(
        `Indikator untuk tahun ${toTahun} sudah ada (${existing.length} data). Hapus dulu sebelum copy.`,
      );
    }

    const sourceIndikators = await this.indikatorRepository.find({
      where: { tahun: fromTahun },
      order: { level: 'ASC', kode: 'ASC' },
    });

    if (sourceIndikators.length === 0) {
      throw new NotFoundException(
        `Tidak ada indikator untuk tahun ${fromTahun}`,
      );
    }

    // Copy level per level agar parent_id bisa di-remap dengan benar
    const idMap = new Map<number, number>();
    for (let lvl = 0; lvl <= 3; lvl++) {
      const items = sourceIndikators.filter((i) => i.level === lvl);
      for (const src of items) {
        const newParentId =
          src.parentId != null ? (idMap.get(src.parentId) ?? null) : null;
        const saved = await this.indikatorRepository.save(
          this.indikatorRepository.create({
            jenis: src.jenis,
            kode: src.kode,
            nama: src.nama,
            tahun: toTahun,
            level: src.level,
            parentId: newParentId,
            jenisData: src.jenisData,
            sumberData: String(src.sumberData || 'repository'),
          }),
        );
        idMap.set(src.id, saved.id);
      }
    }

    return { copied: sourceIndikators.length };
  }

  // ── Baseline helper ────────────────────────────────────────────────────────

  private async findBaselineForIndikator(
    indikatorId: number,
    tahun: string,
    allIndikators: Indikator[],
  ): Promise<number | null> {
    let currentId: number | null = indikatorId;
    while (currentId !== null) {
      const ind = allIndikators.find((i) => i.id === currentId);
      if (!ind) return null;
      if (ind.jenisData) {
        const bl = await this.baselineRepo.findOne({
          where: { jenisData: ind.jenisData, tahun },
        });
        if (bl) return Number(bl.jumlah);
      }
      currentId = ind.parentId ?? null;
    }
    return null;
  }

  // ── Grouped views ──────────────────────────────────────────────────────────

  async findGrouped(jenis: string, tahun: string, roleId?: number) {
    const all = (await this.indikatorRepository.find({ where: { jenis, tahun } }))
      .sort(naturalSortKode);

    const roots = all.filter((i) => i.level === 0);
    const result: any[] = [];

    for (const root of roots) {
      const level1 = all.filter((i) => i.level === 1 && i.parentId === root.id);
      const subIndikators: any[] = [];

      for (const l1 of level1) {
        const level2 = all.filter((i) => i.level === 2 && i.parentId === l1.id);

        let nilaiTarget: number | null = null;
        let targetId: number | null = null;
        if (roleId) {
          const ut = await this.targetUnitRepo.findOne({
            where: { indikatorId: l1.id, roleId, tahun },
          });
          nilaiTarget = ut ? Number(ut.nilaiTarget) : null;
          targetId = ut?.id ?? null;
        }
        if (nilaiTarget === null) {
          const ut = await this.targetUnitRepo.findOne({
            where: { indikatorId: l1.id, tahun },
          });
          nilaiTarget = ut ? Number(ut.nilaiTarget) : null;
          if (!targetId) targetId = ut?.id ?? null;
        }

        const baselineJumlahSub = await this.findBaselineForIndikator(
          l1.id,
          tahun,
          all,
        );

        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          level: l1.level,
          tahun: l1.tahun,
          parentId: l1.parentId,
          targetId,
          nilaiTarget,
          sumberData: String(l1.sumberData || 'repository'),
          baselineJumlah: baselineJumlahSub,
          children: await Promise.all(
            level2.map(async (l2) => {
              let childNilaiTarget: number | null = null;
              let childTargetId: number | null = null;
              let childSatuan: string | null = null;
              if (roleId) {
                const ct = await this.targetUnitRepo.findOne({
                  where: { indikatorId: l2.id, roleId, tahun },
                });
                childNilaiTarget = ct ? Number(ct.nilaiTarget) : null;
                childTargetId = ct?.id ?? null;
              }
              if (childNilaiTarget === null) {
                const ct = await this.targetUnitRepo.findOne({
                  where: { indikatorId: l2.id, tahun },
                });
                childNilaiTarget = ct ? Number(ct.nilaiTarget) : null;
                if (!childTargetId) childTargetId = ct?.id ?? null;
              }
              // Fallback: cek target_universitas (target yang di-set admin di master indikator)
              if (childNilaiTarget === null) {
                const uniT = await this.targetUniRepo.findOne({
                  where: { indikatorId: l2.id, tahun },
                });
                if (uniT) {
                  childNilaiTarget = Number(uniT.persentase);
                  if (!childTargetId) childTargetId = uniT.id;
                  childSatuan = uniT.satuan;
                }
              }

              // Level 3 — hanya PK
              const level3 = all.filter(
                (i) => i.level === 3 && i.parentId === l2.id,
              );
              const childBaseline = await this.findBaselineForIndikator(
                l2.id,
                tahun,
                all,
              );

              return {
                id: l2.id,
                kode: l2.kode,
                nama: l2.nama,
                level: l2.level,
                tahun: l2.tahun,
                targetId: childTargetId,
                nilaiTarget: childNilaiTarget,
                satuan: childSatuan,
                baselineJumlah: childBaseline,
                sumberData: String(l2.sumberData || 'repository'),
                children: await Promise.all(
                  level3.map(async (l3) => {
                    // PK: target disimpan di target_universitas per L3
                    const l3UniTarget = await this.targetUniRepo.findOne({
                      where: { indikatorId: l3.id, tahun },
                    });
                    return {
                      id: l3.id,
                      kode: l3.kode,
                      nama: l3.nama,
                      level: l3.level,
                      tahun: l3.tahun,
                      targetId: l3UniTarget?.id ?? null,
                      nilaiTarget: l3UniTarget
                        ? Number(l3UniTarget.persentase)
                        : null,
                      tenggat: l3UniTarget?.tenggat ?? null,
                      satuan: l3UniTarget?.satuan ?? null,
                      sumberData: String(l3.sumberData || 'repository'),
                    };
                  }),
                ),
              };
            }),
          ),
        });
      }

      const uniTarget = await this.targetUniRepo.findOne({
        where: { indikatorId: root.id, tahun },
      });
      const rootBaseline = await this.findBaselineForIndikator(
        root.id,
        tahun,
        all,
      );

      const storedTarget = uniTarget ? Number(uniTarget.persentase) : null;
      // If a baseline exists use percentage formula; otherwise treat stored value as absolute
      const targetAbsolut =
        storedTarget !== null
          ? rootBaseline
            ? Math.round((storedTarget / 100) * rootBaseline)
            : storedTarget
          : null;

      result.push({
        id: root.id,
        kode: root.kode,
        nama: root.nama,
        tahun: root.tahun,
        persentaseTarget: storedTarget,
        targetAbsolut,
        satuan: uniTarget?.satuan ?? null,
        tenggat: uniTarget?.tenggat ?? null,
        baselineJumlah: rootBaseline,
        subIndikators,
      });
    }

    return result;
  }

  async findGroupedForUser(
    jenis: string,
    tahun: string,
    userId: number,
    roleId: number,
  ) {
    // Level role aktif user saat ini
    const currentUserRole = await this.userRoleRepo.findOne({
      where: { roleId },
      relations: ['role'],
    });
    const currentRoleLevel = currentUserRole?.role?.level ?? 4;

    const disposisis = await this.disposisiRepo.find({
      where: { toUserId: userId, tahun },
      relations: ['fromUser'],
    });

    // Bulk-load level primary role dari setiap pengirim
    const fromUserIds = [
      ...new Set(
        disposisis
          .map((d) => d.fromUserId)
          .filter((id): id is number => id !== null && id !== userId),
      ),
    ];
    const fromUserLevelMap = new Map<number, number>();
    if (fromUserIds.length > 0) {
      const fromUserPrimaryRoles = await this.userRoleRepo.find({
        where: { userId: In(fromUserIds), isPrimary: true },
        relations: ['role'],
      });
      for (const ur of fromUserPrimaryRoles) {
        fromUserLevelMap.set(ur.userId, ur.role?.level ?? 99);
      }
    }

    const disposisiByIndikator = new Map<number, number>();

    // Terima disposisi dari siapapun yang levelnya lebih tinggi di hierarki.
    // Karena Dekan dan Wakil Dekan sama-sama level 1, Dekan → Wadek
    // diterima via kondisi: fromLevel <= currentRoleLevel && fromLevel <= 1.
    const receivedFromOthers = disposisis.filter((d) => {
      if (d.fromUserId === null || d.fromUserId === userId) return false;
      const fromLevel = fromUserLevelMap.get(d.fromUserId) ?? 99;
      // Sama level hanya diizinkan di level 0–1 (Dekan/Wadek satu rumpun)
      if (fromLevel === currentRoleLevel) return currentRoleLevel <= 1;
      return fromLevel < currentRoleLevel;
    });
    for (const d of receivedFromOthers) {
      disposisiByIndikator.set(
        d.indikatorId,
        (disposisiByIndikator.get(d.indikatorId) ?? 0) + Number(d.jumlahTarget),
      );
    }

    // Jika user mendisposisikan ke diri sendiri, tampilkan jumlah self-disposisi
    // sebagai target personal (bukan jumlah total yang diterima dari atasan)
    const selfDisposisis = disposisis.filter((d) => d.fromUserId === userId);
    for (const d of selfDisposisis) {
      disposisiByIndikator.set(d.indikatorId, Number(d.jumlahTarget));
    }

    // Auto-cascade: jika roleId user ada dalam cascadeChain suatu L0,
    // otomatis terima semua L1 di bawahnya tanpa disposisi manual
    const allInds = await this.indikatorRepository.find({
      where: { jenis, tahun },
    });
    const l0s = allInds.filter((i) => i.level === 0);
    const cascadedL0Ids = new Set<number>();
    for (const l0 of l0s) {
      if (!l0.cascadeChain) continue;
      try {
        const chain = JSON.parse(l0.cascadeChain) as unknown[];
        const firstStep = chain[0];
        const firstRoles = Array.isArray(firstStep)
          ? (firstStep as unknown[]).map(Number)
          : [Number(firstStep)];
        if (firstRoles.includes(Number(roleId))) cascadedL0Ids.add(l0.id);
      } catch {
        /* skip malformed chain */
      }
    }

    const fullGrouped = await this.findGrouped(jenis, tahun, roleId);

    if (cascadedL0Ids.size > 0) {
      type CascadeLeaf = {
        id: number;
        nilaiTarget: number | null;
        children?: CascadeLeaf[];
      };
      type CascadeGroup = {
        id: number;
        subIndikators: Array<CascadeLeaf & { children?: CascadeLeaf[] }>;
      };
      const typedGrouped = fullGrouped as CascadeGroup[];
      for (const group of typedGrouped) {
        if (!cascadedL0Ids.has(group.id)) continue;
        for (const sub of group.subIndikators) {
          // Cascade L2 children dulu — nilaiTarget berisi fallback dari target_universitas
          for (const child of sub.children ?? []) {
            if (
              !disposisiByIndikator.has(child.id) &&
              child.nilaiTarget != null
            ) {
              disposisiByIndikator.set(child.id, Number(child.nilaiTarget));
            }
            // Cascade ke L3 grandchildren (PK)
            for (const gc of child.children ?? []) {
              if (!disposisiByIndikator.has(gc.id) && gc.nilaiTarget != null) {
                disposisiByIndikator.set(gc.id, Number(gc.nilaiTarget));
              }
            }
          }
          // L1 target: gunakan target_unit jika ada, jika tidak jumlahkan L2 children
          if (!disposisiByIndikator.has(sub.id)) {
            const childSum = (sub.children ?? [])
              .filter((c: CascadeLeaf) => c.nilaiTarget != null)
              .reduce((s: number, c: CascadeLeaf) => s + Number(c.nilaiTarget), 0);
            disposisiByIndikator.set(sub.id, sub.nilaiTarget ?? childSum);
          }
        }
      }
    }

    if (disposisiByIndikator.size === 0) return [];

    // Build indikatorId → L0 group id map for fromUser resolution
    type GcNode = { id: number };
    type ChildNode = { id: number; children?: GcNode[] };
    type SubNode = { id: number; children: ChildNode[] };
    type GroupNode = { id: number; subIndikators: SubNode[] };

    const indToL0Map = new Map<number, number>();
    for (const group of fullGrouped as GroupNode[]) {
      for (const sub of group.subIndikators) {
        indToL0Map.set(sub.id, group.id);
        for (const child of sub.children) {
          indToL0Map.set(child.id, group.id);
          for (const gc of child.children ?? []) {
            indToL0Map.set(gc.id, group.id);
          }
        }
      }
    }

    // Map L0 group id → fromUser name (only for non-cascaded, i.e. penerima 2+)
    const fromUserNameByL0 = new Map<number, string>();
    for (const d of receivedFromOthers) {
      const l0Id = indToL0Map.get(d.indikatorId);
      const fromUser = d['fromUser'] as { nama?: string } | null | undefined;
      const fromUserNama = fromUser?.nama;
      if (l0Id && fromUserNama && !cascadedL0Ids.has(l0Id)) {
        if (!fromUserNameByL0.has(l0Id)) {
          fromUserNameByL0.set(l0Id, fromUserNama);
        }
      }
    }

    const assignedIndikatorIds = new Set(disposisiByIndikator.keys());
    const filtered: any[] = [];

    for (const group of fullGrouped) {
      const filteredSubs: any[] = [];
      for (const sub of group.subIndikators) {
        const isSubAssigned = assignedIndikatorIds.has(sub.id);

        // level-2 children that are directly assigned
        const filteredChildren = sub.children
          .map((c: any) => {
            const isChildAssigned = assignedIndikatorIds.has(c.id);
            // level-3 grandchildren that are assigned (PK rincian)
            const filteredGrandchildren = (c.children ?? [])
              .filter((gc: any) => assignedIndikatorIds.has(gc.id))
              .map((gc: any) => ({
                ...gc,
                disposisiJumlah: disposisiByIndikator.get(gc.id) ?? null,
              }));

            if (isChildAssigned) {
              const enrichedGrandchildren = (c.children ?? []).map((gc: any) => ({
                ...gc,
                disposisiJumlah: disposisiByIndikator.get(gc.id) ?? null,
              }));
              return {
                ...c,
                disposisiJumlah: disposisiByIndikator.get(c.id) ?? null,
                children: enrichedGrandchildren,
              };
            } else if (filteredGrandchildren.length > 0) {
              return { ...c, children: filteredGrandchildren };
            }
            return null;
          })
          .filter(Boolean);

        if (isSubAssigned) {
          // Enrich all L2 children and L3 grandchildren with disposisiJumlah from cascade map
          const enrichedChildren = (sub.children ?? []).map((c: any) => ({
            ...c,
            disposisiJumlah: disposisiByIndikator.get(c.id) ?? null,
            children: (c.children ?? []).map((gc: any) => ({
              ...gc,
              disposisiJumlah: disposisiByIndikator.get(gc.id) ?? null,
            })),
          }));
          filteredSubs.push({
            ...sub,
            disposisiJumlah: disposisiByIndikator.get(sub.id) ?? null,
            children: enrichedChildren,
          });
        } else if (filteredChildren.length > 0) {
          filteredSubs.push({ ...sub, children: filteredChildren });
        }
      }
      if (filteredSubs.length > 0) {
        const fromUserNama = cascadedL0Ids.has(group.id)
          ? 'Dekan'
          : (fromUserNameByL0.get(group.id) ?? null);
        filtered.push({ ...group, subIndikators: filteredSubs, fromUserNama });
      }
    }

    // Collect ALL indikator IDs including PK level-3 grandchildren for realisasi query
    const allTargetIds = new Set<number>([...assignedIndikatorIds]);
    for (const group of filtered) {
      for (const sub of group.subIndikators) {
        for (const child of sub.children ?? []) {
          for (const gc of child.children ?? []) {
            allTargetIds.add(gc.id);
          }
        }
      }
    }

    const indikatorIds = [...allTargetIds];
    const realisasiMap = new Map<number, number>();
    const validRealisasiMap = new Map<number, number>();
    if (indikatorIds.length > 0) {
      const realisasiList = await this.realisasiRepo
        .createQueryBuilder('r')
        .where('r.indikator_id IN (:...indIds)', { indIds: indikatorIds })
        .andWhere('r.created_by = :userId', { userId })
        .andWhere('r.tahun = :tahun', { tahun })
        .getMany();
      for (const r of realisasiList) {
        realisasiMap.set(
          r.indikatorId,
          (realisasiMap.get(r.indikatorId) ?? 0) + Number(r.realisasiAngka),
        );
        if (r.validFileCount !== null) {
          validRealisasiMap.set(
            r.indikatorId,
            (validRealisasiMap.get(r.indikatorId) ?? 0) +
              Number(r.validFileCount),
          );
        }
      }

      // Also count files uploaded directly to realisasi_files (ikupk-type).
      // This ensures the chart reflects uploaded files even before a formal
      // realisasi record is submitted.
      const uploadedFiles = await this.realisasiFileRepo.find({
        where: { indikatorId: In(indikatorIds), createdBy: userId, tahun },
      });
      const fileCountMap = new Map<number, number>();
      for (const f of uploadedFiles) {
        if (f.indikatorId === null) continue;
        fileCountMap.set(f.indikatorId, (fileCountMap.get(f.indikatorId) ?? 0) + 1);
      }
      for (const [id, count] of fileCountMap) {
        // Use the larger of: formal realisasi submission vs raw file count
        realisasiMap.set(id, Math.max(realisasiMap.get(id) ?? 0, count));
      }
    }

    for (const group of filtered) {
      for (const sub of group.subIndikators) {
        // Aggregate level-3 (PK rincian) realisasi up to sub
        let subReal = realisasiMap.get(sub.id) ?? 0;
        let subValid: number | null = validRealisasiMap.get(sub.id) ?? null;

        for (const child of (sub.children ?? []) as {
          id: number;
          realisasiJumlah: number;
          validRealisasiJumlah: number | null;
          children?: {
            id: number;
            realisasiJumlah: number;
            validRealisasiJumlah: number | null;
          }[];
        }[]) {
          const childReal = realisasiMap.get(child.id) ?? 0;
          const childValid = validRealisasiMap.get(child.id) ?? null;
          child.realisasiJumlah = childReal;
          child.validRealisasiJumlah = childValid;
          subReal += childReal;
          if (childValid !== null) subValid = (subValid ?? 0) + childValid;
          for (const gc of child.children ?? []) {
            const gcReal = realisasiMap.get(gc.id) ?? 0;
            const gcValid = validRealisasiMap.get(gc.id) ?? null;
            gc.realisasiJumlah = gcReal;
            gc.validRealisasiJumlah = gcValid;
            subReal += gcReal;
            if (gcValid !== null) subValid = (subValid ?? 0) + gcValid;
          }
        }

        sub.realisasiJumlah = subReal;
        sub.validRealisasiJumlah = subValid;
      }
    }

    return filtered;
  }

  async findPengajuanGrouped(
    jenis: string,
    tahun: string,
    roleId: number,
  ): Promise<any[]> {
    const grouped = await this.findGrouped(jenis, tahun, roleId);
    const result: any[] = [];
    for (const group of grouped) {
      if (group.persentaseTarget === null) continue;
      const allFilled = group.subIndikators.every((s: any) =>
        s.children.every(
          (c: any) => c.nilaiTarget !== null && c.nilaiTarget !== undefined,
        ),
      );
      result.push({
        ...group,
        jenis,
        tahun,
        status: allFilled ? 'sudah_diisi' : 'belum_diisi',
      });
    }
    return result;
  }

  /**
   * Laporan hierarki IKU/PK dengan target dan realisasi untuk export Excel.
   * Mengembalikan struktur: sasaran (level 0) → subindikator (level 1) → children (level 2+)
   * Tiap node dilengkapi: nilaiTarget, targetKualitas(%), realisasiKuantitas, realisasiKualitas(%), persenCapaian
   */
  async getLaporanWithRealisasi(
    jenis: string,
    tahun: string,
    roleId: number,
    periode?: string,
  ): Promise<any[]> {
    // Ambil struktur hierarki dengan target & baseline yang sudah dihitung
    const grouped = await this.findGrouped(jenis, tahun, roleId);

    // Ambil semua indikator ID untuk jenis dan tahun ini
    const allIndikators = await this.indikatorRepository.find({
      where: { jenis, tahun },
    });
    const allIds = allIndikators.map((i) => i.id);

    // Ambil realisasi untuk semua indikator
    const realisasiList =
      allIds.length > 0
        ? await this.realisasiRepo.find({
            where: {
              indikatorId: In(allIds),
              roleId,
              tahun,
              ...(periode ? { periode } : {}),
            },
          })
        : [];

    const realisasiMap = new Map<number, number>();
    for (const r of realisasiList) {
      realisasiMap.set(
        r.indikatorId,
        (realisasiMap.get(r.indikatorId) ?? 0) + Number(r.realisasiAngka),
      );
    }

    // Hitung kualitas (%) dari nilaiTarget / baseline * 100
    const calcKualitas = (
      nilai: number | null,
      baseline: number | null,
    ): number | null => {
      if (!nilai || !baseline || baseline === 0) return null;
      return Number(((nilai / baseline) * 100).toFixed(1));
    };

    const enrichNode = (node: any, fallbackBaseline: number | null) => {
      const bl: number | null = node.baselineJumlah ?? fallbackBaseline;
      const realisasiKuantitas = realisasiMap.get(node.id) ?? 0;
      const realisasiKualitas = calcKualitas(realisasiKuantitas, bl);
      const targetKualitas = calcKualitas(node.nilaiTarget, bl);
      const persenCapaian =
        node.nilaiTarget && node.nilaiTarget > 0
          ? Number(((realisasiKuantitas / node.nilaiTarget) * 100).toFixed(1))
          : 0;
      return {
        ...node,
        realisasiKuantitas,
        realisasiKualitas,
        targetKualitas,
        persenCapaian,
      };
    };

    return grouped.map((group) => {
      const enrichedSubs = (group.subIndikators ?? []).map((sub: any) => {
        const enrichedSub = enrichNode(sub, group.baselineJumlah);
        const enrichedChildren = (sub.children ?? []).map((child: any) => {
          const enrichedChild = enrichNode(
            child,
            sub.baselineJumlah ?? group.baselineJumlah,
          );
          const enrichedL3 = (child.children ?? []).map((l3: any) =>
            enrichNode(
              l3,
              child.baselineJumlah ??
                sub.baselineJumlah ??
                group.baselineJumlah,
            ),
          );
          return { ...enrichedChild, children: enrichedL3 };
        });
        return { ...enrichedSub, children: enrichedChildren };
      });

      // Hitung S.D (progres kumulatif sasaran) = total realisasi / targetAbsolut * 100
      const totalRealisasi = enrichedSubs.reduce((acc: number, sub: any) => {
        const subVal =
          sub.realisasiKuantitas > 0
            ? sub.realisasiKuantitas
            : sub.children.reduce(
                (a: number, c: any) => a + (c.realisasiKuantitas ?? 0),
                0,
              );
        return acc + subVal;
      }, 0);
      const sdPersen =
        group.targetAbsolut && group.targetAbsolut > 0
          ? Number(((totalRealisasi / group.targetAbsolut) * 100).toFixed(1))
          : 0;

      return { ...group, sdPersen, subIndikators: enrichedSubs };
    });
  }

  async getMonitoringBawahan(
    jenis: string,
    tahun: string,
    userId: number,
    roleLevel: number,
  ) {
    // 1. Ambil daftar bawahan berdasarkan level role
    type BawahanItem = {
      id: number;
      nama: string;
      email: string;
      roleName: string;
      roleLevel: number;
      unitNama: string | null;
    };
    const bawahanList: BawahanItem[] = [];

    if (roleLevel <= 1) {
      // Dekan / Wadek: semua user non-admin (role level >= 2)
      const userRoles = await this.userRoleRepo.find({
        where: { isPrimary: true },
        relations: ['user', 'role'],
      });
      const seen = new Set<number>();
      for (const ur of userRoles) {
        if (ur.user && ur.role && ur.role.level >= 2 && !seen.has(ur.user.id)) {
          seen.add(ur.user.id);
          bawahanList.push({
            id: ur.user.id,
            nama: ur.user.nama,
            email: (ur.user as unknown as { email?: string }).email ?? '',
            roleName: ur.role.name,
            roleLevel: ur.role.level,
            unitNama: ur.role.unitNama ?? null,
          });
        }
      }
    } else {
      // Kajur / Kaprodi: bawahan langsung via user_relations
      const relations = await this.userRelationRepo.find({
        where: { parentId: userId },
        relations: ['user', 'user.userRoles', 'user.userRoles.role'],
      });
      for (const rel of relations) {
        if (!rel.user) continue;
        const allRoles = rel.user.userRoles ?? [];
        // In the context of being supervised by Kajur/Kaprodi, use the role with
        // the highest level number (least authoritative = dosen context),
        // so a multi-role user (e.g. Wakil Dekan + Dosen) shows as "Dosen".
        const contextRole =
          allRoles.length > 0
            ? allRoles.reduce((best, ur) =>
                (ur.role?.level ?? 0) > (best.role?.level ?? 0) ? ur : best
              )
            : (allRoles[0] ?? null);
        bawahanList.push({
          id: rel.user.id,
          nama: rel.user.nama,
          email: (rel.user as unknown as { email?: string }).email ?? '',
          roleName: contextRole?.role?.name ?? '',
          roleLevel: contextRole?.role?.level ?? 4,
          unitNama: contextRole?.role?.unitNama ?? null,
        });
      }
    }

    const bawahanIds = bawahanList.map((b) => b.id);

    // 2. Bangun baris dari leaf indikator
    const all = (await this.indikatorRepository.find({ where: { jenis, tahun } }))
      .sort(naturalSortKode);
    const roots = all.filter((i) => i.level === 0);
    const isPK = jenis.toUpperCase() === 'PK';

    type LeafRow = {
      groupId: number;
      groupKode: string;
      groupNama: string;
      subId: number;
      subKode: string;
      subNama: string;
      leafId: number;
      leafKode: string;
      leafNama: string;
      nilaiTarget: number | null;
      satuan: string | null;
      disposisiByUser: Record<number, number>;
      realisasiByUser: Record<number, number>;
    };
    const leafRows: LeafRow[] = [];

    for (const root of roots) {
      const level1 = all.filter((i) => i.level === 1 && i.parentId === root.id);
      for (const l1 of level1) {
        const level2 = all.filter((i) => i.level === 2 && i.parentId === l1.id);
        if (!isPK) {
          for (const l2 of level2) {
            const uniT = await this.targetUniRepo.findOne({
              where: { indikatorId: l2.id, tahun },
            });
            leafRows.push({
              groupId: root.id,
              groupKode: root.kode,
              groupNama: root.nama,
              subId: l1.id,
              subKode: l1.kode,
              subNama: l1.nama,
              leafId: l2.id,
              leafKode: l2.kode,
              leafNama: l2.nama,
              nilaiTarget: uniT ? Number(uniT.persentase) : null,
              satuan: uniT?.satuan ?? null,
              disposisiByUser: {},
              realisasiByUser: {},
            });
          }
        } else {
          for (const l2 of level2) {
            const level3 = all.filter(
              (i) => i.level === 3 && i.parentId === l2.id,
            );
            for (const l3 of level3) {
              const uniT = await this.targetUniRepo.findOne({
                where: { indikatorId: l3.id, tahun },
              });
              leafRows.push({
                groupId: root.id,
                groupKode: root.kode,
                groupNama: root.nama,
                subId: l1.id,
                subKode: l1.kode,
                subNama: l1.nama,
                leafId: l3.id,
                leafKode: l3.kode,
                leafNama: l3.nama,
                nilaiTarget: uniT ? Number(uniT.persentase) : null,
                satuan: uniT?.satuan ?? null,
                disposisiByUser: {},
                realisasiByUser: {},
              });
            }
          }
        }
      }
    }

    // 3. Isi data disposisi per bawahan
    if (bawahanIds.length > 0) {
      const disposisiList = await this.disposisiRepo.find({
        where: { toUserId: In(bawahanIds), tahun },
      });
      for (const d of disposisiList) {
        const row = leafRows.find((r) => r.leafId === d.indikatorId);
        if (row)
          row.disposisiByUser[d.toUserId] =
            (row.disposisiByUser[d.toUserId] ?? 0) + Number(d.jumlahTarget);
      }
    }

    // 4. Isi data realisasi (submitted, tanpa validasi) per bawahan
    if (bawahanIds.length > 0 && leafRows.length > 0) {
      const leafIds = leafRows.map((r) => r.leafId);
      const realisasiList = await this.realisasiRepo.find({
        where: { createdBy: In(bawahanIds), indikatorId: In(leafIds), tahun },
      });
      for (const r of realisasiList) {
        const row = leafRows.find((lr) => lr.leafId === r.indikatorId);
        if (row)
          row.realisasiByUser[r.createdBy] =
            (row.realisasiByUser[r.createdBy] ?? 0) + Number(r.realisasiAngka);
      }
      // Also count raw uploaded files (realisasi_files) and take the max
      const filesList = await this.realisasiFileRepo.find({
        where: { indikatorId: In(leafIds), createdBy: In(bawahanIds), tahun },
      });
      const fileCountMap = new Map<string, number>();
      for (const f of filesList) {
        if (f.indikatorId === null) continue;
        const key = `${f.createdBy}:${f.indikatorId}`;
        fileCountMap.set(key, (fileCountMap.get(key) ?? 0) + 1);
      }
      for (const row of leafRows) {
        for (const uid of bawahanIds) {
          const fc = fileCountMap.get(`${uid}:${row.leafId}`) ?? 0;
          if (fc > (row.realisasiByUser[uid] ?? 0))
            row.realisasiByUser[uid] = fc;
        }
      }
    }

    return { bawahanList, rows: leafRows };
  }

  /** Daftar tahun yang sudah punya indikator (untuk dropdown pilih tahun) */
  async findAvailableYears(): Promise<string[]> {
    const rows = await this.indikatorRepository
      .createQueryBuilder('i')
      .select('DISTINCT i.tahun', 'tahun')
      .orderBy('i.tahun', 'DESC')
      .getRawMany();
    return rows.map((r) => r.tahun);
  }
}
