import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkpRencanaStatus } from './skp-rencana.entity';

@Injectable()
export class SkpRencanaService {
  constructor(
    @InjectRepository(SkpRencanaStatus)
    private readonly repo: Repository<SkpRencanaStatus>,
  ) {}

  async getStatus(userId: number, tahun: string) {
    const record = await this.repo.findOne({ where: { userId, tahun } });
    return record ?? { userId, tahun, status: 'draft', signaturePegawai: null, signaturePihakKedua: null, signedAtPegawai: null, signedAtPihakKedua: null };
  }

  /** Pegawai menyetujui target (tanpa TTD) — draft → disetujui_pegawai */
  async setujuByPegawai(userId: number, tahun: string) {
    const existing = await this.repo.findOne({ where: { userId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, { status: 'disetujui_pegawai', signedAtPegawai: new Date() });
    } else {
      await this.repo.save(this.repo.create({ userId, tahun, status: 'disetujui_pegawai', signedAtPegawai: new Date() }));
    }
    return this.getStatus(userId, tahun);
  }

  /** Atasan langsung memvalidasi rencana SKP bawahan — disetujui_pegawai → tervalidasi_atasan */
  async validasiByAtasan(targetUserId: number, tahun: string) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, { status: 'tervalidasi_atasan' });
    } else {
      await this.repo.save(this.repo.create({ userId: targetUserId, tahun, status: 'tervalidasi_atasan' }));
    }
    return this.getStatus(targetUserId, tahun);
  }

  async signByPihakKedua(targetUserId: number, tahun: string, signature: string | null) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, {
        status: 'signed_pihak_kedua',
        signaturePihakKedua: signature ?? null,
        signedAtPihakKedua: new Date(),
      });
    } else {
      await this.repo.save(
        this.repo.create({
          userId: targetUserId,
          tahun,
          status: 'signed_pihak_kedua',
          signaturePihakKedua: signature ?? null,
          signedAtPihakKedua: new Date(),
        }),
      );
    }
    return this.getStatus(targetUserId, tahun);
  }

  async getStatusForUsers(userIds: number[], tahun: string): Promise<Map<number, string>> {
    if (userIds.length === 0) return new Map();
    const records = await this.repo
      .createQueryBuilder('s')
      .where('s.user_id IN (:...ids)', { ids: userIds })
      .andWhere('s.tahun = :tahun', { tahun })
      .getMany();
    const map = new Map<number, string>();
    for (const r of records) map.set(r.userId, r.status);
    return map;
  }
}
