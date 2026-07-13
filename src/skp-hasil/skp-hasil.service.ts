import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SkpHasilStatus } from './skp-hasil.entity';
import { SkpRevisionLog } from '../skp-rencana/skp-revision-log.entity';
import { Notification } from '../notifications/notification.entity';

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
    @InjectRepository(SkpRevisionLog)
    private readonly revisionRepo: Repository<SkpRevisionLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
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

  /** Kembalikan Hasil SKP untuk revisi — status → needs_revision */
  async returnForRevision(
    targetUserId: number,
    tahun: string,
    reason: string | null,
    note: string | null,
    revisedByUserId: number,
  ) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    const fromStatus = existing?.status ?? 'signed_pegawai';

    if (existing) {
      await this.repo.update(existing.id, {
        status: 'needs_revision',
        revisionCount: (existing.revisionCount ?? 0) + 1,
      });
    } else {
      await this.repo.save(
        this.repo.create({ userId: targetUserId, tahun, status: 'needs_revision' }),
      );
    }

    await this.revisionRepo.save(
      this.revisionRepo.create({
        userId: targetUserId,
        tahun,
        docType: 'hasil',
        fromStatus,
        reason,
        note,
        revisedByUserId,
        resubmittedAt: null,
      }),
    );

    const reasonText = reason ? ` (${reason})` : '';
    await this.notifRepo.save(
      this.notifRepo.create({
        userId: targetUserId,
        message: `Hasil SKP Anda dikembalikan untuk revisi${reasonText}. Harap perbaiki dan ajukan kembali.`,
        type: 'skp_revision_requested',
        tahun,
        isRead: false,
      }),
    );

    return this.getStatus(targetUserId, tahun);
  }

  /** Pegawai mengajukan kembali setelah revisi — status kembali ke fromStatus */
  async resubmitByPegawai(userId: number, tahun: string) {
    const latestLog = await this.revisionRepo.findOne({
      where: { userId, tahun, docType: 'hasil', resubmittedAt: IsNull() },
      order: { revisedAt: 'DESC' },
    });

    const targetStatus = latestLog?.fromStatus ?? 'signed_pegawai';
    const existing = await this.repo.findOne({ where: { userId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, { status: targetStatus });
    }

    if (latestLog) {
      await this.revisionRepo.update(latestLog.id, { resubmittedAt: new Date() });
    }

    return this.getStatus(userId, tahun);
  }

  /** Ambil semua log revisi untuk satu user (hasil SKP) */
  async getRevisionLogs(userId: number, tahun: string): Promise<SkpRevisionLog[]> {
    return this.revisionRepo.find({
      where: { userId, tahun, docType: 'hasil' },
      order: { revisedAt: 'DESC' },
    });
  }
}
