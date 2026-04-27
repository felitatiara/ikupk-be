import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Disposisi } from './disposisi.entity';

@Injectable()
export class DisposisiService {
  constructor(
    @InjectRepository(Disposisi)
    private disposisiRepo: Repository<Disposisi>,
  ) {}

  async findByIndikator(
    indikatorId: number,
    tahun: string,
    fromUserId?: number | null,
  ): Promise<Disposisi[]> {
    const where: any = { indikatorId, tahun };
    if (fromUserId !== undefined) {
      where.fromUserId = fromUserId;
    }
    return this.disposisiRepo.find({
      where,
      relations: ['toUser', 'toUser.userRoles', 'toUser.userRoles.role', 'parent'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * Total jumlahTarget yang diterima toUserId untuk indikator ini.
   * Dipakai untuk validasi agar re-disposisi tidak melebihi yang diterima.
   */
  async getReceivedJumlah(
    toUserId: number,
    indikatorId: number,
    tahun: string,
  ): Promise<number> {
    const received = await this.disposisiRepo.find({
      where: { toUserId, indikatorId, tahun },
    });
    return received.reduce((sum, d) => sum + Number(d.jumlahTarget), 0);
  }

  /**
   * Simpan/update batch disposisi dari satu user ke banyak user.
   * Disposisi lama dari fromUserId untuk indikator+tahun yang sama akan dihapus dulu.
   */
  async upsertMultiple(
    indikatorId: number,
    tahun: string,
    items: { toUserId: number; jumlahTarget: number }[],
    fromUserId?: number | null,
    parentId?: number | null,
  ): Promise<Disposisi[]> {
    if (fromUserId) {
      const received = await this.getReceivedJumlah(fromUserId, indikatorId, tahun);
      if (received > 0) {
        const totalRequested = items.reduce((sum, i) => sum + i.jumlahTarget, 0);
        if (totalRequested > received) {
          throw new BadRequestException(
            `Total disposisi (${totalRequested}) melebihi jumlah yang Anda terima (${received})`,
          );
        }
      }
    }

    const deleteQb = this.disposisiRepo
      .createQueryBuilder()
      .delete()
      .where('indikator_id = :indikatorId', { indikatorId })
      .andWhere('tahun = :tahun', { tahun });

    if (fromUserId) {
      deleteQb.andWhere('from_user_id = :fromUserId', { fromUserId });
    } else {
      deleteQb.andWhere('from_user_id IS NULL');
    }

    await deleteQb.execute();

    const entities = items
      .filter((item) => item.jumlahTarget > 0)
      .map((item) =>
        this.disposisiRepo.create({
          indikatorId,
          tahun,
          toUserId: item.toUserId,
          jumlahTarget: item.jumlahTarget,
          fromUserId: fromUserId ?? null,
          parentId: parentId ?? null,
          status: 'diterima',
        }),
      );

    if (entities.length === 0) return [];
    return this.disposisiRepo.save(entities);
  }

  /**
   * Ambil seluruh rantai disposisi di bawah sebuah parentId (untuk rollup capaian).
   */
  async findChain(parentId: number): Promise<Disposisi[]> {
    return this.disposisiRepo.find({
      where: { parentId },
      relations: ['toUser', 'toUser.userRoles', 'toUser.userRoles.role'],
    });
  }

  async remove(id: number): Promise<void> {
    await this.disposisiRepo.delete(id);
  }
}
