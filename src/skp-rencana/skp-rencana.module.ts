import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkpRencanaStatus } from './skp-rencana.entity';
import { SkpRevisionLog } from './skp-revision-log.entity';
import { SkpRencanaService } from './skp-rencana.service';
import { SkpRencanaController } from './skp-rencana.controller';
import { Notification } from '../notifications/notification.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SkpRencanaStatus, SkpRevisionLog, Notification])],
  providers: [SkpRencanaService],
  controllers: [SkpRencanaController],
  exports: [SkpRencanaService],
})
export class SkpRencanaModule {}
