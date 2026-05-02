import { Injectable, ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Indikator } from './indikator.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { UserRelation } from '../users/user_relation.entity';

const MAX_LEVEL: Record<string, number> = { IKU: 2, PK: 3 };

function isPastYear(tahun: string): boolean {
  return Number(tahun) < new Date().getFullYear();
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
    @InjectRepository(UserRelation)
    private userRelationRepo: Repository<UserRelation>,
  ) {}

  async findAll(tahun?: string): Promise<Indikator[]> {
    const where: any = {};
    if (tahun) where.tahun = tahun;
    return this.indikatorRepository.find({ where, order: { kode: 'ASC' } });
  }

  async findOne(id: number): Promise<Indikator | null> {
    return this.indikatorRepository.findOneBy({ id });
  }

  async create(data: Partial<Indikator>): Promise<Indikator> {
    // Enforce level max per jenis
    const jenis = data.jenis?.toUpperCase() ?? '';
    const maxLevel = MAX_LEVEL[jenis];
    if (maxLevel !== undefined && data.level !== undefined && data.level > maxLevel) {
      throw new ConflictException(`Level maksimum untuk ${jenis} adalah ${maxLevel}`);
    }
    const t = this.indikatorRepository.create(data);
    return this.indikatorRepository.save(t);
  }

  async update(id: number, data: Partial<Indikator>): Promise<Indikator | null> {
    await this.indikatorRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const indikator = await this.indikatorRepository.findOneBy({ id });
    if (!indikator) throw new NotFoundException(`Indikator ID ${id} tidak ditemukan`);
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
  async copyFromYear(fromTahun: string, toTahun: string): Promise<{ copied: number }> {
    if (isPastYear(toTahun)) {
      throw new ForbiddenException(`Tidak bisa copy ke tahun ${toTahun} karena sudah lampau`);
    }

    const existing = await this.indikatorRepository.find({ where: { tahun: toTahun } });
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
      throw new NotFoundException(`Tidak ada indikator untuk tahun ${fromTahun}`);
    }

    // Copy level per level agar parent_id bisa di-remap dengan benar
    const idMap = new Map<number, number>();
    for (let lvl = 0; lvl <= 3; lvl++) {
      const items = sourceIndikators.filter((i) => i.level === lvl);
      for (const src of items) {
        const newParentId = src.parentId != null ? (idMap.get(src.parentId) ?? null) : null;
        const saved = await this.indikatorRepository.save(
          this.indikatorRepository.create({
            jenis: src.jenis,
            kode: src.kode,
            nama: src.nama,
            tahun: toTahun,
            level: src.level,
            parentId: newParentId,
            jenisData: src.jenisData,
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
        const bl = await this.baselineRepo.findOne({ where: { jenisData: ind.jenisData, tahun } });
        if (bl) return Number(bl.jumlah);
      }
      currentId = ind.parentId ?? null;
    }
    return null;
  }

  // ── Grouped views ──────────────────────────────────────────────────────────

  async findGrouped(jenis: string, tahun: string, roleId?: number) {
    const all = await this.indikatorRepository.find({
      where: { jenis, tahun },
      order: { kode: 'ASC' },
    });

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
          const ut = await this.targetUnitRepo.findOne({ where: { indikatorId: l1.id, roleId, tahun } });
          nilaiTarget = ut ? Number(ut.nilaiTarget) : null;
          targetId = ut?.id ?? null;
        }
        if (nilaiTarget === null) {
          const ut = await this.targetUnitRepo.findOne({ where: { indikatorId: l1.id, tahun } });
          nilaiTarget = ut ? Number(ut.nilaiTarget) : null;
          if (!targetId) targetId = ut?.id ?? null;
        }

        const baselineJumlahSub = await this.findBaselineForIndikator(l1.id, tahun, all);

        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          level: l1.level,
          tahun: l1.tahun,
          parentId: l1.parentId,
          targetId,
          nilaiTarget,
          baselineJumlah: baselineJumlahSub,
          children: await Promise.all(
            level2.map(async (l2) => {
              let childNilaiTarget: number | null = null;
              let childTargetId: number | null = null;
              if (roleId) {
                const ct = await this.targetUnitRepo.findOne({ where: { indikatorId: l2.id, roleId, tahun } });
                childNilaiTarget = ct ? Number(ct.nilaiTarget) : null;
                childTargetId = ct?.id ?? null;
              }
              if (childNilaiTarget === null) {
                const ct = await this.targetUnitRepo.findOne({ where: { indikatorId: l2.id, tahun } });
                childNilaiTarget = ct ? Number(ct.nilaiTarget) : null;
                if (!childTargetId) childTargetId = ct?.id ?? null;
              }

              // Level 3 — hanya PK
              const level3 = all.filter((i) => i.level === 3 && i.parentId === l2.id);
              const childBaseline = await this.findBaselineForIndikator(l2.id, tahun, all);

              return {
                id: l2.id,
                kode: l2.kode,
                nama: l2.nama,
                level: l2.level,
                tahun: l2.tahun,
                targetId: childTargetId,
                nilaiTarget: childNilaiTarget,
                baselineJumlah: childBaseline,
                children: await Promise.all(
                  level3.map(async (l3) => {
                    let l3NilaiTarget: number | null = null;
                    let l3TargetId: number | null = null;
                    if (roleId) {
                      const l3t = await this.targetUnitRepo.findOne({ where: { indikatorId: l3.id, roleId, tahun } });
                      l3NilaiTarget = l3t ? Number(l3t.nilaiTarget) : null;
                      l3TargetId = l3t?.id ?? null;
                    }
                    return {
                      id: l3.id,
                      kode: l3.kode,
                      nama: l3.nama,
                      level: l3.level,
                      tahun: l3.tahun,
                      targetId: l3TargetId,
                      nilaiTarget: l3NilaiTarget,
                    };
                  }),
                ),
              };
            }),
          ),
        });
      }

      const uniTarget = await this.targetUniRepo.findOne({ where: { indikatorId: root.id, tahun } });
      const rootBaseline = await this.findBaselineForIndikator(root.id, tahun, all);

      const storedTarget = uniTarget ? Number(uniTarget.persentase) : null;
      // If a baseline exists use percentage formula; otherwise treat stored value as absolute
      const targetAbsolut = storedTarget !== null
        ? (rootBaseline ? Math.round((storedTarget / 100) * rootBaseline) : storedTarget)
        : null;

      result.push({
        id: root.id,
        kode: root.kode,
        nama: root.nama,
        tahun: root.tahun,
        persentaseTarget: storedTarget,
        targetAbsolut,
        tenggat: uniTarget?.tenggat ?? null,
        baselineJumlah: rootBaseline,
        subIndikators,
      });
    }

    return result;
  }

  async findGroupedForUser(jenis: string, tahun: string, userId: number, roleId: number) {
    const disposisis = await this.disposisiRepo.find({ where: { toUserId: userId, tahun } });
    if (disposisis.length === 0) return [];

    const disposisiByIndikator = new Map<number, number>();
    for (const d of disposisis) {
      disposisiByIndikator.set(d.indikatorId, Number(d.jumlahTarget));
    }
    const assignedIndikatorIds = new Set(disposisiByIndikator.keys());

    const fullGrouped = await this.findGrouped(jenis, tahun, roleId);
    const filtered: any[] = [];

    for (const group of fullGrouped) {
      const filteredSubs: any[] = [];
      for (const sub of group.subIndikators) {
        const isSubAssigned = assignedIndikatorIds.has(sub.id);

        // level-2 children that are directly assigned
        const filteredChildren = sub.children.map((c: any) => {
          const isChildAssigned = assignedIndikatorIds.has(c.id);
          // level-3 grandchildren that are assigned (PK rincian)
          const filteredGrandchildren = (c.children ?? [])
            .filter((gc: any) => assignedIndikatorIds.has(gc.id))
            .map((gc: any) => ({ ...gc, disposisiJumlah: disposisiByIndikator.get(gc.id) ?? null }));

          if (isChildAssigned) {
            return { ...c, disposisiJumlah: disposisiByIndikator.get(c.id) ?? null };
          } else if (filteredGrandchildren.length > 0) {
            return { ...c, children: filteredGrandchildren };
          }
          return null;
        }).filter(Boolean);

        if (isSubAssigned) {
          filteredSubs.push({ ...sub, disposisiJumlah: disposisiByIndikator.get(sub.id) ?? null });
        } else if (filteredChildren.length > 0) {
          filteredSubs.push({ ...sub, children: filteredChildren });
        }
      }
      if (filteredSubs.length > 0) {
        filtered.push({ ...group, subIndikators: filteredSubs });
      }
    }

    // Collect ALL indikator IDs including PK level-3 grandchildren for realisasi query
    const allTargetIds = new Set<number>([...assignedIndikatorIds]);
    for (const group of filtered) {
      for (const sub of group.subIndikators) {
        for (const child of (sub.children ?? [])) {
          for (const gc of (child.children ?? [])) {
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
        realisasiMap.set(r.indikatorId, (realisasiMap.get(r.indikatorId) ?? 0) + Number(r.realisasiAngka));
        if (r.validFileCount !== null) {
          validRealisasiMap.set(r.indikatorId, (validRealisasiMap.get(r.indikatorId) ?? 0) + Number(r.validFileCount));
        }
      }
    }

    for (const group of filtered) {
      for (const sub of group.subIndikators) {
        // Aggregate level-3 (PK rincian) realisasi up to sub
        let subReal = realisasiMap.get(sub.id) ?? 0;
        let subValid: number | null = validRealisasiMap.get(sub.id) ?? null;

        for (const child of (sub.children ?? [])) {
          child.realisasiJumlah = realisasiMap.get(child.id) ?? 0;
          child.validRealisasiJumlah = validRealisasiMap.get(child.id) ?? null;
          for (const gc of (child.children ?? [])) {
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

  async findPengajuanGrouped(jenis: string, tahun: string, roleId: number): Promise<any[]> {
    const grouped = await this.findGrouped(jenis, tahun, roleId);
    const result: any[] = [];
    for (const group of grouped) {
      if (group.persentaseTarget === null) continue;
      const allFilled = group.subIndikators.every((s: any) =>
        s.children.every((c: any) => c.nilaiTarget !== null && c.nilaiTarget !== undefined),
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
    const allIndikators = await this.indikatorRepository.find({ where: { jenis, tahun } });
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
    const calcKualitas = (nilai: number | null, baseline: number | null): number | null => {
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
      return { ...node, realisasiKuantitas, realisasiKualitas, targetKualitas, persenCapaian };
    };

    return grouped.map((group) => {
      const enrichedSubs = (group.subIndikators ?? []).map((sub: any) => {
        const enrichedSub = enrichNode(sub, group.baselineJumlah);
        const enrichedChildren = (sub.children ?? []).map((child: any) => {
          const enrichedChild = enrichNode(child, sub.baselineJumlah ?? group.baselineJumlah);
          const enrichedL3 = (child.children ?? []).map((l3: any) =>
            enrichNode(l3, child.baselineJumlah ?? sub.baselineJumlah ?? group.baselineJumlah),
          );
          return { ...enrichedChild, children: enrichedL3 };
        });
        return { ...enrichedSub, children: enrichedChildren };
      });

      // Hitung S.D (progres kumulatif sasaran) = total realisasi / targetAbsolut * 100
      const totalRealisasi = enrichedSubs.reduce((acc: number, sub: any) => {
        const subVal = sub.realisasiKuantitas > 0
          ? sub.realisasiKuantitas
          : sub.children.reduce((a: number, c: any) => a + (c.realisasiKuantitas ?? 0), 0);
        return acc + subVal;
      }, 0);
      const sdPersen =
        group.targetAbsolut && group.targetAbsolut > 0
          ? Number(((totalRealisasi / group.targetAbsolut) * 100).toFixed(1))
          : 0;

      return { ...group, sdPersen, subIndikators: enrichedSubs };
    });
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
