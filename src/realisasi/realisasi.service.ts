import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Realisasi } from './realisasi.entity';
import { Target } from '../target/target.entity';
import { User } from '../users/user.entity';

export interface RealisasiDetail {
  id: number;
  targetId: number;
  realisasiAngka: number;
  fileUrl: string;
  createdBy: number;
  createdAt: Date;
  target?: Target;
  creator?: User;
}

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
  ) {}

  async findAll(): Promise<Realisasi[]> {
    return this.realisasiRepository.find({
      relations: ['target', 'creator'],
    });
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }

  // Tambahkan method lain sesuai kebutuhan
}
