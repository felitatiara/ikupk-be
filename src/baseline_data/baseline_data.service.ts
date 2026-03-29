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

  async findAll(): Promise<BaselineData[]> {
    return this.baselineDataRepository.find();
  }

  async findByUnit(unitId: number): Promise<BaselineData[]> {
    return this.baselineDataRepository.find({ where: { unitId } });
  }

  async findByIndikatorAndUnit(indikatorId: number, unitId: number): Promise<BaselineData[]> {
    return this.baselineDataRepository.find({ where: { indikatorId, unitId } });
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
