import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Target } from '../target/target.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { Indikator } from '../indikator/indikator.entity';

@Injectable()
export class MonitoringService {
  constructor(
    @InjectRepository(Target)
    private readonly targetRepository: Repository<Target>,
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
    @InjectRepository(Indikator)
    private readonly indikatorRepository: Repository<Indikator>,
  ) {}

  /**
   * Returns aggregated progress monitoring focused on Level 0 indicators.
   * Target Fakultas and Realisasi are summed from all child indicators (Level 1).
   */
  async getAggregatedProgress(tahun: string, jenis: string) {
    // 1. Get all indicators level 0 filtered by jenis (IKU/PK)
    const level0Indikators = await this.indikatorRepository.find({
      where: { level: 0, jenis },
      order: { kode: 'ASC' },
    });

    const results: any[] = [];

    for (const l0 of level0Indikators) {
      // 2. Get Target Universitas and Tenggat from Level 0 target record
      const l0Target = await this.targetRepository.findOne({
        where: { indikatorId: l0.id, tahun },
      });

      // 3. Get all Level 1 children
      const level1Children = await this.indikatorRepository.find({
        where: { parentId: l0.id, level: 1 },
      });

      let sumTargetFakultas = 0;
      let sumRealisasi = 0;

      for (const l1 of level1Children) {
        // Sum Target Fakultas for each child
        const l1Target = await this.targetRepository.findOne({
          where: { indikatorId: l1.id, tahun },
        });
        if (l1Target) {
          sumTargetFakultas += Number(l1Target.targetFakultas || 0);
        }

        // Sum Realisasi for each child
        const l1Realisasi = await this.realisasiRepository.find({
          where: { indikatorId: l1.id, tahun },
        });
        sumRealisasi += l1Realisasi.reduce((sum, r) => sum + Number(r.realisasiAngka), 0);
      }

      const status = sumRealisasi >= sumTargetFakultas && sumTargetFakultas > 0 ? 'Done' : 'Proses';

      results.push({
        id: l0.id,
        kode: l0.kode,
        nama: l0.nama,
        targetUniversitas: l0Target ? Number(l0Target.targetUniversitas || 0) : 0,
        targetFakultas: sumTargetFakultas,
        realisasi: sumRealisasi,
        tenggat: l0Target?.tenggat || '-',
        status: status,
        // Chart point: progress calculation (0-100)
        progress: sumTargetFakultas > 0 ? Math.min(100, Math.floor((sumRealisasi / sumTargetFakultas) * 100)) : 0,
        // User requested binary status for chart before, but for table he wants "Done/Proses".
        // I will provide "chartProgress" specifically for the line chart (100 or 0).
        chartProgress: sumRealisasi >= sumTargetFakultas && sumTargetFakultas > 0 ? 100 : 0,
      });
    }

    return {
      tahun,
      jenis,
      data: results,
    };
  }

  async getUnitProgress(unitId: number, tahun: string) {
    const targets = await this.targetRepository.find({
      where: { unitId, tahun },
      relations: ['indikator'],
      order: { indikator: { kode: 'ASC' } },
    });

    const chartData: any[] = [];

    for (const target of targets) {
      const realisasiList = await this.realisasiRepository.find({
        where: { 
          indikatorId: target.indikatorId, 
          unitId: target.unitId, 
          tahun: target.tahun 
        },
      });

      const totalRealisasi = realisasiList.reduce(
        (sum, r) => sum + Number(r.realisasiAngka), 
        0
      );

      const targetFakultas = Number(target.targetFakultas || 0);
      const progress = totalRealisasi >= targetFakultas && targetFakultas > 0 ? 100 : 0;

      chartData.push({
        name: target.indikator?.kode || `IKU ${target.indikatorId}`,
        target: targetFakultas,
        realisasi: totalRealisasi,
        progress: progress,
        fullName: target.indikator?.nama || '',
      });
    }

    return {
      unitId,
      tahun,
      data: chartData,
    };
  }
}
