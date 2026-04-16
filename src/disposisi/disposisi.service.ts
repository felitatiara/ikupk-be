import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disposisi } from './disposisi.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class DisposisiService {
  constructor(
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
    private usersService: UsersService,
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
    // Cek jika disposedBy diisi, pastikan usernya role pimpinan
    if (disposedBy) {
      const user = await this.usersService.findOne(disposedBy);
      if (!user || user.role.toLowerCase() !== 'pimpinan') {
        throw new ForbiddenException('Hanya user dengan role pimpinan yang dapat melakukan disposisi');
      }
    }
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
