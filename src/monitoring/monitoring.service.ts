import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { RealisasiFile } from '../realisasi/realisasi-file.entity';
import { Indikator } from '../indikator/indikator.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { User } from '../users/user.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(TargetUniversitas)
    private readonly targetUniRepository: Repository<TargetUniversitas>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepository: Repository<TargetUnit>,
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(RealisasiFile)
    private readonly realisasiFileRepository: Repository<RealisasiFile>,
    @InjectRepository(Indikator)
    private readonly indikatorRepository: Repository<Indikator>,
    @InjectRepository(BaselineData)
    private readonly baselineRepository: Repository<BaselineData>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private async getBaseline(indikatorId: number, tahun: string, allIndikators: Indikator[]): Promise<number | null> {
    let currentId: number | null = indikatorId;
    while (currentId !== null) {
      const ind = allIndikators.find((i) => i.id === currentId);
      if (!ind) break;
      if (ind.jenisData) {
        const bl = await this.baselineRepository.findOne({ where: { jenisData: ind.jenisData, tahun } });
        if (bl) return Number(bl.jumlah);
      }
      currentId = ind.parentId ?? null;
    }
    return null;
  }

  /** Collect all leaf indikator IDs under a given parent based on jenis */
  private async getLeafIds(parentId: number, jenis: string): Promise<number[]> {
    const leafLevel = jenis === 'PK' ? 3 : 2;
    const children = await this.indikatorRepository.find({ where: { parentId } });
    if (children.length === 0) return [parentId];
    const leafIds: number[] = [];
    for (const child of children) {
      if (child.level >= leafLevel) {
        leafIds.push(child.id);
      } else {
        const deeper = await this.getLeafIds(child.id, jenis);
        leafIds.push(...deeper);
      }
    }
    return leafIds;
  }

  /**
   * Progress monitoring per level 0.
   * IKU: realisasi dari level 2, target_unit dari level 1.
   * PK: realisasi & target_unit dari level 3.
   */
  async getAggregatedProgress(tahun: string, jenis: string) {
    // Tidak filter by tahun pada indikator — struktur indikator bisa berlaku lintas tahun.
    // Filter tahun hanya diterapkan pada target_universitas dan realisasi.
    const level0Indikators = await this.indikatorRepository.find({
      where: { level: 0, jenis },
      order: { kode: 'ASC' },
    });

    const allIndikators = await this.indikatorRepository.find();
    const results: any[] = [];

    for (const l0 of level0Indikators) {
      const uniTarget = await this.targetUniRepository.findOne({ where: { indikatorId: l0.id, tahun } });
      const baseline = await this.getBaseline(l0.id, tahun, allIndikators);

      const persentaseTarget = uniTarget ? Number(uniTarget.persentase) : 0;
      const targetAbsolut = baseline != null ? Math.round((persentaseTarget / 100) * baseline) : null;

      const level1Children = await this.indikatorRepository.find({ where: { parentId: l0.id, level: 1 } });

      let sumTargetFak = 0;
      let sumRealisasi = 0;

      if (jenis === 'IKU') {
        // Target unit at L1, realisasi at L2
        for (const l1 of level1Children) {
          const unitTargets = await this.targetUnitRepository.find({ where: { indikatorId: l1.id, tahun } });
          sumTargetFak += unitTargets.reduce((s, t) => s + Number(t.nilaiTarget || 0), 0);

          const l2s = await this.indikatorRepository.find({ where: { parentId: l1.id, level: 2 } });
          for (const l2 of l2s) {
            const realisasiList = await this.realisasiRepository.find({ where: { indikatorId: l2.id, tahun } });
            sumRealisasi += realisasiList.reduce((s, r) => s + Number(r.realisasiAngka), 0);
          }
        }
      } else {
        // PK: target unit & realisasi at L3
        for (const l1 of level1Children) {
          const l2s = await this.indikatorRepository.find({ where: { parentId: l1.id, level: 2 } });
          for (const l2 of l2s) {
            const l3s = await this.indikatorRepository.find({ where: { parentId: l2.id, level: 3 } });
            for (const l3 of l3s) {
              const unitTargets = await this.targetUnitRepository.find({ where: { indikatorId: l3.id, tahun } });
              sumTargetFak += unitTargets.reduce((s, t) => s + Number(t.nilaiTarget || 0), 0);

              const realisasiList = await this.realisasiRepository.find({ where: { indikatorId: l3.id, tahun } });
              sumRealisasi += realisasiList.reduce((s, r) => s + Number(r.realisasiAngka), 0);
            }
          }
        }
      }

      const persentaseRealisasi =
        baseline != null && baseline > 0
          ? Math.round((sumRealisasi / baseline) * 100 * 10) / 10
          : null;

      const tercapai =
        persentaseRealisasi != null
          ? persentaseRealisasi >= persentaseTarget
          : sumRealisasi >= sumTargetFak && sumTargetFak > 0;

      const progress =
        targetAbsolut != null && targetAbsolut > 0
          ? Math.min(100, Math.floor((sumRealisasi / targetAbsolut) * 100))
          : sumTargetFak > 0
          ? Math.min(100, Math.floor((sumRealisasi / sumTargetFak) * 100))
          : 0;

      results.push({
        id: l0.id,
        kode: l0.kode,
        nama: l0.nama,
        targetUniversitas: persentaseTarget,   // % dari target_universitas
        targetAbsolut,
        baseline,
        targetFakultas: sumTargetFak,
        realisasi: sumRealisasi,
        persentaseRealisasi,
        tenggat: uniTarget?.tenggat || '-',
        status: tercapai ? 'Done' : 'Proses',
        progress,
        chartProgress: progress,
      });
    }

    return { tahun, jenis, data: results };
  }

  /**
   * Detail per indikator L0: list semua leaf realisasi dengan creator + files.
   */
  async getIndikatorDetail(indikatorId: number, tahun: string) {
    const l0 = await this.indikatorRepository.findOne({ where: { id: indikatorId } });
    if (!l0) return { indikator: null, entries: [] };

    const leafIds = await this.getLeafIds(indikatorId, l0.jenis);

    const entries: any[] = [];

    for (const leafId of leafIds) {
      const indikator = await this.indikatorRepository.findOne({ where: { id: leafId } });
      const realisasiList = await this.realisasiRepository.find({
        where: { indikatorId: leafId, tahun },
        relations: ['creator'],
        order: { createdAt: 'DESC' },
      });

      for (const r of realisasiList) {
        const files = await this.realisasiFileRepository.find({
          where: { realisasiId: r.id },
          order: { createdAt: 'ASC' },
        });

        entries.push({
          realisasiId: r.id,
          indikatorId: leafId,
          indikatorKode: indikator?.kode || '',
          indikatorNama: indikator?.nama || '',
          uploaderNama: (r.creator as any)?.nama || `User ${r.createdBy}`,
          uploaderEmail: (r.creator as any)?.email || '',
          realisasiAngka: Number(r.realisasiAngka),
          status: r.status,
          tahun: r.tahun,
          periode: r.periode,
          createdAt: r.createdAt,
          files: files.map((f) => ({
            id: f.id,
            fileName: f.fileName,
            fileUrl: f.fileUrl,
            repositoryFileId: f.repositoryFileId,
          })),
        });
      }
    }

    return { indikator: { id: l0.id, kode: l0.kode, nama: l0.nama, jenis: l0.jenis }, entries };
  }

  async getUnitProgress(roleId: number, tahun: string) {
    const targets = await this.targetUnitRepository.find({
      where: { roleId, tahun },
      relations: ['indikator'],
      order: { indikator: { kode: 'ASC' } },
    });

    const chartData: any[] = [];

    for (const target of targets) {
      const realisasiList = await this.realisasiRepository.find({
        where: {
          indikatorId: target.indikatorId,
          ...(target.roleId ? { roleId: target.roleId } : {}),
          tahun: target.tahun,
        },
      });

      const totalRealisasi = realisasiList.reduce((sum, r) => sum + Number(r.realisasiAngka), 0);
      const nilaiTarget = Number(target.nilaiTarget || 0);
      const progress = nilaiTarget > 0 ? Math.min(100, Math.floor((totalRealisasi / nilaiTarget) * 100)) : 0;

      chartData.push({
        name: target.indikator?.kode || `Indikator ${target.indikatorId}`,
        fullName: target.indikator?.nama || '',
        nilaiTarget,
        realisasi: totalRealisasi,
        progress,
      });
    }

    return { roleId, tahun, data: chartData };
  }
}
