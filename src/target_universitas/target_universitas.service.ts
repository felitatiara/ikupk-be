import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TargetUniversitas } from './target_universitas.entity';

@Injectable()
export class TargetUniversitasService {
  constructor(
    @InjectRepository(TargetUniversitas)
    private readonly repo: Repository<TargetUniversitas>,
  ) {}

  findAll(): Promise<TargetUniversitas[]> {
    return this.repo.find();
  }

  findByIndikatorAndTahun(indikatorId: number, tahun: string): Promise<TargetUniversitas | null> {
    return this.repo.findOne({ where: { indikatorId, tahun } });
  }

  async upsert(indikatorId: number, tahun: string, targetAngka: number): Promise<TargetUniversitas> {
    let record = await this.repo.findOne({ where: { indikatorId, tahun } });
    if (record) {
      record.targetAngka = targetAngka;
    } else {
      record = this.repo.create({ indikatorId, tahun, targetAngka });
    }
    return this.repo.save(record);
  }
}
