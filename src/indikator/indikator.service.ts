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
    tahun?: string,
    skipMaterialize = false,
  ): Promise<{ success: boolean }> {
    await this.indikatorRepository.update(id, {
      cascadeChain: chain.length > 0 ? JSON.stringify(chain) : null,
    });
    if (chain.length > 0 && !skipMaterialize) {
      await this.materializeCascadeDisposisi(id, chain, false, tahun);
    }
    return { success: true };
  }

  private async getSubtreeIds(l1Id: number): Promise<number[]> {
    const result: number[] = [l1Id];
    let current = [l1Id];
    while (current.length > 0) {
      const children = await this.indikatorRepository.find({
        where: { parentId: In(current) },
        select: ['id'],
      });
      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) break;
      result.push(...childIds);
      current = childIds;
    }
    return result;
  }

  async materializeCascadeDisposisi(
    l1Id: number,
    chain: (number | number[])[],
    onlyNewYears = false,
    targetTahun?: string,
  ): Promise<void> {
    const subtreeIds = await this.getSubtreeIds(l1Id);

    // Normalize chain: each step = array of role IDs
    const steps: number[][] = chain
      .map((step) =>
        Array.isArray(step) ? (step as unknown[]).map(Number) : [Number(step)],
      )
      .filter((s) => s.length > 0);

    if (steps.length === 0) return;

    // Find years with targets for this subtree (filtered to targetTahun if provided)
    const existingTargets = await this.targetUniRepo.find({
      where: targetTahun
        ? { indikatorId: In(subtreeIds), tahun: targetTahun }
        : { indikatorId: In(subtreeIds) },
    });
    if (existingTargets.length === 0) return;

    const tahunSet = new Set(existingTargets.map((t) => t.tahun));
    const targetByKey = new Map<string, number>(
      existingTargets.map((t) => [
        `${t.indikatorId}:${t.tahun}`,
        Number(t.persentase ?? 0),
      ]),
    );

    // Resolve users per step (by role IDs)
    const stepUserIds: number[][] = [];
    for (const roleIds of steps) {
      const urs = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });
      const seen = new Set<number>();
      const uids: number[] = [];
      for (const ur of urs) {
        if (!seen.has(ur.userId)) {
          seen.add(ur.userId);
          uids.push(ur.userId);
        }
      }
      stepUserIds.push(uids);
    }

    const allChainUserIds = [...new Set(stepUserIds.flat())];
    if (allChainUserIds.length === 0) return;

    // Load supervisor relationships for chain users
    const relations = await this.userRelationRepo.find({
      where: { userId: In(allChainUserIds) },
    });
    const parentsByUser = new Map<number, Set<number>>();
    for (const rel of relations) {
      if (!parentsByUser.has(rel.userId))
        parentsByUser.set(rel.userId, new Set());
      parentsByUser.get(rel.userId)!.add(rel.parentId);
    }

    for (const tahun of tahunSet) {
      // When called from importBulk, skip years that already have disposisi
      // so manual re-disposisi adjustments made by supervisors are preserved.
      if (onlyNewYears) {
        const existing = await this.disposisiRepo.findOne({
          where: {
            indikatorId: In(subtreeIds),
            tahun,
            toUserId: In(allChainUserIds),
          },
        });
        if (existing) continue;
      }

      // Delete existing disposisi for chain users in this subtree+tahun
      await this.disposisiRepo
        .createQueryBuilder()
        .delete()
        .where('indikator_id IN (:...ids)', { ids: subtreeIds })
        .andWhere('tahun = :tahun', { tahun })
        .andWhere('to_user_id IN (:...userIds)', {
          userIds: allChainUserIds,
        })
        .execute();

      // Track created IDs for parentId linking: `${userId}:${indikatorId}` → saved id
      const createdIds = new Map<string, number>();

      for (let si = 0; si < steps.length; si++) {
        const users = stepUserIds[si];
        const prevSet =
          si > 0 ? new Set(stepUserIds[si - 1]) : new Set<number>();

        const toCreate: Partial<Disposisi>[] = [];
        const toCreateMeta: {
          userId: number;
          indikatorId: number;
        }[] = [];

        for (const userId of users) {
          let fromUserId: number | null = null;
          if (si > 0) {
            const userParents = parentsByUser.get(userId) ?? new Set<number>();
            for (const p of userParents) {
              if (prevSet.has(p)) {
                fromUserId = p;
                break;
              }
            }
          }

          for (const indikatorId of subtreeIds) {
            const jumlahTarget =
              targetByKey.get(`${indikatorId}:${tahun}`) ?? 0;
            if (jumlahTarget <= 0) continue;

            const parentId =
              fromUserId !== null
                ? (createdIds.get(`${fromUserId}:${indikatorId}`) ?? null)
                : null;

            toCreate.push({
              indikatorId,
              tahun,
              fromUserId,
              toUserId: userId,
              jumlahTarget,
              parentId,
              status: 'diterima',
            });
            toCreateMeta.push({ userId, indikatorId });
          }
        }

        if (toCreate.length === 0) continue;

        const saved = await this.disposisiRepo.save(
          toCreate.map((e) => this.disposisiRepo.create(e)),
        );

        for (let i = 0; i < saved.length; i++) {
          const { userId, indikatorId } = toCreateMeta[i];
          createdIds.set(`${userId}:${indikatorId}`, saved[i].id);
        }
      }
    }
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

  async getIkuOptions(tahun: string): Promise<Indikator[]> {
    const rows = await this.indikatorRepository.find({
      where: { jenis: 'IKU', level: 2, tahun },
    });
    return rows.sort(naturalSortKode);
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

  async importBulk(
    jenis: string,
    tahun: string,
    rows: Array<{
      kode: string;
      nama: string;
      level: number;
      parentKode: string | null;
      kategori: string | null;
      tenggat: string | null;
      target: number | null;
      satuan: string | null;
      sumberData: string;
      linkedIkuKode?: string | null;
    }>,
    clearFirst = false,
  ): Promise<{ imported: number; errors: string[] }> {
    if (clearFirst) {
      await this.indikatorRepository.delete({ jenis, tahun });
    }

    const errors: string[] = [];
    const kodeToId = new Map<string, number>();

    for (const row of rows) {
      try {
        const parentId = row.parentKode ? (kodeToId.get(row.parentKode) ?? null) : null;

        // Resolve PK → IKU linkage
        let resolvedLinkedIkuId: number | null = null;
        if (row.linkedIkuKode) {
          const ikuInd = await this.indikatorRepository.findOne({
            where: { jenis: 'IKU', kode: row.linkedIkuKode, tahun },
          });
          resolvedLinkedIkuId = ikuInd?.id ?? null;
        }

        let indikator = await this.indikatorRepository.findOne({
          where: { jenis, tahun, kode: row.kode },
        });

        if (indikator) {
          indikator.nama = row.nama;
          indikator.level = row.level;
          indikator.parentId = parentId;
          if (row.kategori) indikator.kategori = row.kategori;
          indikator.sumberData = row.sumberData || 'repository';
          if (resolvedLinkedIkuId !== null) indikator.linkedIkuId = resolvedLinkedIkuId;
          indikator = await this.indikatorRepository.save(indikator);
        } else {
          indikator = await this.indikatorRepository.save(
            this.indikatorRepository.create({
              jenis,
              tahun,
              kode: row.kode,
              nama: row.nama,
              level: row.level,
              parentId,
              kategori: row.kategori ?? null,
              sumberData: row.sumberData || 'repository',
              linkedIkuId: resolvedLinkedIkuId,
            }),
          );
        }

        kodeToId.set(row.kode, indikator.id);

        if (row.target != null) {
          const existing = await this.targetUniRepo.findOne({
            where: { indikatorId: indikator.id, tahun },
          });
          if (existing) {
            existing.persentase = row.target;
            if (row.satuan) existing.satuan = row.satuan;
            if (row.tenggat) existing.tenggat = row.tenggat;
            await this.targetUniRepo.save(existing);
          } else {
            await this.targetUniRepo.save(
              this.targetUniRepo.create({
                indikatorId: indikator.id,
                tahun,
                persentase: row.target,
                satuan: row.satuan ?? null,
                tenggat: row.tenggat ?? null,
              }),
            );
          }
        }
      } catch (err: any) {
        errors.push(`Baris kode=${row.kode}: ${err?.message ?? 'Unknown error'}`);
      }
    }

    // Re-materialize cascade disposisi for any L1 in this import that has a chain set
    const importedIds = [...kodeToId.values()];
    if (importedIds.length > 0) {
      const l1WithChain = await this.indikatorRepository.find({
        where: { id: In(importedIds), level: 1 },
      });
      for (const l1 of l1WithChain) {
        if (!l1.cascadeChain) continue;
        try {
          const chain = JSON.parse(l1.cascadeChain) as (number | number[])[];
          await this.materializeCascadeDisposisi(l1.id, chain, false);
        } catch {
          /* skip malformed chain */
        }
      }
    }

    return { imported: kodeToId.size, errors };
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

              // Sum disposisi at the leaf level (recipients who do NOT further distribute).
              // Uses a NOT-IN subquery to exclude intermediate nodes (kajur, kaprodi, etc.)
              // so each mahasiswa's share is counted exactly once.
              const leafSumRows = await this.disposisiRepo.query(
                `SELECT COALESCE(SUM(d.jumlah_target), 0) AS total
                 FROM disposisi d
                 WHERE d.indikator_id = $1 AND d.tahun = $2
                   AND d.to_user_id NOT IN (
                     SELECT COALESCE(from_user_id, 0)
                     FROM disposisi
                     WHERE indikator_id = $1 AND tahun = $2
                       AND from_user_id IS NOT NULL
                   )`,
                [l2.id, tahun],
              );
              const leafDisposisiJumlah =
                Number(leafSumRows?.[0]?.total ?? 0) > 0
                  ? Number(leafSumRows[0].total)
                  : null;

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
                disposisiJumlah: leafDisposisiJumlah,
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
                      linkedIkuId: l3.linkedIkuId ?? null,
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
        kategori: root.kategori ?? null,
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
      const allFromUserRoles = await this.userRoleRepo.find({
        where: { userId: In(fromUserIds) },
        relations: ['role'],
      });
      for (const ur of allFromUserRoles) {
        const thisLevel = ur.role?.level ?? 99;
        const current = fromUserLevelMap.get(ur.userId) ?? 99;
        if (thisLevel < current) fromUserLevelMap.set(ur.userId, thisLevel);
      }
    }

    const disposisiByIndikator = new Map<number, number>();

    // Terima disposisi dari siapapun yang levelnya lebih tinggi di hierarki.
    // Karena Dekan dan Wakil Dekan sama-sama level 1, Dekan → Wadek
    // diterima via kondisi: fromLevel <= currentRoleLevel && fromLevel <= 1.
    // fromUserId === null berarti distribusi dari Admin/sistem — selalu diterima.
    const receivedFromOthers = disposisis.filter((d) => {
      if (d.fromUserId === userId) return false;
      if (d.fromUserId === null) return true; // Admin/sistem distribusi selalu valid
      const fromLevel = fromUserLevelMap.get(d.fromUserId) ?? 99;
      // Sama level hanya diizinkan di level 0–1 (Dekan/Wadek satu rumpun)
      if (fromLevel === currentRoleLevel) return currentRoleLevel <= 1;
      return fromLevel < currentRoleLevel;
    });
    // Track level pengirim per indikator untuk ambil yang paling langsung (level tertinggi = angka terkecil)
    const senderLevelByIndikator = new Map<number, number>();
    for (const d of receivedFromOthers) {
      const fromLevel = d.fromUserId === null ? -1 : (fromUserLevelMap.get(d.fromUserId) ?? 99);
      const existingLevel = senderLevelByIndikator.get(d.indikatorId) ?? 99;
      // Pakai nilai dari pengirim paling langsung (level paling rendah angkanya)
      if (fromLevel <= existingLevel) {
        disposisiByIndikator.set(d.indikatorId, Number(d.jumlahTarget));
        senderLevelByIndikator.set(d.indikatorId, fromLevel);
      }
    }

    // Self-disposisi (from=user, to=user) adalah target personal dosen.
    // Simpan untuk post-filter dosen di bawah; jangan masukkan ke disposisiByIndikator
    // sekarang karena akan menimpa jumlah chain yang diterima dari atasan (KaJur→KaProdi).
    const selfDisposisis = disposisis.filter((d) => d.fromUserId === userId);

    // Indikator di mana user mendistribusikan FROM dirinya sendiri ke user LAIN (sebagai pimpinan).
    // Digunakan di post-filter dosen untuk memisahkan penerimaan KaProdi dari penerimaan dosen leaf.
    const distributedByUser = await this.disposisiRepo.find({
      where: { fromUserId: userId, tahun },
      select: ['indikatorId', 'toUserId'],
    });
    const pimpinanIndikatorIds = new Set(
      (distributedByUser as Array<{ indikatorId: number; toUserId: number }>)
        .filter((d) => d.toUserId !== userId)
        .map((d) => d.indikatorId),
    );

    // Auto-cascade: semua role dalam cascadeChain suatu L1 otomatis menerima
    // L1 tersebut beserta anak-anaknya. Chain selalu disimpan di level L1
    // (bukan L0) karena tombol "Alur" hanya muncul di baris L1.
    const allInds = await this.indikatorRepository.find({
      where: { jenis, tahun },
    });

    function isRoleInChain(chain: unknown[], rid: number): boolean {
      return chain.some((step) => {
        const roles = Array.isArray(step)
          ? (step as unknown[]).map(Number)
          : [Number(step)];
        return roles.includes(rid);
      });
    }

    const cascadedL1Ids = new Set<number>();
    // Which L1 indicators have this user as the FIRST node in the cascade chain.
    // First-node users (e.g. Wakil Dekan) receive directly from admin/dekan so they
    // need nilaiTarget shown as a reference even before import creates a real disposisi.
    const firstNodeL1Ids = new Set<number>();
    for (const ind of allInds) {
      if (!ind.cascadeChain || ind.level !== 1) continue;
      try {
        const chain = JSON.parse(ind.cascadeChain) as unknown[];
        if (!isRoleInChain(chain, Number(roleId))) continue;
        cascadedL1Ids.add(ind.id);
        // Check if this user's role is at chain[0] (first step)
        if (chain.length > 0) {
          const firstStep = chain[0];
          const firstIds = (Array.isArray(firstStep)
            ? (firstStep as unknown[]).map(Number)
            : [Number(firstStep)]);
          if (firstIds.includes(Number(roleId))) firstNodeL1Ids.add(ind.id);
        }
      } catch {
        /* skip malformed chain */
      }
    }

    const fullGrouped = await this.findGrouped(jenis, tahun, roleId);

    // Tracks IDs added by cascade scope without a real disposisi record.
    // These will surface as disposisiJumlah = null (shown as "-") in the response,
    // UNLESS the user is the first node in the chain (they see nilaiTarget as reference).
    const cascadeFallbackIds = new Set<number>();

    if (cascadedL1Ids.size > 0) {
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
        for (const sub of group.subIndikators) {
          if (!cascadedL1Ids.has(sub.id)) continue;
          const isFirstNode = firstNodeL1Ids.has(sub.id);
          for (const child of sub.children ?? []) {
            if (!disposisiByIndikator.has(child.id)) {
              if (isFirstNode && child.nilaiTarget != null) {
                // First node (e.g. WD): show nilaiTarget as reference allocation
                disposisiByIndikator.set(child.id, Number(child.nilaiTarget));
              } else {
                // Deeper nodes: show "-" until atasan creates a real disposisi
                disposisiByIndikator.set(child.id, 0);
                cascadeFallbackIds.add(child.id);
              }
            }
            // Cascade ke L3 grandchildren (PK)
            for (const gc of child.children ?? []) {
              if (!disposisiByIndikator.has(gc.id)) {
                if (isFirstNode && gc.nilaiTarget != null) {
                  disposisiByIndikator.set(gc.id, Number(gc.nilaiTarget));
                } else {
                  disposisiByIndikator.set(gc.id, 0);
                  cascadeFallbackIds.add(gc.id);
                }
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

    // Post-filter untuk pimpinan/chain view: hapus penerimaan disposisi dari receivedFromOthers
    // yang L1 parent-nya TIDAK ada dalam cascadedL1Ids. Penerimaan seperti ini adalah data
    // stale dari import yang salah atau penerimaan sebagai dosen (bukan sebagai pimpinan chain).
    // Hanya chain receipt yang benar-benar masuk cascade chain role ini yang boleh tampil.
    if (cascadedL1Ids.size > 0) {
      type PfLeaf = { id: number; children?: Array<{ id: number }> };
      type PfSub = { id: number; children: PfLeaf[] };
      type PfGroup = { id: number; subIndikators: PfSub[] };
      const childToL1Map = new Map<number, number>();
      for (const group of fullGrouped as PfGroup[]) {
        for (const sub of group.subIndikators) {
          childToL1Map.set(sub.id, sub.id); // L1 maps to itself
          for (const child of sub.children ?? []) {
            childToL1Map.set(child.id, sub.id);
            for (const gc of child.children ?? []) {
              childToL1Map.set(gc.id, sub.id);
            }
          }
        }
      }
      for (const indId of [...disposisiByIndikator.keys()]) {
        if (cascadeFallbackIds.has(indId)) continue; // cascade auto-fill, biarkan
        const l1Id = childToL1Map.get(indId);
        if (l1Id !== undefined && !cascadedL1Ids.has(l1Id)) {
          disposisiByIndikator.delete(indId);
        }
      }
    }

    // Post-filter untuk dosen/leaf view: ketika role saat ini TIDAK ada dalam cascade chain
    // manapun (cascadedL1Ids.size === 0), artinya user sedang mengakses workspace sebagai
    // dosen leaf, bukan pimpinan. Dalam konteks ini:
    //   1. Override chain amounts dengan target personal (self-disposisi)
    //   2. Hapus indikator di mana user bertindak sebagai pimpinan (mendistribusikan ke orang lain)
    //      tapi tidak punya target personal — itu adalah penerimaan KaProdi, bukan penerimaan dosen.
    if (cascadedL1Ids.size === 0) {
      // Tambahkan / override dengan target personal dosen
      for (const d of selfDisposisis) {
        disposisiByIndikator.set(d.indikatorId, Number(d.jumlahTarget));
      }
      // Hapus penerimaan chain KaProdi yang tidak punya target dosen personal
      if (pimpinanIndikatorIds.size > 0) {
        const selfIndIds = new Set(selfDisposisis.map((d) => d.indikatorId));
        for (const indId of pimpinanIndikatorIds) {
          if (!selfIndIds.has(indId)) {
            disposisiByIndikator.delete(indId);
          }
        }
      }
    }

    // Helper: returns null for cascade-scope-only entries (no real disposisi yet)
    const resolveDisposisi = (id: number): number | null =>
      cascadeFallbackIds.has(id) ? null : (disposisiByIndikator.get(id) ?? null);

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

    // L0 group IDs yang memiliki setidaknya satu L1 terkena cascade
    const cascadedGroupIds = new Set<number>();
    for (const group of fullGrouped as GroupNode[]) {
      for (const sub of group.subIndikators) {
        if (cascadedL1Ids.has(sub.id)) { cascadedGroupIds.add(group.id); break; }
      }
    }

    // Map L0 group id → fromUser name (only for non-cascaded, i.e. penerima 2+)
    const fromUserNameByL0 = new Map<number, string>();
    for (const d of receivedFromOthers) {
      const l0Id = indToL0Map.get(d.indikatorId);
      const fromUser = d['fromUser'] as { nama?: string } | null | undefined;
      const fromUserNama = fromUser?.nama;
      if (l0Id && fromUserNama && !cascadedGroupIds.has(l0Id)) {
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
                disposisiJumlah: resolveDisposisi(gc.id),
              }));

            if (isChildAssigned) {
              const enrichedGrandchildren = (c.children ?? []).map((gc: any) => ({
                ...gc,
                disposisiJumlah: resolveDisposisi(gc.id),
              }));
              return {
                ...c,
                disposisiJumlah: resolveDisposisi(c.id),
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
            disposisiJumlah: resolveDisposisi(c.id),
            children: (c.children ?? []).map((gc: any) => ({
              ...gc,
              disposisiJumlah: resolveDisposisi(gc.id),
            })),
          }));
          filteredSubs.push({
            ...sub,
            disposisiJumlah: resolveDisposisi(sub.id),
            children: enrichedChildren,
          });
        } else if (filteredChildren.length > 0) {
          filteredSubs.push({ ...sub, children: filteredChildren });
        }
      }
      if (filteredSubs.length > 0) {
        const fromUserNama = cascadedGroupIds.has(group.id)
          ? null
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
    // Realisasi yang sudah dinilai (minimal validated_atasan) — ditampilkan langsung di SKP
    // tanpa menunggu proses approval Dokumen Hasil SKP (approved).
    // Untuk data eksternal/Talenta tanpa validFileCount, gunakan realisasiAngka sebagai fallback.
    const finalValidRealisasiMap = new Map<number, number>();
    const VALIDATED_STATUSES = [
      'validated_atasan',
      'validated_wd2',
      'approved',
    ];
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
        if (VALIDATED_STATUSES.includes(r.status)) {
          const val =
            r.validFileCount !== null
              ? Number(r.validFileCount)
              : Number(r.realisasiAngka);
          finalValidRealisasiMap.set(
            r.indikatorId,
            (finalValidRealisasiMap.get(r.indikatorId) ?? 0) + val,
          );
        }
      }

      // Fetch sumberData per indikator so we route capaian accumulation correctly.
      const indikatorMeta = await this.indikatorRepository.find({
        where: { id: In(indikatorIds) },
        select: ['id', 'sumberData'],
      });
      const sumberDataById = new Map(indikatorMeta.map((m) => [m.id, m.sumberData]));
      const ikupkIds = indikatorIds.filter((id) => sumberDataById.get(id) === 'ikupk');
      const repositoryIds = indikatorIds.filter(
        (id) => (sumberDataById.get(id) ?? 'repository') !== 'ikupk',
      );

      // ── ikupk-type indicators ────────────────────────────────────────────────
      if (ikupkIds.length > 0) {
        // Own IKU PK uploads: use Max with formal submission to avoid double-count.
        const uploadedFiles = await this.realisasiFileRepo.find({
          where: { indikatorId: In(ikupkIds), createdBy: userId, tahun },
        });
        const fileCountMap = new Map<number, number>();
        for (const f of uploadedFiles) {
          if (f.indikatorId === null) continue;
          fileCountMap.set(f.indikatorId, (fileCountMap.get(f.indikatorId) ?? 0) + 1);
        }
        for (const [id, count] of fileCountMap) {
          realisasiMap.set(id, Math.max(realisasiMap.get(id) ?? 0, count));
        }

        // Bawahan's IKU PK uploads (disposisi-chain only, excludes self).
        const sentDisposisis = await this.disposisiRepo.find({
          where: { fromUserId: userId, indikatorId: In(ikupkIds), tahun },
        });
        const bawahanUserIds = [...new Set(sentDisposisis.map((d) => d.toUserId))].filter(
          (id) => id !== userId,
        );
        if (bawahanUserIds.length > 0) {
          const bawahanFiles = await this.realisasiFileRepo.find({
            where: { indikatorId: In(ikupkIds), createdBy: In(bawahanUserIds), tahun },
          });
          for (const f of bawahanFiles) {
            if (f.indikatorId === null) continue;
            realisasiMap.set(f.indikatorId, (realisasiMap.get(f.indikatorId) ?? 0) + 1);
          }

          // Also populate valid/finalValid maps from bawahan's validated realisasi.
          const bawahanRealisasiIkupk = await this.realisasiRepo.find({
            where: { indikatorId: In(ikupkIds), createdBy: In(bawahanUserIds), tahun },
          });
          for (const r of bawahanRealisasiIkupk) {
            if (!r.indikatorId) continue;
            if (r.validFileCount !== null) {
              validRealisasiMap.set(
                r.indikatorId,
                (validRealisasiMap.get(r.indikatorId) ?? 0) + Number(r.validFileCount),
              );
            }
            if (VALIDATED_STATUSES.includes(r.status)) {
              const finalVal = r.validFileCount !== null
                ? Number(r.validFileCount)
                : Number(r.realisasiAngka);
              finalValidRealisasiMap.set(
                r.indikatorId,
                (finalValidRealisasiMap.get(r.indikatorId) ?? 0) + finalVal,
              );
            }
          }
        }
      }

      // ── repository-type indicators ───────────────────────────────────────────
      // Accumulate bawahan's realisasi submissions so atasan's capaian correctly
      // reflects delegated work. Without this, atasan capaian = 0 for repository
      // indicators where all execution is delegated via disposisi.
      // Only bawahan who received disposisi from this user are included.
      if (repositoryIds.length > 0) {
        const sentDisposisisRepo = await this.disposisiRepo.find({
          where: { fromUserId: userId, indikatorId: In(repositoryIds), tahun },
        });
        const bawahanIdsRepo = [...new Set(sentDisposisisRepo.map((d) => d.toUserId))].filter(
          (id) => id !== userId,
        );
        if (bawahanIdsRepo.length > 0) {
          const bawahanRealisasiRepo = await this.realisasiRepo.find({
            where: { indikatorId: In(repositoryIds), createdBy: In(bawahanIdsRepo), tahun },
          });
          for (const r of bawahanRealisasiRepo) {
            if (!r.indikatorId) continue;
            const count = r.validFileCount !== null
              ? Number(r.validFileCount)
              : Number(r.realisasiAngka);
            realisasiMap.set(r.indikatorId, (realisasiMap.get(r.indikatorId) ?? 0) + count);
            if (r.validFileCount !== null) {
              validRealisasiMap.set(
                r.indikatorId,
                (validRealisasiMap.get(r.indikatorId) ?? 0) + Number(r.validFileCount),
              );
            }
            if (VALIDATED_STATUSES.includes(r.status)) {
              const finalVal = r.validFileCount !== null
                ? Number(r.validFileCount)
                : Number(r.realisasiAngka);
              finalValidRealisasiMap.set(
                r.indikatorId,
                (finalValidRealisasiMap.get(r.indikatorId) ?? 0) + finalVal,
              );
            }
          }
        }
      }
    }

    for (const group of filtered) {
      for (const sub of group.subIndikators) {
        // Aggregate level-3 (PK rincian) realisasi up to sub
        let subReal = realisasiMap.get(sub.id) ?? 0;
        let subValid: number | null = validRealisasiMap.get(sub.id) ?? null;
        let subFinalValid: number | null = finalValidRealisasiMap.get(sub.id) ?? null;

        for (const child of (sub.children ?? []) as {
          id: number;
          realisasiJumlah: number;
          validRealisasiJumlah: number | null;
          finalValidRealisasiJumlah: number | null;
          children?: {
            id: number;
            realisasiJumlah: number;
            validRealisasiJumlah: number | null;
            finalValidRealisasiJumlah: number | null;
          }[];
        }[]) {
          const childReal = realisasiMap.get(child.id) ?? 0;
          const childValid = validRealisasiMap.get(child.id) ?? null;
          const childFinalValid = finalValidRealisasiMap.get(child.id) ?? null;
          child.realisasiJumlah = childReal;
          child.validRealisasiJumlah = childValid;
          child.finalValidRealisasiJumlah = childFinalValid;
          subReal += childReal;
          if (childValid !== null) subValid = (subValid ?? 0) + childValid;
          if (childFinalValid !== null) subFinalValid = (subFinalValid ?? 0) + childFinalValid;
          for (const gc of child.children ?? []) {
            const gcReal = realisasiMap.get(gc.id) ?? 0;
            const gcValid = validRealisasiMap.get(gc.id) ?? null;
            const gcFinalValid = finalValidRealisasiMap.get(gc.id) ?? null;
            gc.realisasiJumlah = gcReal;
            gc.validRealisasiJumlah = gcValid;
            gc.finalValidRealisasiJumlah = gcFinalValid;
            subReal += gcReal;
            if (gcValid !== null) subValid = (subValid ?? 0) + gcValid;
            if (gcFinalValid !== null) subFinalValid = (subFinalValid ?? 0) + gcFinalValid;
          }
        }

        sub.realisasiJumlah = subReal;
        sub.validRealisasiJumlah = subValid;
        sub.finalValidRealisasiJumlah = subFinalValid;
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
    // For Kajur/Kaprodi (roleLevel >= 2): filter by fromUserId = userId so we only count
    // targets distributed BY the current user, not via a different cascade path (e.g. Wadek).
    if (bawahanIds.length > 0) {
      const disposisiWhere =
        roleLevel <= 1
          ? { toUserId: In(bawahanIds), tahun }
          : { toUserId: In(bawahanIds), tahun, fromUserId: userId };
      const disposisiList = await this.disposisiRepo.find({ where: disposisiWhere });
      for (const d of disposisiList) {
        const row = leafRows.find((r) => r.leafId === d.indikatorId);
        if (row)
          row.disposisiByUser[d.toUserId] =
            (row.disposisiByUser[d.toUserId] ?? 0) + Number(d.jumlahTarget);
      }
    }

    // 3b. Override nilaiTarget dengan total disposisi yang diterima bawahan tertinggi
    // (level role paling rendah = paling senior, misal Kajur untuk WD).
    // Ini membuat kolom Target mencerminkan data import, bukan target universitas statis.
    if (bawahanList.length > 0) {
      const minLevel = Math.min(...bawahanList.map((b) => b.roleLevel));
      const topIds = new Set(
        bawahanList.filter((b) => b.roleLevel === minLevel).map((b) => b.id),
      );
      for (const row of leafRows) {
        const topTotal = [...topIds].reduce(
          (sum, uid) => sum + (row.disposisiByUser[uid] ?? 0),
          0,
        );
        if (topTotal > 0) row.nilaiTarget = topTotal;
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
