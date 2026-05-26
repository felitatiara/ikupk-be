import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Indikator } from './indikator.entity';
import { IndikatorService } from './indikator.service';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { RealisasiFile } from '../realisasi/realisasi-file.entity';
import { UserRelation } from '../users/user_relation.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';
import { IndikatorController } from './indikator.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, TargetUniversitas, TargetUnit, BaselineData, Disposisi, Realisasi, RealisasiFile, UserRelation, User, UserRole])],
  providers: [IndikatorService],
  controllers: [IndikatorController],
  exports: [IndikatorService],
})
export class IndikatorModule {}
