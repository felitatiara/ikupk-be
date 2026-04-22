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

  /**
   * Mengambil total jumlah yang diterima user tertentu untuk indikator ini.
   * Jika disposedBy null → memeriksa disposisi dari pimpinan (row dengan disposedBy IS NULL).
   * Jika disposedBy ada → memeriksa disposisi dari user tersebut.
   */
  async getReceivedJumlah(
    assignedTo: number,
    indikatorId: number,
    unitId: number,
    tahun: string,
  ): Promise<number> {
    // Ambil semua disposisi yang diterima oleh assignedTo untuk indikator ini
    const received = await this.disposisiRepo.find({
      where: { assignedTo, indikatorId, unitId, tahun },
    });
    return received.reduce((sum, d) => sum + Number(d.jumlah), 0);
  }

  async upsertMultiple(
    indikatorId: number,
    unitId: number,
    tahun: string,
    items: { assignedTo: number; jumlah: number }[],
    disposedBy?: number | null,
  ): Promise<Disposisi[]> {
    // Jika disposedBy diisi, pastikan total re-disposisi tidak melebihi
    // jumlah yang diterima disposedBy dari tahap sebelumnya.
    if (disposedBy) {
      const received = await this.getReceivedJumlah(disposedBy, indikatorId, unitId, tahun);
      if (received > 0) {
        const totalRequested = items.reduce((sum, i) => sum + i.jumlah, 0);
        if (totalRequested > received) {
          throw new BadRequestException(
            `Total disposisi (${totalRequested}) melebihi jumlah yang Anda terima (${received})`,
          );
        }
      }
    }

    // Hapus disposisi lama dari disposedBy ini untuk indikator ini
    // Memastikan tidak ada data ganda meskipun unitId berubah
    const deleteWhere: any = { indikatorId, tahun };
    if (disposedBy) {
      deleteWhere.disposedBy = disposedBy;
    } else {
      deleteWhere.disposedBy = null as any;
    }
    
    console.log(`DisposisiService: Deleting old records for indikator ${indikatorId}, year ${tahun}, disposedBy ${disposedBy}`);
    await this.disposisiRepo.delete(deleteWhere);

    // Simpan yang baru
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
    console.log(`DisposisiService: Saving ${entities.length} items for indikator ${indikatorId}, unit ${unitId}, year ${tahun}`);
    return this.disposisiRepo.save(entities);
  }

  async remove(id: number): Promise<void> {
    await this.disposisiRepo.delete(id);
  }
}
