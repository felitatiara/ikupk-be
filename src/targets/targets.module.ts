import { Module } from '@nestjs/common';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Target } from '../target/target.entity';
import { Unit } from '../unit/unit.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, Target, Unit])],
  providers: [TargetsService],
  controllers: [TargetsController],
  exports: [TargetsService],
})
export class TargetsModule {}
