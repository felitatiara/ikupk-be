import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from './indikator.entity';
import { Target } from '../target/target.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';

@Injectable()
export class IndikatorService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepository: Repository<Indikator>,
    @InjectRepository(Target)
    private targetRepo: Repository<Target>,
    @InjectRepository(BaselineData)
    private baselineRepo: Repository<BaselineData>,
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

  async findGrouped(jenis: string, tahun: string) {
    const all = await this.indikatorRepository.find({ where: { jenis }, order: { kode: 'ASC' } });

    // Level 0 = sasaran strategis (root, no parent)
    const roots = all.filter((i) => i.level === 0);

    const result: any[] = [];

    for (const root of roots) {
      // Level 1 children = sub indikator
      const level1 = all.filter((i) => i.level === 1 && i.parentId === root.id);

      // Build sub indikator rows: level 1 + their level 2 children
      const subIndikators: { id: number; kode: string; nama: string; level: number; parentId: number | null; children: { id: number; kode: string; nama: string; level: number }[] }[] = [];

      for (const l1 of level1) {
        const level2 = all.filter((i) => i.level === 2 && i.parentId === l1.id);
        subIndikators.push({
          id: l1.id,
          kode: l1.kode,
          nama: l1.nama,
          level: l1.level,
          parentId: l1.parentId,
          children: level2.map((l2) => ({ id: l2.id, kode: l2.kode, nama: l2.nama, level: l2.level })),
        });
      }

      // Get target universitas for this root from target table
      const t = await this.targetRepo.findOne({ where: { indikatorId: root.id, tahun } });

      // Get baseline data for this root (unit_id=1 = Fakultas Ilmu Komputer)
      const bl = await this.baselineRepo.findOne({ where: { indikatorId: root.id, unitId: 1, tahun } });

      result.push({
        id: root.id,
        kode: root.kode,
        nama: root.nama,
        targetUniversitas: t ? Number(t.targetUniversitas) : null,
        targetUniversitasTahun: tahun,
        baselineJumlah: bl ? bl.jumlah : null,
        subIndikators,
      });
    }

    return result;
  }
}
