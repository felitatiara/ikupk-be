import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Realisasi } from './realisasi.entity';

@Injectable()
export class RealisasiService {
  constructor(
    @InjectRepository(Realisasi)
    private readonly realisasiRepository: Repository<Realisasi>,
  ) {}

  async findAll(): Promise<Realisasi[]> {
    return this.realisasiRepository.find({
      relations: ['target', 'target.indikator', 'creator'],
    });
  }

  async getForValidasi(): Promise<any[]> {
    const list = await this.realisasiRepository.find({
      relations: ['target', 'target.indikator'],
    });

    return list.map((r) => {
      const indikator = (r.target as any)?.indikator;
      const jenis = indikator?.jenis?.toUpperCase() === 'IKU'
        ? 'Indikator Kinerja Utama'
        : 'Perjanjian Kerja';

      return {
        id: r.id,
        targetId: r.targetId,
        tahun: (r.target as any)?.tahun || '',
        target: jenis,
        sasaranStrategis: indikator?.nama || '',
        realisasiAngka: Number(r.realisasiAngka),
        status: r.status,
        createdAt: r.createdAt,
      };
    });
  }

  async updateStatus(id: number, status: string): Promise<Realisasi> {
    await this.realisasiRepository.update(id, { status });
    return this.realisasiRepository.findOneOrFail({ where: { id } });
  }

  async create(data: Partial<Realisasi>): Promise<Realisasi> {
    const realisasi = this.realisasiRepository.create(data);
    return this.realisasiRepository.save(realisasi);
  }
}
