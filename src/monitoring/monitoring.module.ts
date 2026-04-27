import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { Indikator } from '../indikator/indikator.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TargetUniversitas, TargetUnit, Realisasi, Indikator, BaselineData])],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
