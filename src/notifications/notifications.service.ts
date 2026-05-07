import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Notification } from './notification.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Indikator } from '../indikator/indikator.entity';
import { UserRole } from '../roles/user-role.entity';

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
  ) {}

  async getForUser(userId: number): Promise<Notification[]> {
    return this.notifRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(id: number, userId: number): Promise<void> {
    await this.notifRepo.update({ id, userId }, { isRead: true });
  }

  async markAllRead(userId: number): Promise<void> {
    await this.notifRepo.update({ userId, isRead: false }, { isRead: true });
  }

  /** Triwulan string + tahun → Date (last day of quarter) */
  private parseTenggat(tenggat: string, tahun: string): Date | null {
    const year = parseInt(tahun, 10);
    if (isNaN(year)) return null;

    const t = tenggat.trim().toLowerCase();
    if (t === 'triwulan i')   return new Date(year, 2, 31);   // 31 Mar
    if (t === 'triwulan ii')  return new Date(year, 5, 30);   // 30 Jun
    if (t === 'triwulan iii') return new Date(year, 8, 30);   // 30 Sep
    if (t === 'triwulan iv')  return new Date(year, 11, 31);  // 31 Dec

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
