import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Target } from '../target/target.entity';
import { Unit } from '../unit/unit.entity';

export interface TargetRow {
  date: string;
  title: string;
  sasaran: string;
  capaian: string;
}

export interface TargetDetail {
  id: number;
  tenggat: string;
  targetNama: string;
  sasaranStrategis: string;
  capaian: string;
  unitNama: string;
  tahun: string;
  targetUniversitas: number | null;
}

@Injectable()
export class TargetsService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepo: Repository<Indikator>,
    @InjectRepository(Target)
    private targetRepo: Repository<Target>,
    @InjectRepository(Unit)
    private unitRepo: Repository<Unit>,
  ) {}

  async getAll(): Promise<TargetRow[]> {
    const indiks = await this.indikatorRepo.find();
    let rows: TargetRow[] = [];

    // If no indikators in database, return mock data for demo
    if (indiks.length === 0) {
      rows = [
        {
          date: '02 Januari 2025',
          title: 'Perjanjian Kerja',
          sasaran: 'Pemberitahuan kegiatan melalui web Fakultas',
          capaian: '100%',
        },
        {
          date: '02 Januari 2025',
          title: 'Perjanjian Kerja',
          sasaran: 'Laporan Rapat Tinjauan Manajemen (RTM)',
          capaian: '100%',
        },
        {
          date: '02 Januari 2025',
          title: 'Perjanjian Kerja',
          sasaran: 'Penyelesaian LPI',
          capaian: '0%',
        },
        {
          date: '31 Maret 2025',
          title: 'Indikator Kinerja Utama',
          sasaran: 'Meningkatnya kualitas lulusan pendidikan tinggi',
          capaian: '0%',
        },
        {
          date: '31 Maret 2025',
          title: 'Indikator Kinerja Utama',
          sasaran: 'Persentase dosen yang berkegatan tridharma',
          capaian: '0%',
        },
        {
          date: '31 September 2025',
          title: 'Indikator Kinerja Utama',
          sasaran: 'Mahasiswa menghubiskan paling tidak 20 SKS diluar kampus',
          capaian: '0%',
        },
        {
          date: '31 September 2025',
          title: 'Indikator Kinerja Utama',
          sasaran: 'Mahasiswa inbound diterima Pertukaran Mahasiswa Internasional',
          capaian: '0%',
        },
      ];
      return rows;
    }

    for (const ind of indiks) {
      // fetch associated target rows
      const targets = await this.targetRepo.find({ where: { indikatorId: ind.id } });

      if (targets.length > 0) {
        targets.forEach((t) => {
          rows.push({
            date: this.formatDate(t.createdAt ?? ind.createdAt),
            title: ind.nama,
            sasaran: '',
            capaian: t.targetUniversitas !== null && t.targetUniversitas !== undefined ? String(t.targetUniversitas) : '',
          });
        });
      } else {
        // no targets — show the indikator itself
        rows.push({
          date: this.formatDate(ind.createdAt),
          title: ind.nama,
          sasaran: '',
          capaian: '',
        });
      }
    }

    // Sort by date
    rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return rows;
  }

  async getTargetDetailByUnit(unitId: number): Promise<TargetDetail[]> {
    const targets = await this.targetRepo.find({
      where: { unitId },
      relations: ['indikator', 'unit'],
    });

    return targets.map((t) => ({
      id: t.id,
      tenggat: this.formatDate(t.createdAt),
      targetNama: t.indikator?.nama || '',
      sasaranStrategis: t.indikator?.nama || '',
      capaian: '0%',
      unitNama: t.unit?.nama || '',
      tahun: t.tahun,
      targetUniversitas: t.targetUniversitas,
    }));
  }

  async getTargetsForAdminPKU(): Promise<any[]> {
    // Fetch semua indikator
    const indikators = await this.indikatorRepo.find();

    // Untuk setiap indikator, fetch target per unit
    const result: any[] = [];

    for (const indikator of indikators) {
      const targets = await this.targetRepo.find({
        where: { indikatorId: indikator.id },
        relations: ['unit'],
      });

      result.push({
        indikatorId: indikator.id,
        indikatorNama: indikator.nama,
        indikatorKode: indikator.kode,
        indikatorJenis: indikator.jenis,
        parentId: indikator.parentId,
        indikatorTipe: indikator.parentId === null ? 'SASARAN STRATEGIS' : 'INDIKATOR KINERJA KEGIATAN',
        targets: targets.map((t) => ({
          id: t.id,
          unitId: t.unitId,
          unitNama: t.unit?.nama || '',
          tahun: t.tahun,
          targetAngka: t.targetUniversitas,
          createdAt: t.createdAt,
        })),
      });
    }

    return result;
  }

  private formatDate(date: Date | string): string {
    const d = new Date(date);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }

  async getIkuPk(unitId: number, userId?: number): Promise<any[]> {
    // Start from target table, filtered by unit_id and status disposisi
    const where: any = { unitId, status: 'disposisi' };
    if (userId) {
      where.assignedTo = userId;
    }
    const targets = await this.targetRepo.find({
      where,
      relations: ['indikator'],
    });

    const result: any[] = [];

    for (const t of targets) {
      const indikator = t.indikator;
      if (!indikator) continue;

      const jenisLabel = indikator.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      result.push({
        id: t.id,
        indikatorId: t.indikatorId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: indikator.nama,
        targetUniversitas: Number(t.targetUniversitas) || 0,
        capaian: 0,
        tenggat: t.tahun,
        unitId: t.unitId,
      });
    }

    return result;
  }

  async create(data: { indikatorId: number; unitId: number; tahun: string; targetUniversitas?: number | null }): Promise<Target> {
    const target = this.targetRepo.create({
      indikatorId: data.indikatorId,
      unitId: data.unitId,
      tahun: data.tahun,
      targetUniversitas: data.targetUniversitas ?? null,
      status: 'pending_fakultas',
    });
    return this.targetRepo.save(target);
  }

  async getAdminTargetsGrouped(): Promise<any[]> {
    const targets = await this.targetRepo.find({
      relations: ['indikator', 'unit'],
    });

    if (targets.length === 0) return [];

    const allIndikators = await this.indikatorRepo.find();
    const indikatorMap = new Map(allIndikators.map(i => [i.id, i]));

    const findRootIndikator = (indikatorId: number): number => {
      let current = indikatorMap.get(indikatorId);
      while (current && current.parentId) {
        current = indikatorMap.get(current.parentId);
      }
      return current ? current.id : indikatorId;
    };

    const seen = new Map<string, boolean>();
    const results: any[] = [];

    for (const t of targets) {
      const rootId = findRootIndikator(t.indikatorId);
      const key = `${rootId}_${t.tahun}_${t.unitId}`;
      if (seen.has(key)) continue;
      seen.set(key, true);

      const rootIndikator = indikatorMap.get(rootId);
      const jenisLabel = rootIndikator?.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      const tu = t.targetUniversitas;

      const statusLabel = t.status === 'pending_fakultas' ? 'Menunggu Target Fakultas'
        : t.status === 'pending_dekan' ? 'Menunggu Validasi Dekan'
        : t.status === 'disposisi' ? 'Disposisi'
        : t.status;

      results.push({
        id: t.id,
        indikatorId: rootId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: rootIndikator?.nama || '',
        targetUniversitas: Number(tu) || 0,
        unitId: t.unitId,
        unitNama: t.unit?.nama || '',
        status: statusLabel,
        createdAt: t.createdAt,
      });
    }

    return results;
  }

  async getPendingFakultas(unitId: number): Promise<any[]> {
    // Get all target_universitas entries where there are pending_fakultas targets for this unit
    const targets = await this.targetRepo.find({
      where: { unitId, status: 'pending_fakultas' },
      relations: ['indikator'],
    });

    if (targets.length === 0) return [];

    const allIndikators = await this.indikatorRepo.find();
    const indikatorMap = new Map(allIndikators.map(i => [i.id, i]));

    const findRootIndikator = (indikatorId: number): number => {
      let current = indikatorMap.get(indikatorId);
      while (current && current.parentId) {
        current = indikatorMap.get(current.parentId);
      }
      return current ? current.id : indikatorId;
    };

    // Group by root indikator + tahun → one row per target_universitas
    const seen = new Map<string, boolean>();
    const results: any[] = [];

    for (const t of targets) {
      const rootId = findRootIndikator(t.indikatorId);
      const key = `${rootId}_${t.tahun}`;
      if (seen.has(key)) continue;
      seen.set(key, true);

      const rootIndikator = indikatorMap.get(rootId);
      const jenisLabel = rootIndikator?.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      results.push({
        id: t.id,
        indikatorId: rootId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: rootIndikator?.nama || '',
        targetUniversitas: Number(t.targetUniversitas) || 0,
        status: 'pending_fakultas',
        createdAt: t.createdAt,
      });
    }

    return results;
  }

  async getTargetItemsByRoot(unitId: number, rootIndikatorId: number, tahun: string): Promise<any[]> {
    const allIndikators = await this.indikatorRepo.find();
    const indikatorMap = new Map(allIndikators.map(i => [i.id, i]));

    const findRootIndikator = (id: number): number => {
      let current = indikatorMap.get(id);
      while (current && current.parentId) {
        current = indikatorMap.get(current.parentId);
      }
      return current ? current.id : id;
    };

    const childIds = allIndikators.filter(i => findRootIndikator(i.id) === rootIndikatorId).map(i => i.id);

    const targets = await this.targetRepo.find({
      where: childIds.map(cid => ({ indikatorId: cid, unitId, tahun })),
      relations: ['indikator'],
    });

    return targets.map(t => ({
      targetId: t.id,
      indikatorId: t.indikatorId,
      indikatorNama: t.indikator?.nama || '',
      indikatorKode: t.indikator?.kode || '',
      targetUniversitas: Number(t.targetUniversitas) || 0,
      status: t.status,
    }));
  }

  async inputTargetFakultas(id: number, targetUniversitas: number): Promise<Target> {
    await this.targetRepo.update(id, { targetUniversitas, status: 'pending_dekan' });
    return this.targetRepo.findOneOrFail({ where: { id }, relations: ['indikator'] });
  }

  async submitTargetFakultas(items: { targetId: number; targetUniversitas: number }[]): Promise<void> {
    for (const item of items) {
      await this.targetRepo.update(item.targetId, { targetUniversitas: item.targetUniversitas });
    }
  }

  async getForDekanValidasi(unitId: number): Promise<any[]> {
    const targets = await this.targetRepo.find({
      where: { unitId, status: 'pending_dekan' },
      relations: ['indikator'],
    });

    const allIndikators = await this.indikatorRepo.find();
    const indikatorMap = new Map(allIndikators.map(i => [i.id, i]));

    const findRootIndikator = (indikatorId: number): number => {
      let current = indikatorMap.get(indikatorId);
      while (current && current.parentId) {
        current = indikatorMap.get(current.parentId);
      }
      return current ? current.id : indikatorId;
    };

    const results: any[] = [];
    for (const t of targets) {
      const indikator = t.indikator;
      const jenisLabel = indikator?.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      const rootId = findRootIndikator(t.indikatorId);
      const rootIndikator = indikatorMap.get(rootId);

      results.push({
        id: t.id,
        indikatorId: t.indikatorId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: rootIndikator?.nama || indikator?.nama || '',
        targetUniversitas: Number(t.targetUniversitas) || 0,
        capaian: 0,
        status: t.status,
        createdAt: t.createdAt,
      });
    }

    return results;
  }

  async updateStatus(id: number, status: string, assignedTo?: number): Promise<Target> {
    const update: any = { status };
    if (assignedTo !== undefined) {
      update.assignedTo = assignedTo;
    }
    await this.targetRepo.update(id, update);
    return this.targetRepo.findOneOrFail({ where: { id } });
  }

  async upsertTargetUniversitas(indikatorId: number, unitId: number, tahun: string, targetUniversitas: number): Promise<Target> {
    let target = await this.targetRepo.findOne({ where: { indikatorId, unitId, tahun } });
    if (target) {
      target.targetUniversitas = targetUniversitas;
      return this.targetRepo.save(target);
    }
    target = this.targetRepo.create({ indikatorId, unitId, tahun, targetUniversitas, status: 'pending_fakultas' });
    return this.targetRepo.save(target);
  }
}

