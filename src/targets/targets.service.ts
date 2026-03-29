import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Target } from '../target/target.entity';
import { Unit } from '../unit/unit.entity';
import { TargetUniversitas } from '../target_universitas/target_universitas.entity';

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
  targetAngka: number;
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
    @InjectRepository(TargetUniversitas)
    private targetUnivRepo: Repository<TargetUniversitas>,
  ) {}

  async getAll(): Promise<TargetRow[]> {
    const indiks = await this.indikatorRepo.find();
    const rows: TargetRow[] = [];

    for (const ind of indiks) {
      // fetch associated target rows
      const targets = await this.targetRepo.find({ where: { indikatorId: ind.id } });

      if (targets.length > 0) {
        targets.forEach((t) => {
          rows.push({
            date: this.formatDate(t.createdAt ?? ind.createdAt),
            title: ind.nama,
            sasaran: '',
            capaian: t.targetAngka !== null && t.targetAngka !== undefined ? String(t.targetAngka) : '',
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
      targetAngka: t.targetAngka,
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
        tahun: indikator.tahun,
        targets: targets.map((t) => ({
          id: t.id,
          unitId: t.unitId,
          unitNama: t.unit?.nama || '',
          tahun: t.tahun,
          targetAngka: t.targetAngka,
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

  async getIkuPk(unitId: number): Promise<any[]> {
    // Start from target table, filtered by unit_id, with relations
    const targets = await this.targetRepo.find({
      where: { unitId },
      relations: ['indikator', 'targetUniversitasRel'],
    });

    const result: any[] = [];

    for (const t of targets) {
      const indikator = t.indikator;
      if (!indikator) continue;

      // Use target_universitas_id FK to get target_universitas data
      const tu = t.targetUniversitasRel as any;

      const jenisLabel = indikator.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      result.push({
        id: t.id,
        indikatorId: t.indikatorId,
        tahun: t.tahun,
        target: jenisLabel,
        sasaranStrategis: indikator.nama,
        targetUniversitas: tu ? Number(tu.targetAngka) : 0,
        capaian: Number(t.targetAngka) || 0,
        tenggat: t.tahun,
        unitId: t.unitId,
      });
    }

    return result;
  }

  async create(data: { indikatorId: number; unitId: number; tahun: string; targetAngka: number; targetUniversitas?: number | null }): Promise<Target> {
    const target = this.targetRepo.create({
      indikatorId: data.indikatorId,
      unitId: data.unitId,
      tahun: data.tahun,
      targetAngka: data.targetAngka,
      targetUniversitas: data.targetUniversitas ?? null,
    });
    return this.targetRepo.save(target);
  }
}

