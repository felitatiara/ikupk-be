import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkpPenilaiConfig } from './skp-penilai.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { SkpRencanaStatus } from '../skp-rencana/skp-rencana.entity';
import { SkpHasilStatus } from '../skp-hasil/skp-hasil.entity';
import { SkpPenilaiService } from './skp-penilai.service';
import { SkpPenilaiController } from './skp-penilai.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkpPenilaiConfig, Role, User, UserRole, Realisasi, SkpRencanaStatus, SkpHasilStatus])],
  providers: [SkpPenilaiService],
  controllers: [SkpPenilaiController],
  exports: [SkpPenilaiService],
})
export class SkpPenilaiModule {}
