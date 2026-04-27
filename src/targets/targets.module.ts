import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TargetsService } from './targets.service';
import { TargetsController } from './targets.controller';
import { Indikator } from '../indikator/indikator.entity';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Realisasi } from '../realisasi/realisasi.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Indikator, TargetUniversitas, TargetUnit, Role, UserRole, User, Disposisi, Realisasi])],
  providers: [TargetsService],
  controllers: [TargetsController],
  exports: [TargetsService],
})
export class TargetsModule {}
