import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kriteria } from './kriteria.entity';

@Injectable()
export class KriteriaService {
  constructor(
    @InjectRepository(Kriteria)
    private kriteriaRepository: Repository<Kriteria>,
  ) {}

  findAll() {
    return this.kriteriaRepository.find();
  }
}
