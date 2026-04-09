import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disposisi } from './disposisi.entity';

@Injectable()
export class DisposisiService {
  constructor(
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
  ) {}

  async findByIndikator(indikatorId: number, unitId: number, tahun: string, disposedBy?: number | null): Promise<Disposisi[]> {
    const where: any = { indikatorId, unitId, tahun };
    if (disposedBy !== undefined) {
      where.disposedBy = disposedBy;
    }
    return this.disposisiRepo.find({
      where,
      relations: ['assignedUser'],
      order: { createdAt: 'ASC' },
    });
  }

  async upsertMultiple(
    indikatorId: number,
    unitId: number,
    tahun: string,
    items: { assignedTo: number; jumlah: number }[],
    disposedBy?: number | null,
  ): Promise<Disposisi[]> {
    // Remove existing disposisi for this indikator+unit+tahun+disposedBy
    const deleteWhere: any = { indikatorId, unitId, tahun };
    if (disposedBy !== undefined && disposedBy !== null) {
      deleteWhere.disposedBy = disposedBy;
    } else {
      deleteWhere.disposedBy = null as any;
    }
    await this.disposisiRepo.delete(deleteWhere);

    // Insert new ones
    const entities = items
      .filter((item) => item.jumlah > 0)
      .map((item) =>
        this.disposisiRepo.create({
          indikatorId,
          unitId,
          tahun,
          assignedTo: item.assignedTo,
          jumlah: item.jumlah,
          disposedBy: disposedBy ?? null,
        }),
      );

    if (entities.length === 0) return [];
    return this.disposisiRepo.save(entities);
  }

  async remove(id: number): Promise<void> {
    await this.disposisiRepo.delete(id);
  }
}
