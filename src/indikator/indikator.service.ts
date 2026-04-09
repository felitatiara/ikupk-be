import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
    const all = await this.indikatorRepository.find({ where: { jenis }, order: { kode: 'ASC' } });

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
        // Also check target universitas without unitId filter (set by Biro)
        if (targetUniversitasSub === null) {
          const subTargetUniv = await this.targetRepo.findOne({ where: { indikatorId: l1.id, tahun } });
          targetUniversitasSub = subTargetUniv ? Number(subTargetUniv.targetUniversitas) : null;
        }

        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          level: l1.level,
          parentId: l1.parentId,
          targetId: targetIdSub,
          targetFakultas,
          targetUniversitas: targetUniversitasSub,
          baselineJumlah: baselineJumlahSub,
          children: await Promise.all(level2.map(async (l2) => {
            let childTargetFakultas: number | null = null;
            let childBaselineJumlah: number | null = null;
            if (unitId) {
              const childTarget = await this.targetRepo.findOne({ where: { indikatorId: l2.id, unitId, tahun } });
              childTargetFakultas = childTarget ? Number(childTarget.targetFakultas) : null;
            }
            // Always fetch baseline
            childBaselineJumlah = await this.findBaselineForIndikator(l2.id, tahun, all);
            return { id: l2.id, kode: l2.kode, nama: l2.nama, level: l2.level, targetFakultas: childTargetFakultas, baselineJumlah: childBaselineJumlah };
          })),
        });
      }

      // Get target universitas for this root from target table
      const t = await this.targetRepo.findOne({ where: { indikatorId: root.id, tahun } });

      // Get baseline data for this root
      const rootBaseline = await this.findBaselineForIndikator(root.id, tahun, all);

      result.push({
        id: root.id,
        kode: root.kode,
        nama: root.nama,
        targetUniversitas: t ? Number(t.targetUniversitas) : null,
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
    // Get all disposisi for this user/unit/tahun
    const disposisis = await this.disposisiRepo.find({
      where: { assignedTo: userId, unitId, tahun },
    });
    if (disposisis.length === 0) return [];

    const disposisiByIndikator = new Map<number, number>();
    for (const d of disposisis) {
      disposisiByIndikator.set(d.indikatorId, Number(d.jumlah));
    }
    const assignedIndikatorIds = new Set(disposisiByIndikator.keys());

    // Get full grouped data
    const fullGrouped = await this.findGrouped(jenis, tahun, unitId);

    // Filter: only keep groups that have at least one assigned level-2 child
    const filtered: any[] = [];
    for (const group of fullGrouped) {
      const filteredSubs: any[] = [];
      for (const sub of group.subIndikators) {
        const filteredChildren = sub.children
          .filter((c: any) => assignedIndikatorIds.has(c.id))
          .map((c: any) => ({
            ...c,
            disposisiJumlah: disposisiByIndikator.get(c.id) ?? null,
          }));
        if (filteredChildren.length > 0) {
          filteredSubs.push({ ...sub, children: filteredChildren });
        }
      }
      if (filteredSubs.length > 0) {
        filtered.push({ ...group, subIndikators: filteredSubs });
      }
    }

    return filtered;
  }
}
