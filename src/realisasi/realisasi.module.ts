import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Realisasi } from './realisasi.entity';
import { RealisasiFile } from './realisasi-file.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { UserRelation } from '../users/user_relation.entity';
import { Indikator } from '../indikator/indikator.entity';
import { UserRole } from '../roles/user-role.entity';
import { Role } from '../roles/role.entity';
import { SkpPenilaiConfig } from '../skp-penilai/skp-penilai.entity';
import { RealisasiService } from './realisasi.service';
import { RealisasiController } from './realisasi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Realisasi, RealisasiFile, Disposisi, TargetUnit, UserRelation, Indikator, UserRole, Role, SkpPenilaiConfig])],
  providers: [RealisasiService],
  controllers: [RealisasiController],
  exports: [RealisasiService],
})
export class RealisasiModule {}
