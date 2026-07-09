import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { RealisasiFile } from '../realisasi/realisasi-file.entity';
import { Indikator } from '../indikator/indikator.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { User } from '../users/user.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { ValidasiBiroPKU } from './validasi-biro-pku.entity';

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
    @InjectRepository(ValidasiBiroPKU)
    private readonly validasiBiroPKURepository: Repository<ValidasiBiroPKU>,
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

  /** Build ancestor chain from root down to the given indikator */
  private async getIndikatorHierarchy(indikatorId: number): Promise<{ kode: string; nama: string; level: number }[]> {
    const chain: { kode: string; nama: string; level: number }[] = [];
    let current = await this.indikatorRepository.findOne({ where: { id: indikatorId } });
    while (current) {
      chain.unshift({ kode: current.kode, nama: current.nama, level: current.level });
      if (current.parentId) {
        current = await this.indikatorRepository.findOne({ where: { id: current.parentId } });
      } else {
        break;
      }
    }
    return chain;
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

    // Build cross-reading maps: PK id -> linked IKU id; IKU id -> [linked PK ids]
    const linkedIkuMap = new Map<number, number>();
    const linkedPkMap = new Map<number, number[]>();
    for (const ind of allIndikators) {
      if (ind.linkedIkuId) {
        linkedIkuMap.set(ind.id, ind.linkedIkuId);
        const list = linkedPkMap.get(ind.linkedIkuId) ?? [];
        list.push(ind.id);
        linkedPkMap.set(ind.linkedIkuId, list);
      }
    }

    const expandIds = (ids: number[]): number[] => {
      const extra: number[] = [];
      for (const id of ids) {
        if (jenis === 'PK') {
          const linked = linkedIkuMap.get(id);
          if (linked != null) extra.push(linked);
        } else {
          extra.push(...(linkedPkMap.get(id) ?? []));
        }
      }
      return [...new Set([...ids, ...extra])];
    };

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
      const allRealisasiIds = expandIds(allDescendantIds);
      if (allRealisasiIds.length > 0) {
        const realisasiList = await this.realisasiRepository.find({
          where: allRealisasiIds.map((id) => ({ indikatorId: id, tahun })),
        });
        sumRealisasi = realisasiList.reduce(
          (s, r) => s + Number(r.realisasiAngka),
          0,
        );
      }

      // Biro PKU validated value overrides raw submissions when available
      const biroPKURecord = await this.validasiBiroPKURepository.findOne({
        where: { indikatorId: l0.id, tahun },
      });
      const realisasiBiroPKU = biroPKURecord?.jumlahValid ?? null;
      const effectiveRealisasi =
        realisasiBiroPKU !== null ? realisasiBiroPKU : sumRealisasi;

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
          ? Math.round((effectiveRealisasi / baseline) * 100 * 10) / 10
          : null;

      const tercapai =
        persentaseRealisasi != null
          ? persentaseRealisasi >= persentaseTarget
          : effectiveRealisasi >= sumTargetFak && sumTargetFak > 0;

      const progress =
        targetAbsolut != null && targetAbsolut > 0
          ? Math.min(100, Math.floor((effectiveRealisasi / targetAbsolut) * 100))
          : sumTargetFak > 0
            ? Math.min(100, Math.floor((effectiveRealisasi / sumTargetFak) * 100))
            : 0;

      const actualProgress =
        targetAbsolut != null && targetAbsolut > 0
          ? Math.floor((effectiveRealisasi / targetAbsolut) * 100)
          : sumTargetFak > 0
            ? Math.floor((effectiveRealisasi / sumTargetFak) * 100)
            : 0;

      // Build per-L1 sub-indikator data (with L2 children)
      const subIndikators: any[] = [];
      for (const l1 of level1Children) {
        const l1DescendantIds = await this.getAllDescendantIds(l1.id);
        const l1AllIds = expandIds([l1.id, ...l1DescendantIds]);
        const l1RealisasiList = await this.realisasiRepository.find({
          where: l1AllIds.map((id) => ({ indikatorId: id, tahun })),
        });
        const l1Realisasi = l1RealisasiList.reduce(
          (s, r) => s + Number(r.realisasiAngka),
          0,
        );
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
          // Include the node itself so leaf-level realisasi (no children) are counted
          const l2AllIds = expandIds([l2.id, ...l2DescIds]);
          const l2RealisasiList = await this.realisasiRepository.find({
            where: l2AllIds.map((id) => ({ indikatorId: id, tahun })),
          });
          const l2Realisasi = l2RealisasiList.reduce(
            (s, r) => s + Number(r.realisasiAngka),
            0,
          );
          const l2UniTarget = await this.targetUniRepository.findOne({
            where: { indikatorId: l2.id, tahun },
          });
          const l2TargetVal = l2UniTarget ? Number(l2UniTarget.persentase || 0) : 0;
          l2Items.push({
            id: l2.id,
            kode: l2.kode,
            nama: l2.nama,
            realisasi: l2Realisasi,
            nilaiTarget: l2UniTarget ? Number(l2UniTarget.persentase) : null,
            satuan: l2UniTarget?.satuan ?? null,
            status: l2TargetVal > 0 && l2Realisasi >= l2TargetVal ? 'Done' : 'Proses',
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
        kategori: l0.kategori ?? null,
        targetUniversitas: persentaseTarget, // IKU: %; PK: nilai absolut
        satuan: uniTarget?.satuan ?? null,
        targetAbsolut,
        baseline,
        targetFakultas: sumTargetFak,
        realisasi: sumRealisasi,
        realisasiBiroPKU,
        persentaseRealisasi,
        tenggat: uniTarget?.tenggat || '-',
        status: tercapai ? 'Done' : 'Proses',
        progress,
        actualProgress,
        chartProgress: progress > 0 ? progress : Math.min(100, effectiveRealisasi),
        subIndikators,
      });
    }

    return { tahun, jenis, data: results };
  }

  /**
   * Detail per indikator L0: list semua leaf realisasi + pohon disposisi dengan status per orang.
   */
  async getIndikatorDetail(indikatorId: number, tahun: string) {
    const l0 = await this.indikatorRepository.findOne({
      where: { id: indikatorId },
    });
    if (!l0) return { indikator: null, entries: [], disposisiChain: [] };

    // All descendant IDs (L1, L2, L3 …)
    const descIds = await this.getAllDescendantIds(indikatorId);
    const allIds = [indikatorId, ...descIds];

    // Cross-read: include linked IKU realisasi for PK, and linked PK realisasi for IKU
    const linkedExtraIds: number[] = [];
    for (const id of descIds) {
      if (l0.jenis === 'PK') {
        const ind = await this.indikatorRepository.findOne({ where: { id } });
        if (ind?.linkedIkuId) linkedExtraIds.push(ind.linkedIkuId);
      } else {
        const linked = await this.indikatorRepository.find({ where: { linkedIkuId: id } });
        linkedExtraIds.push(...linked.map((l) => l.id));
      }
    }
    const effectiveIds = [...new Set([...descIds, ...linkedExtraIds])];

    // ── Realisasi entries (unchanged) ─────────────────────────────────────────
    const entries: any[] = [];
    for (const leafId of effectiveIds) {
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

    // ── Disposisi chain ───────────────────────────────────────────────────────
    const disposisiChain: any[] = [];
    if (allIds.length > 0) {
      const allDisposisi = await this.disposisiRepository.find({
        where: { indikatorId: In(allIds), tahun },
        relations: ['toUser', 'indikator'],
        order: { id: 'ASC' },
      });

      for (const d of allDisposisi) {
        // Match realisasi: prefer disposisi-linked, fallback to createdBy
        let realisasiList = await this.realisasiRepository.find({
          where: { disposisiId: d.id },
        });
        if (realisasiList.length === 0 && d.toUserId) {
          realisasiList = await this.realisasiRepository.find({
            where: { indikatorId: d.indikatorId, tahun, createdBy: d.toUserId },
          });
        }

        const realisasiJumlah = realisasiList.reduce(
          (s, r) => s + Number(r.realisasiAngka), 0,
        );
        const status: 'tercapai' | 'proses' | 'belum_input' =
          realisasiList.length === 0
            ? 'belum_input'
            : realisasiJumlah >= Number(d.jumlahTarget)
              ? 'tercapai'
              : 'proses';

        const indikatorHierarchy = await this.getIndikatorHierarchy(d.indikatorId);
        disposisiChain.push({
          disposisiId: d.id,
          parentDisposisiId: d.parentId,
          indikatorId: d.indikatorId,
          indikatorKode: d.indikator?.kode ?? '',
          indikatorNama: d.indikator?.nama ?? '',
          indikatorLevel: d.indikator?.level ?? 0,
          indikatorHierarchy,
          toUserId: d.toUserId,
          toUserNama: (d.toUser as any)?.nama ?? `User ${d.toUserId}`,
          toUserEmail: (d.toUser as any)?.email ?? '',
          jumlahTarget: Number(d.jumlahTarget),
          realisasiJumlah,
          realisasiStatus: status,
        });
      }
    }

    return {
      indikator: { id: l0.id, kode: l0.kode, nama: l0.nama, jenis: l0.jenis },
      entries,
      disposisiChain,
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

  async getValidasiBiroPKU(tahun: string): Promise<ValidasiBiroPKU[]> {
    return this.validasiBiroPKURepository.find({ where: { tahun } });
  }

  async upsertValidasiBiroPKU(data: {
    indikatorId: number;
    tahun: string;
    jumlahValid: number | null;
    keterangan?: string;
    inputBy?: number;
  }): Promise<ValidasiBiroPKU> {
    let record = await this.validasiBiroPKURepository.findOne({
      where: { indikatorId: data.indikatorId, tahun: data.tahun },
    });
    if (!record) {
      record = this.validasiBiroPKURepository.create({
        indikatorId: data.indikatorId,
        tahun: data.tahun,
      });
    }
    record.jumlahValid = data.jumlahValid ?? null;
    record.keterangan = data.keterangan ?? null;
    record.inputBy = data.inputBy ?? null;
    return this.validasiBiroPKURepository.save(record);
  }

  async bulkUpsertValidasiBiroPKU(items: {
    indikatorId: number;
    tahun: string;
    jumlahValid: number | null;
    keterangan?: string;
    inputBy?: number;
  }[]): Promise<{ saved: number; skipped: number }> {
    let saved = 0;
    let skipped = 0;
    for (const item of items) {
      try {
        await this.upsertValidasiBiroPKU(item);
        saved++;
      } catch {
        skipped++;
      }
    }
    return { saved, skipped };
  }

  /** Jumlah realisasi yang diajukan per leaf indikator (sebelum override Biro PKU).
   *  Return: Record<indikatorId, totalRealisasi>
   */
  async getRealisasiCounts(jenis: string, tahun: string): Promise<Record<number, number>> {
    // Cari semua leaf indikator berdasarkan jenis
    const leafLevel = jenis === 'IKU' ? 2 : 3;
    const leafIndikators = await this.indikatorRepository.find({ where: { jenis, level: leafLevel } });
    if (leafIndikators.length === 0) return {};

    const ids = leafIndikators.map((i) => i.id);
    const result: Record<number, number> = {};

    // Sum dari tabel realisasi (realisasi_angka)
    const realisasiRows = await this.realisasiRepository
      .createQueryBuilder('r')
      .select('r.indikator_id', 'indikatorId')
      .addSelect('SUM(r.realisasi_angka)', 'total')
      .where('r.indikator_id IN (:...ids)', { ids })
      .andWhere('r.tahun = :tahun', { tahun })
      .groupBy('r.indikator_id')
      .getRawMany<{ indikatorId: number; total: string }>();

    for (const row of realisasiRows) {
      result[row.indikatorId] = Number(row.total) || 0;
    }

    // Count dari tabel realisasi_file (file per indikator)
    const fileRows = await this.realisasiFileRepository
      .createQueryBuilder('f')
      .select('f.indikator_id', 'indikatorId')
      .addSelect('COUNT(f.id)', 'total')
      .where('f.indikator_id IN (:...ids)', { ids })
      .andWhere('f.tahun = :tahun', { tahun })
      .groupBy('f.indikator_id')
      .getRawMany<{ indikatorId: number; total: string }>();

    for (const row of fileRows) {
      const fileCount = Number(row.total) || 0;
      // Ambil nilai terbesar antara formal submission dan file count
      result[row.indikatorId] = Math.max(result[row.indikatorId] ?? 0, fileCount);
    }

    return result;
  }

  /**
   * Kembalikan daftar L0 indikator ID yang berada dalam scope seorang user.
   * Scope ditentukan dari: (1) cascadeChain pada indikator, (2) disposisi langsung ke user.
   */
  async getScopeForUser(userId: number, tahun: string, jenis: string): Promise<number[]> {
    const l0s = await this.indikatorRepository.find({ where: { level: 0, jenis } });
    const inScope: number[] = [];

    const flattenChain = (chain: unknown[]): number[] =>
      chain.flatMap(x => (Array.isArray(x) ? flattenChain(x) : typeof x === 'number' ? [x] : []));

    for (const l0 of l0s) {
      const descendantIds = await this.getAllDescendantIds(l0.id);
      const allIds = [l0.id, ...descendantIds];

      // 1. Check cascade chain di semua indikator dalam grup ini
      const indicators = await this.indikatorRepository.findBy({ id: In(allIds) });
      const inChain = indicators.some(ind => {
        if (!ind.cascadeChain) return false;
        try {
          return flattenChain(JSON.parse(ind.cascadeChain)).includes(userId);
        } catch { return false; }
      });

      if (inChain) { inScope.push(l0.id); continue; }

      // 2. Check disposisi langsung ke user ini
      const disp = await this.disposisiRepository.findOne({
        where: { indikatorId: In(allIds), toUserId: userId, tahun },
      });
      if (disp) inScope.push(l0.id);
    }

    return inScope;
  }
}
