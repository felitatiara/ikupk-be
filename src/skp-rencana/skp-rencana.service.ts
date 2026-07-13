import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { SkpRencanaStatus } from './skp-rencana.entity';
import { SkpRevisionLog } from './skp-revision-log.entity';
import { Notification } from '../notifications/notification.entity';

@Injectable()
export class SkpRencanaService {
  constructor(
    @InjectRepository(SkpRencanaStatus)
    private readonly repo: Repository<SkpRencanaStatus>,
    @InjectRepository(SkpRevisionLog)
    private readonly revisionRepo: Repository<SkpRevisionLog>,
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
  ) {}

  async getStatus(userId: number, tahun: string) {
    const record = await this.repo.findOne({ where: { userId, tahun } });
    if (!record) {
      return { userId, tahun, status: 'draft', signaturePegawai: null, signatureChecker: null, signaturePihakKedua: null, signedAtPegawai: null, checkedAt: null, signedAtPihakKedua: null };
    }
    // Normalize legacy status values from old code
    if (record.status === 'disetujui_pegawai') record.status = 'signed_pegawai';
    else if (record.status === 'tervalidasi_atasan') record.status = 'checked';
    return record;
  }

  /** Pegawai menandatangani Rencana SKP — draft → signed_pegawai */
  async signByPegawai(userId: number, tahun: string, signature: string | null) {
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

  /** Checker memvalidasi Rencana SKP bawahan — signed_pegawai → checked */
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

  /** Pegawai menyetujui target (tanpa TTD) — alias ke signByPegawai tanpa signature */
  async setujuByPegawai(userId: number, tahun: string) {
    return this.signByPegawai(userId, tahun, null);
  }

  /** Atasan langsung memvalidasi rencana SKP bawahan — signed_pegawai → signed_pihak_kedua (tanpa TTD) */
  async validasiByAtasan(targetUserId: number, tahun: string) {
    const existing = await this.repo.findOne({ where: { userId: targetUserId, tahun } });
    if (existing) {
      await this.repo.update(existing.id, { status: 'signed_pihak_kedua', signedAtPihakKedua: new Date() });
    } else {
      await this.repo.save(this.repo.create({ userId: targetUserId, tahun, status: 'signed_pihak_kedua', signedAtPihakKedua: new Date() }));
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

  /** Kembalikan Rencana SKP untuk revisi — status → needs_revision */
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
        docType: 'rencana',
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
        message: `Rencana SKP Anda dikembalikan untuk revisi${reasonText}. Harap perbaiki dan ajukan kembali.`,
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
      where: { userId, tahun, docType: 'rencana', resubmittedAt: IsNull() },
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

  /** Ambil semua log revisi untuk satu user (rencana SKP) */
  async getRevisionLogs(userId: number, tahun: string): Promise<SkpRevisionLog[]> {
    return this.revisionRepo.find({
      where: { userId, tahun, docType: 'rencana' },
      order: { revisedAt: 'DESC' },
    });
  }
}
