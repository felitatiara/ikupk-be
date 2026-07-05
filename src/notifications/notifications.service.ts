import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification } from './notification.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Indikator } from '../indikator/indikator.entity';
import { UserRole } from '../roles/user-role.entity';
import { Disposisi } from '../disposisi/disposisi.entity';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notifRepo: Repository<Notification>,
    @InjectRepository(TargetUniversitas)
    private readonly targetUniRepo: Repository<TargetUniversitas>,
    @InjectRepository(TargetUnit)
    private readonly targetUnitRepo: Repository<TargetUnit>,
    @InjectRepository(Indikator)
    private readonly indikatorRepo: Repository<Indikator>,
    @InjectRepository(UserRole)
    private readonly userRoleRepo: Repository<UserRole>,
    @InjectRepository(Disposisi)
    private readonly disposisiRepo: Repository<Disposisi>,
  ) {}

  async getForUser(userId: number): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /** Real-time check: returns deadlines relevant to the given user (within window [-60, 7] days).
   *  A deadline is relevant if the user has a TargetUnit role assignment OR a Disposisi
   *  for any indikator under the L0 target. */
  async getUpcomingDeadlines(userId: number): Promise<{
    indikatorId: number;
    indikatorNama: string;
    l1Names: string[];
    tenggat: string;
    tahun: string;
    daysUntil: number;
  }[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get all roleIds assigned to this user
    const userRoles = await this.userRoleRepo.find({ where: { userId } });
    const userRoleIds = userRoles.map(ur => ur.roleId);

    const uniTargets = await this.targetUniRepo.find();
    const results: { indikatorId: number; indikatorNama: string; l1Names: string[]; tenggat: string; tahun: string; daysUntil: number }[] = [];

    for (const target of uniTargets) {
      if (!target.tenggat) continue;

      const deadline = this.parseTenggat(target.tenggat, target.tahun);
      if (!deadline) continue;
      deadline.setHours(0, 0, 0, 0);

      const daysUntil = Math.round(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysUntil > 7 || daysUntil < -60) continue;

      // Collect all descendant IDs (L1, L2, ...) including the L0 itself
      const descIds = await this.getAllDescendantIds(target.indikatorId);
      const allIds = [target.indikatorId, ...descIds];

      // Check 1: does user have a TargetUnit role for any descendant?
      let isRelevant = false;
      if (userRoleIds.length > 0) {
        const unitMatch = await this.targetUnitRepo.findOne({
          where: { indikatorId: In(allIds), roleId: In(userRoleIds), tahun: target.tahun },
        });
        if (unitMatch) isRelevant = true;
      }

      // Check 2: has user received Disposisi for any descendant?
      if (!isRelevant) {
        const disposisiMatch = await this.disposisiRepo.findOne({
          where: { indikatorId: In(allIds), toUserId: userId, tahun: target.tahun },
        });
        if (disposisiMatch) isRelevant = true;
      }

      if (!isRelevant) continue;

      const indikator = await this.indikatorRepo.findOne({ where: { id: target.indikatorId } });
      const l1Children = await this.indikatorRepo.find({
        where: { parentId: target.indikatorId },
        order: { kode: 'ASC' },
      });

      results.push({
        indikatorId: target.indikatorId,
        indikatorNama: indikator?.nama ?? 'Indikator',
        l1Names: l1Children.map(c => `${c.kode} ${c.nama}`),
        tenggat: target.tenggat,
        tahun: target.tahun,
        daysUntil,
      });
    }

    return results;
  }

  async markRead(id: number, userId: number): Promise<void> {
    await this.notifRepo.update({ id, userId }, { isRead: true });
  }

  async markAllRead(userId: number): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  /** Triwulan string + tahun → Date (last day of quarter).
   *  Supports both Roman numerals ("Triwulan I") and Arabic ("Triwulan 1"). */
  private parseTenggat(tenggat: string, tahun: string): Date | null {
    const year = parseInt(tahun, 10);
    if (isNaN(year)) return null;

    const t = tenggat.trim().toLowerCase();
    if (t === 'triwulan i'   || t === 'triwulan 1') return new Date(year, 2, 31);   // 31 Mar
    if (t === 'triwulan ii'  || t === 'triwulan 2') return new Date(year, 5, 30);   // 30 Jun
    if (t === 'triwulan iii' || t === 'triwulan 3') return new Date(year, 8, 30);   // 30 Sep
    if (t === 'triwulan iv'  || t === 'triwulan 4') return new Date(year, 11, 31);  // 31 Dec

    const d = new Date(tenggat);
    return isNaN(d.getTime()) ? null : d;
  }

  /** Collect all descendant indikator IDs (inclusive of parentId itself) */
  private async getAllDescendantIds(parentId: number): Promise<number[]> {
    const children = await this.indikatorRepo.find({ where: { parentId } });
    if (children.length === 0) return [parentId];
    const ids: number[] = [];
    for (const child of children) {
      ids.push(child.id);
      ids.push(...(await this.getAllDescendantIds(child.id)));
    }
    return ids;
  }

  /** Runs every day at 08:00. Sends notifications 7 and 1 day before tenggat. */
  @Cron('0 8 * * *')
  async checkDeadlines() {
    this.logger.log('Checking tenggat deadlines...');
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const uniTargets = await this.targetUniRepo.find();

    for (const target of uniTargets) {
      if (!target.tenggat) continue;

      const deadline = this.parseTenggat(target.tenggat, target.tahun);
      if (!deadline) continue;
      deadline.setHours(0, 0, 0, 0);

      const daysUntil = Math.round(
        (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
      );

      const notifType =
        daysUntil === 7 ? 'tenggat_7hari' :
        daysUntil === 1 ? 'tenggat_1hari' : null;

      if (!notifType) continue;

      // Find all descendant indikator IDs under this L0
      const descIds = await this.getAllDescendantIds(target.indikatorId);

      // Find target_unit records for those indikators in this tahun
      const unitTargets = await this.targetUnitRepo.find({
        where: { indikatorId: In(descIds), tahun: target.tahun },
      });

      const roleIds = [...new Set(unitTargets.map((t) => t.roleId))];
      if (roleIds.length === 0) continue;

      // Find users assigned to those roles
      const userRoles = await this.userRoleRepo.find({
        where: { roleId: In(roleIds) },
      });

      const userIds = [...new Set(userRoles.map((ur) => ur.userId))];
      if (userIds.length === 0) continue;

      const indikator = await this.indikatorRepo.findOne({
        where: { id: target.indikatorId },
      });

      const hariLabel = notifType === 'tenggat_7hari' ? '7 hari' : '1 hari';
      const message = `Tenggat "${indikator?.nama ?? 'Indikator'}" (${target.tenggat} ${target.tahun}) tinggal ${hariLabel} lagi. Segera input realisasi!`;

      for (const userId of userIds) {
        const exists = await this.notifRepo.findOne({
          where: {
            userId,
            type: notifType,
            indikatorId: target.indikatorId,
            tahun: target.tahun,
          },
        });
        if (exists) continue;

        await this.notifRepo.save({
          userId,
          message,
          type: notifType,
          indikatorId: target.indikatorId,
          tahun: target.tahun,
          isRead: false,
        });
      }
    }

    this.logger.log('Deadline check complete.');
  }
}
