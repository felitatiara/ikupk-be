import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { Target } from '../target/target.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { Indikator } from '../indikator/indikator.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Target, Realisasi, Indikator])],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
