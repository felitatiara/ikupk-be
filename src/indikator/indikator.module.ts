import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indikator } from './indikator.entity';
import { IndikatorService } from './indikator.service';
import { Target } from '../target/target.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, Target])],
  providers: [IndikatorService],
  exports: [IndikatorService],
})
export class IndikatorModule {}
