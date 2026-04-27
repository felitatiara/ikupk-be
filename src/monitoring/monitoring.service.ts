import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { Indikator } from '../indikator/indikator.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(TargetUniversitas)
    private readonly targetUniRepository: Repository<TargetUniversitas>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepository: Repository<TargetUnit>,
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(Indikator)
    private readonly indikatorRepository: Repository<Indikator>,
    @InjectRepository(BaselineData)
    private readonly baselineRepository: Repository<BaselineData>,
  ) {}

  private async getBaseline(indikatorId: number, tahun: string, allIndikators: Indikator[]): Promise<number | null> {
    // Cari jenisData dari indikator atau parent-nya (walk up)
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

  /**
   * Progress monitoring level 0.
   * Response mencakup persentase target, nilai absolut, dan persentase realisasi aktual.
   */
  async getAggregatedProgress(tahun: string, jenis: string) {
    const level0Indikators = await this.indikatorRepository.find({
      where: { level: 0, jenis },
      order: { kode: 'ASC' },
    });

    const allIndikators = await this.indikatorRepository.find();
    const results: any[] = [];

    for (const l0 of level0Indikators) {
      const uniTarget = await this.targetUniRepository.findOne({ where: { indikatorId: l0.id, tahun } });
      const baseline = await this.getBaseline(l0.id, tahun, allIndikators);

      // Target absolut = persentase × baseline / 100
      const persentaseTarget = uniTarget ? Number(uniTarget.persentase) : 0;
      const targetAbsolut = baseline != null ? Math.round((persentaseTarget / 100) * baseline) : null;

      // Akumulasi dari level 1 children
      const level1Children = await this.indikatorRepository.find({ where: { parentId: l0.id, level: 1 } });
      let sumTargetUnit = 0;
      let sumRealisasi = 0;

      for (const l1 of level1Children) {
        const unitTargets = await this.targetUnitRepository.find({ where: { indikatorId: l1.id, tahun } });
        sumTargetUnit += unitTargets.reduce((s, t) => s + Number(t.nilaiTarget || 0), 0);

        const l1Realisasi = await this.realisasiRepository.find({ where: { indikatorId: l1.id, tahun } });
        sumRealisasi += l1Realisasi.reduce((s, r) => s + Number(r.realisasiAngka), 0);
      }

      // Persentase realisasi aktual = (realisasi / baseline) × 100
      const persentaseRealisasi = baseline != null && baseline > 0
        ? Math.round((sumRealisasi / baseline) * 100 * 10) / 10
        : null;

      const tercapai = persentaseRealisasi != null
        ? persentaseRealisasi >= persentaseTarget
        : sumRealisasi >= sumTargetUnit && sumTargetUnit > 0;

      results.push({
        id: l0.id,
        kode: l0.kode,
        nama: l0.nama,
        // Data target universitas (persentase)
        persentaseTarget,
        targetAbsolut,       // nilaiAbsolut = persentase × baseline / 100
        baseline,            // jumlah data dasar (misal: 500 lulusan)
        // Data akumulasi unit
        targetUnit: sumTargetUnit,
        realisasi: sumRealisasi,
        // Persentase realisasi aktual terhadap baseline
        persentaseRealisasi,
        tenggat: uniTarget?.tenggat || '-',
        status: tercapai ? 'Done' : 'Proses',
        // Progress: realisasi vs target absolut (0-100)
        progress: targetAbsolut != null && targetAbsolut > 0
          ? Math.min(100, Math.floor((sumRealisasi / targetAbsolut) * 100))
          : sumTargetUnit > 0 ? Math.min(100, Math.floor((sumRealisasi / sumTargetUnit) * 100)) : 0,
      });
    }

    return { tahun, jenis, data: results };
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
