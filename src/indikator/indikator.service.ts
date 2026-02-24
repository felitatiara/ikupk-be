import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from './indikator.entity';

@Injectable()
export class IndikatorService {
  constructor(
    @InjectRepository(Indikator)
    private indikatorRepository: Repository<Indikator>,
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
}
