import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkpHasilStatus } from './skp-hasil.entity';

const EMPTY = (userId: number, tahun: string) => ({
  userId, tahun, status: 'pending',
  signaturePegawai: null, signatureChecker: null, signaturePenilai: null,
  signedAtPegawai: null, checkedAt: null, signedAtPenilai: null,
});

@Injectable()
export class SkpHasilService {
  constructor(
    @InjectRepository(SkpHasilStatus)
    private readonly repo: Repository<SkpHasilStatus>,
  ) {}

  async getStatus(userId: number, tahun: string) {
    const record = await this.repo.findOne({ where: { userId, tahun } });
    return record ?? EMPTY(userId, tahun);
  }

  /** Pegawai mengajukan Hasil SKP — pending → signed_pegawai */
  async submitByPegawai(userId: number, tahun: string, signature: string | null) {
    const existing = await this.repo.findOne({ where: { userId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, {
        status: 'signed_pegawai',
        signaturePegawai: signature ?? null,
        signedAtPegawai: new Date(),
      });
    } else {
      await this.repo.save(this.repo.create({
        userId, tahun,
        status: 'signed_pegawai',
        signaturePegawai: signature ?? null,
        signedAtPegawai: new Date(),
      }));
    }
    return this.getStatus(userId, tahun);
  }

  /** Checker memvalidasi Hasil SKP — signed_pegawai → checked */
  async checkByChecker(targetUserId: number, tahun: string, signature: string | null) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, {
        status: 'checked',
        signatureChecker: signature ?? null,
        checkedAt: new Date(),
      });
    } else {
      await this.repo.save(this.repo.create({
        userId: targetUserId, tahun, status: 'checked',
        signatureChecker: signature ?? null, checkedAt: new Date(),
      }));
    }
    return this.getStatus(targetUserId, tahun);
  }

  /** Pejabat Penilai menandatangani Hasil SKP — checked → signed_penilai */
  async signByPenilai(targetUserId: number, tahun: string, signature: string | null) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, {
        status: 'signed_penilai',
        signaturePenilai: signature ?? null,
        signedAtPenilai: new Date(),
      });
    } else {
      await this.repo.save(this.repo.create({
        userId: targetUserId, tahun,
        status: 'signed_penilai',
        signaturePenilai: signature ?? null,
        signedAtPenilai: new Date(),
      }));
    }
    return this.getStatus(targetUserId, tahun);
  }

  /** Ambil status untuk sekumpulan userId (digunakan oleh SkpPenilaiService) */
  async getStatusMap(userIds: number[], tahun: string): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map();
    const records = await this.repo
      .createQueryBuilder('h')
      .where('h.user_id IN (:...ids)', { ids: userIds })
      .andWhere('h.tahun = :tahun', { tahun })
      .getMany();
    return new Map(records.map((r) => [r.userId, r.status]));
  }
}
