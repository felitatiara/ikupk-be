import { Module } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Target } from '../target/target.entity';
import { Unit } from '../unit/unit.entity';
import { TargetUniversitas } from '../target_universitas/target_universitas.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, Target, Unit, TargetUniversitas])],
  providers: [TargetsService],
  controllers: [TargetsController],
  exports: [TargetsService],
})
export class TargetsModule {}
