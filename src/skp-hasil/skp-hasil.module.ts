import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkpHasilStatus } from './skp-hasil.entity';
import { SkpHasilService } from './skp-hasil.service';
import { SkpHasilController } from './skp-hasil.controller';
import { SkpRevisionLog } from '../skp-rencana/skp-revision-log.entity';
import { Notification } from '../notifications/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SkpHasilStatus, SkpRevisionLog, Notification])],
  providers: [SkpHasilService],
  controllers: [SkpHasilController],
  exports: [SkpHasilService],
})
export class SkpHasilModule {}
