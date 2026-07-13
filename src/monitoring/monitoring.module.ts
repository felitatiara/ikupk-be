import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { TargetUniversitas } from '../target/target.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { Realisasi } from '../realisasi/realisasi.entity';
import { RealisasiFile } from '../realisasi/realisasi-file.entity';
import { Indikator } from '../indikator/indikator.entity';
import { BaselineData } from '../baseline_data/baseline_data.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { ValidasiBiroPKU } from './validasi-biro-pku.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TargetUniversitas,
      TargetUnit,
      Realisasi,
      RealisasiFile,
      Indikator,
      BaselineData,
      User,
      UserRole,
      Disposisi,
      ValidasiBiroPKU,
    ]),
  ],
  controllers: [MonitoringController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
