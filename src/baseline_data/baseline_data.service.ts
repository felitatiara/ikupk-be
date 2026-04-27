import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaselineData } from './baseline_data.entity';

@Injectable()
export class BaselineDataService {
  constructor(
    @InjectRepository(BaselineData)
    private readonly baselineDataRepository: Repository<BaselineData>,
  ) {}

  async findAll(tahun?: string): Promise<BaselineData[]> {
    if (tahun) return this.baselineDataRepository.find({ where: { tahun } });
    return this.baselineDataRepository.find();
  }

  async findByJenisDataAndTahun(jenisData: string, tahun: string): Promise<BaselineData | null> {
    return this.baselineDataRepository.findOne({ where: { jenisData, tahun } });
  }

  async upsert(data: { jenisData: string; tahun: string; jumlah: number; keterangan?: string }): Promise<BaselineData> {
    let existing = await this.baselineDataRepository.findOne({
      where: { jenisData: data.jenisData, tahun: data.tahun },
    });
    if (existing) {
      existing.jumlah = data.jumlah;
      if (data.keterangan !== undefined) existing.keterangan = data.keterangan ?? null;
      return this.baselineDataRepository.save(existing);
    }
    return this.baselineDataRepository.save(
      this.baselineDataRepository.create({
        jenisData: data.jenisData,
        tahun: data.tahun,
        jumlah: data.jumlah,
        keterangan: data.keterangan ?? null,
      }),
    );
  }

  async create(data: Partial<BaselineData>): Promise<BaselineData> {
    const baseline = this.baselineDataRepository.create(data);
    return this.baselineDataRepository.save(baseline);
  }

  async update(id: number, data: Partial<BaselineData>): Promise<BaselineData | null> {
    await this.baselineDataRepository.update(id, data);
    return this.baselineDataRepository.findOne({ where: { id } });
  }

  async delete(id: number): Promise<void> {
    await this.baselineDataRepository.delete(id);
  }
}
