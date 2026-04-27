import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indikator } from './indikator.entity';
import { IndikatorService } from './indikator.service';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { IndikatorController } from './indikator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, TargetUniversitas, TargetUnit, BaselineData, Disposisi])],
  providers: [IndikatorService],
  controllers: [IndikatorController],
  exports: [IndikatorService],
})
export class IndikatorModule {}
