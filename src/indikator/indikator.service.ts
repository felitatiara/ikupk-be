import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Indikator } from './indikator.entity';
import { Target } from '../target/target.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { Disposisi } from '../disposisi/disposisi.entity';

@Injectable()
export class IndikatorService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepository: Repository<Indikator>,
    @InjectRepository(Target)
    private targetRepo: Repository<Target>,
    @InjectRepository(BaselineData)
    private baselineRepo: Repository<BaselineData>,
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
  ) {}

  async findAll(): Promise<Indikator[]> {
    return this.indikatorRepository.find();
  }

  async findOne(id: number): Promise<Indikator | null> {
    return this.indikatorRepository.findOneBy({ id });
  }

  async create(data: Partial<Indikator>): Promise<Indikator> {
    const t = this.indikatorRepository.create(data);
    return this.indikatorRepository.save(t);
  }

  async update(id: number, data: Partial<Indikator>): Promise<Indikator | null> {
    await this.indikatorRepository.update(id, data);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.indikatorRepository.delete(id);
  }

  async removeAll(): Promise<void> {
    await this.indikatorRepository.query('TRUNCATE TABLE indikator CASCADE');
  }

  async findSubindikator() {
    return this.indikatorRepository.query(
      "SELECT * FROM indikator WHERE array_length(string_to_array(kode, '.'), 1) = 3"
    );
  }

  // Find baseline data for an indikator by matching jenis_data.
  // Walks up parent chain to find an indikator with jenis_data, then queries baseline_data.
  private async findBaselineForIndikator(
    indikatorId: number,
    tahun: string,
    allIndikators: Indikator[],
  ): Promise<number | null> {
    // Walk up from the indikator to find one with jenis_data set
    let currentId: number | null = indikatorId;
    while (currentId !== null) {
      const indikator = allIndikators.find((i) => i.id === currentId);
      if (!indikator) return null;
      if (indikator.jenisData) {
        const bl = await this.baselineRepo.findOne({
          where: { jenisData: indikator.jenisData, unitId: 1, tahun },
        });
        if (bl) return Number(bl.jumlah);
      }
      currentId = indikator.parentId ?? null;
    }
    return null;
  }

  async findGrouped(jenis: string, tahun: string, unitId?: number) {
    let all: Indikator[] = [];

    if (jenis === 'PK') {
      // 1. Ambil semua yang memang jenisnya PK
      const pks = await this.indikatorRepository.find({ where: { jenis: 'PK' } });

      // 2. Ambil IKU level 1 yang ditandai Berbasis IKU
      const sharedLevel1 = await this.indikatorRepository.find({
        where: { jenis: 'IKU', level: 1, isPkBerbasisIku: true },
      });

      if (sharedLevel1.length > 0) {
        const l1Ids = sharedLevel1.map((i) => i.id);
        const l0Ids = [...new Set(sharedLevel1.map((i) => i.parentId).filter((id) => id !== null))];

        // Ambil parent level 0 nya
        const sharedLevel0 = await this.indikatorRepository.find({
          where: { id: In(l0Ids as number[]) },
        });

        // Ambil children level 2 nya
        const sharedLevel2 = await this.indikatorRepository.find({
          where: { parentId: In(l1Ids) },
        });

        all = [...pks, ...sharedLevel0, ...sharedLevel1, ...sharedLevel2];
      } else {
        all = pks;
      }

      // Deduplikasi by ID
      const uniqueMap = new Map<number, Indikator>();
      all.forEach((i) => uniqueMap.set(i.id, i));
      all = Array.from(uniqueMap.values()).sort((a, b) => a.kode.localeCompare(b.kode));
    } else {
      all = await this.indikatorRepository.find({ where: { jenis }, order: { kode: 'ASC' } });
    }

    // Level 0 = sasaran strategis (root, no parent)
    const roots = all.filter((i) => i.level === 0);

    const result: any[] = [];

    for (const root of roots) {
      // Level 1 children = sub indikator
      const level1 = all.filter((i) => i.level === 1 && i.parentId === root.id);

      // Build sub indikator rows: level 1 + their level 2 children
      const subIndikators: any[] = [];

      for (const l1 of level1) {
        const level2 = all.filter((i) => i.level === 2 && i.parentId === l1.id);

        // Fetch target for this sub-indikator
        let targetFakultas: number | null = null;
        let targetUniversitasSub: number | null = null;
        let baselineJumlahSub: number | null = null;
        let targetIdSub: number | null = null;
        if (unitId) {
          const subTarget = await this.targetRepo.findOne({ where: { indikatorId: l1.id, unitId, tahun } });
          targetFakultas = subTarget ? Number(subTarget.targetFakultas) : null;
          targetUniversitasSub = subTarget ? Number(subTarget.targetUniversitas) : null;
          targetIdSub = subTarget ? subTarget.id : null;
        }
        // Always fetch baseline (not dependent on unitId)
        baselineJumlahSub = await this.findBaselineForIndikator(l1.id, tahun, all);
        // Also check target universitas and fakultas without unitId filter (fallback)
        if (targetUniversitasSub === null || targetFakultas === null) {
          const subTargetAny = await this.targetRepo.findOne({ where: { indikatorId: l1.id, tahun } });
          if (targetUniversitasSub === null) targetUniversitasSub = subTargetAny ? Number(subTargetAny.targetUniversitas) : null;
          if (targetFakultas === null) targetFakultas = subTargetAny ? Number(subTargetAny.targetFakultas) : null;
        }

        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          level: l1.level,
          parentId: l1.parentId,
          isPkBerbasisIku: l1.isPkBerbasisIku, // Include flag
          targetId: targetIdSub,
          targetFakultas,
          targetUniversitas: targetUniversitasSub,
          baselineJumlah: baselineJumlahSub,
          children: await Promise.all(level2.map(async (l2) => {
            // Fetch targetUniversitas + tenggat dari record unitId=1 (superadmin)
            const univTarget = await this.targetRepo.findOne({ where: { indikatorId: l2.id, unitId: 1, tahun } });
            const childTargetUniversitas: number | null = univTarget ? Number(univTarget.targetUniversitas) : null;
            const childTenggat: string | null = univTarget ? univTarget.tenggat : null;
            const childTargetUniversitasId: number | null = univTarget ? univTarget.id : null;

            // Fetch targetFakultas dari unit admin ybs
            let childTargetFakultas: number | null = null;
            if (unitId && unitId !== 1) {
              const childTarget = await this.targetRepo.findOne({ where: { indikatorId: l2.id, unitId, tahun } });
              childTargetFakultas = childTarget ? Number(childTarget.targetFakultas) : null;
            } else if (unitId === 1) {
              childTargetFakultas = univTarget ? Number(univTarget.targetFakultas) : null;
            }

            const childBaselineJumlah = await this.findBaselineForIndikator(l2.id, tahun, all);
            return {
              id: l2.id,
              kode: l2.kode,
              nama: l2.nama,
              level: l2.level,
              targetFakultas: childTargetFakultas,
              targetUniversitas: childTargetUniversitas,
              targetUniversitasId: childTargetUniversitasId,
              tenggat: childTenggat,
              baselineJumlah: childBaselineJumlah,
            };
          })),
        });
      }

      // Get target universitas for this root from target table (superadmin record, unitId=1)
      let t = await this.targetRepo.findOne({ where: { indikatorId: root.id, unitId: 1, tahun } });
      if (!t) {
        // Fallback: search for any available target universitas for this root and year
        t = await this.targetRepo.findOne({ where: { indikatorId: root.id, tahun } });
      }

      // Get baseline data for this root
      const rootBaseline = await this.findBaselineForIndikator(root.id, tahun, all);

      result.push({
        id: root.id,
        kode: root.kode,
        nama: root.nama,
        targetUniversitas: t ? Number(t.targetUniversitas) : null,
        tenggat: t ? t.tenggat : null,
        targetUniversitasTahun: tahun,
        baselineJumlah: rootBaseline,
        subIndikators,
      });
    }

    return result;
  }

  /**
   * Same as findGrouped, but filtered to only show indikators
   * where the given user has a disposisi assignment.
   * Adds disposisiJumlah to each child row.
   */
  async findGroupedForUser(jenis: string, tahun: string, userId: number, unitId: number) {
    // DIAGNOSTIC LOG
    const allRecords = await this.disposisiRepo.find();
    console.log("DIAGNOSTIC: All Disposisi Records in DB:", JSON.stringify(allRecords, null, 2));

    // Get all disposisi for this user/tahun (independent of unitId for cross-unit delegation)
    const disposisis = await this.disposisiRepo.find({
      where: { assignedTo: userId, tahun },
    });
    if (disposisis.length === 0) {
      console.log(`DEBUG findGroupedForUser: No disposisi records found for userId=${userId}, tahun=${tahun}`);
      return [];
    }

    const disposisiByIndikator = new Map<number, number>();
    for (const d of disposisis) {
      disposisiByIndikator.set(d.indikatorId, Number(d.jumlah));
    }
    const assignedIndikatorIds = new Set(disposisiByIndikator.keys());
    console.log(`DEBUG findGroupedForUser: userId=${userId}, found ${disposisis.length} disposisis. Assigned IDs:`, Array.from(assignedIndikatorIds));

    // Get full grouped data
    const fullGrouped = await this.findGrouped(jenis, tahun, unitId);

    // Filter: only keep groups that have at least one assigned level-1 or level-2 child
    const filtered: any[] = [];
    for (const group of fullGrouped) {
      const filteredSubs: any[] = [];
      for (const sub of group.subIndikators) {
        const isSubAssigned = assignedIndikatorIds.has(sub.id);
        const filteredChildren = sub.children
          .filter((c: any) => assignedIndikatorIds.has(c.id))
          .map((c: any) => ({
            ...c,
            disposisiJumlah: disposisiByIndikator.get(c.id) ?? null,
          }));

        if (isSubAssigned) {
          // If sub is assigned, we keep the entire sub and its children
          filteredSubs.push({ 
            ...sub, 
            disposisiJumlah: disposisiByIndikator.get(sub.id) ?? null 
          });
        } else if (filteredChildren.length > 0) {
          // If sub is not assigned directly but children are, keep only assigned children
          filteredSubs.push({ ...sub, children: filteredChildren });
        }
      }
      if (filteredSubs.length > 0) {
        filtered.push({ ...group, subIndikators: filteredSubs });
      }
    }

    return filtered;
  }

  async findPengajuanGrouped(jenis: string, tahun: string, unitId: number): Promise<any[]> {
    const grouped = await this.findGrouped(jenis, tahun, unitId);
    const result: any[] = [];

    for (const group of grouped) {
      // Only show groups where superadmin has set a target universitas (at level 0)
      if (group.targetUniversitas === null || group.targetUniversitas === undefined) continue;

      const allFilled = group.subIndikators.every((s: any) =>
        s.children.every((c: any) => c.targetFakultas !== null && c.targetFakultas !== undefined),
      );
      result.push({
        ...group,
        jenis,
        tahun,
        tenggat: group.tenggat ?? null,
        status: allFilled ? 'sudah_diisi' : 'belum_diisi',
      });
    }
    return result;
  }
}
