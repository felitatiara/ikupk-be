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
}

