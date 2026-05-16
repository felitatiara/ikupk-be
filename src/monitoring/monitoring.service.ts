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
import { Disposisi } from '../disposisi/disposisi.entity';

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
    @InjectRepository(Disposisi)
    private readonly disposisiRepository: Repository<Disposisi>,
  ) {}

  private async getBaseline(
    indikatorId: number,
    tahun: string,
    allIndikators: Indikator[],
  ): Promise<number | null> {
    let currentId: number | null = indikatorId;
    while (currentId !== null) {
      const ind = allIndikators.find((i) => i.id === currentId);
      if (!ind) break;
      if (ind.jenisData) {
        const bl = await this.baselineRepository.findOne({
          where: { jenisData: ind.jenisData, tahun },
        });
        if (bl) return Number(bl.jumlah);
      }
      currentId = ind.parentId ?? null;
    }
    return null;
  }

  /** Collect all leaf indikator IDs under a given parent based on jenis */
  private async getLeafIds(parentId: number, jenis: string): Promise<number[]> {
    const leafLevel = jenis === 'PK' ? 3 : 2;
    const children = await this.indikatorRepository.find({
      where: { parentId },
    });
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

  /** Collect ALL descendant indikator IDs (any level) under a parent */
  private async getAllDescendantIds(parentId: number): Promise<number[]> {
    const children = await this.indikatorRepository.find({
      where: { parentId },
    });
    const ids: number[] = [];
    for (const child of children) {
      ids.push(child.id);
      const deeper = await this.getAllDescendantIds(child.id);
      ids.push(...deeper);
    }
    return ids;
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
      const uniTarget = await this.targetUniRepository.findOne({
        where: { indikatorId: l0.id, tahun },
      });
      const baseline = await this.getBaseline(l0.id, tahun, allIndikators);

      const persentaseTarget = uniTarget ? Number(uniTarget.persentase) : 0;
      const targetAbsolut =
        baseline != null
          ? Math.round((persentaseTarget / 100) * baseline)
          : null;

      const level1Children = await this.indikatorRepository.find({
        where: { parentId: l0.id, level: 1 },
      });

      let sumTargetFak = 0;
      let sumRealisasi = 0;

      // Collect all descendant IDs once — realisasi may be submitted at any level
      const allDescendantIds = await this.getAllDescendantIds(l0.id);
      if (allDescendantIds.length > 0) {
        const realisasiList = await this.realisasiRepository.find({
          where: allDescendantIds.map((id) => ({ indikatorId: id, tahun })),
        });
        sumRealisasi = realisasiList.reduce(
          (s, r) => s + Number(r.realisasiAngka),
          0,
        );
      }

      if (jenis === 'IKU') {
        // Target unit at L1
        for (const l1 of level1Children) {
          const unitTargets = await this.targetUnitRepository.find({
            where: { indikatorId: l1.id, tahun },
          });
          sumTargetFak += unitTargets.reduce(
            (s, t) => s + Number(t.nilaiTarget || 0),
            0,
          );
        }
      } else {
        // PK: target universitas at L3 (diinput saat tambah indikator per rincian)
        for (const l1 of level1Children) {
          const l2s = await this.indikatorRepository.find({
            where: { parentId: l1.id, level: 2 },
          });
          for (const l2 of l2s) {
            const l3s = await this.indikatorRepository.find({
              where: { parentId: l2.id, level: 3 },
            });
            for (const l3 of l3s) {
              const l3Target = await this.targetUniRepository.findOne({
                where: { indikatorId: l3.id, tahun },
              });
              if (l3Target) sumTargetFak += Number(l3Target.persentase || 0);
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

      // Build per-L1 sub-indikator data (with L2 children)
      const subIndikators: any[] = [];
      for (const l1 of level1Children) {
        const l1DescendantIds = await this.getAllDescendantIds(l1.id);
        let l1Realisasi = 0;
        if (l1DescendantIds.length > 0) {
          const l1RealisasiList = await this.realisasiRepository.find({
            where: l1DescendantIds.map((id) => ({ indikatorId: id, tahun })),
          });
          l1Realisasi = l1RealisasiList.reduce(
            (s, r) => s + Number(r.realisasiAngka),
            0,
          );
        }
        let l1TargetFak = 0;
        if (jenis === 'IKU') {
          const unitTargets = await this.targetUnitRepository.find({
            where: { indikatorId: l1.id, tahun },
          });
          l1TargetFak = unitTargets.reduce(
            (s, t) => s + Number(t.nilaiTarget || 0),
            0,
          );
        }

        // L2 children
        const level2Children = await this.indikatorRepository.find({
          where: { parentId: l1.id, level: 2 },
          order: { kode: 'ASC' },
        });
        const l2Items: any[] = [];
        for (const l2 of level2Children) {
          const l2DescIds = await this.getAllDescendantIds(l2.id);
          let l2Realisasi = 0;
          if (l2DescIds.length > 0) {
            const l2RealisasiList = await this.realisasiRepository.find({
              where: l2DescIds.map((id) => ({ indikatorId: id, tahun })),
            });
            l2Realisasi = l2RealisasiList.reduce(
              (s, r) => s + Number(r.realisasiAngka),
              0,
            );
          }
          const l2UniTarget = await this.targetUniRepository.findOne({
            where: { indikatorId: l2.id, tahun },
          });
          l2Items.push({
            id: l2.id,
            kode: l2.kode,
            nama: l2.nama,
            realisasi: l2Realisasi,
            nilaiTarget: l2UniTarget ? Number(l2UniTarget.persentase) : null,
            satuan: l2UniTarget?.satuan ?? null,
          });
        }

        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          targetFakultas: l1TargetFak,
          realisasi: l1Realisasi,
          status:
            l1TargetFak > 0 && l1Realisasi >= l1TargetFak ? 'Done' : 'Proses',
          children: l2Items,
        });
      }

      results.push({
        id: l0.id,
        kode: l0.kode,
        nama: l0.nama,
        jenis: l0.jenis,
        targetUniversitas: persentaseTarget, // IKU: %; PK: nilai absolut
        satuan: uniTarget?.satuan ?? null,
        targetAbsolut,
        baseline,
        targetFakultas: sumTargetFak,
        realisasi: sumRealisasi,
        persentaseRealisasi,
        tenggat: uniTarget?.tenggat || '-',
        status: tercapai ? 'Done' : 'Proses',
        progress,
        chartProgress: progress,
        subIndikators,
      });
    }

    return { tahun, jenis, data: results };
  }

  /**
   * Detail per indikator L0: list semua leaf realisasi dengan creator + files.
   */
  async getIndikatorDetail(indikatorId: number, tahun: string) {
    const l0 = await this.indikatorRepository.findOne({
      where: { id: indikatorId },
    });
    if (!l0) return { indikator: null, entries: [] };

    // Use all descendant IDs so we find realisasi submitted at any level (L1, L2, or L3)
    const allIds = await this.getAllDescendantIds(indikatorId);

    const entries: any[] = [];

    for (const leafId of allIds) {
      const indikator = await this.indikatorRepository.findOne({
        where: { id: leafId },
      });
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

    return {
      indikator: { id: l0.id, kode: l0.kode, nama: l0.nama, jenis: l0.jenis },
      entries,
    };
  }

  /**
   * Daftar dosen yang sudah didisposisikan oleh kaprodi (fromUserId).
   * Digroup per dosen, masing-masing berisi list indikator yang didisposisikan.
   */
  async getDisposisiDosen(fromUserId: number, tahun: string) {
    const disposisiList = await this.disposisiRepository.find({
      where: { fromUserId, tahun },
      relations: ['toUser', 'indikator'],
      order: { createdAt: 'ASC' },
    });

    const dosenMap = new Map<number, any>();

    for (const d of disposisiList) {
      if (!d.toUser) continue;

      if (!dosenMap.has(d.toUserId)) {
        dosenMap.set(d.toUserId, {
          dosenId: d.toUserId,
          nama: d.toUser.nama,
          email: d.toUser.email,
          nip: d.toUser.nip,
          disposisi: [],
        });
      }

      dosenMap.get(d.toUserId).disposisi.push({
        disposisiId: d.id,
        indikatorId: d.indikatorId,
        indikatorKode: d.indikator?.kode || '',
        indikatorNama: d.indikator?.nama || '',
        jumlahTarget: Number(d.jumlahTarget),
        status: d.status,
        createdAt: d.createdAt,
      });
    }

    return {
      fromUserId,
      tahun,
      data: Array.from(dosenMap.values()),
    };
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

      const totalRealisasi = realisasiList.reduce(
        (sum, r) => sum + Number(r.realisasiAngka),
        0,
      );
      const nilaiTarget = Number(target.nilaiTarget || 0);
      const progress =
        nilaiTarget > 0
          ? Math.min(100, Math.floor((totalRealisasi / nilaiTarget) * 100))
          : 0;

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
