import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Realisasi } from './realisasi.entity';
import { RealisasiFile } from './realisasi-file.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { TargetUnit } from '../target/target-unit.entity';
import { RealisasiService } from './realisasi.service';
import { RealisasiController } from './realisasi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Realisasi, RealisasiFile, Disposisi, TargetUnit])],
  providers: [RealisasiService],
  controllers: [RealisasiController],
  exports: [RealisasiService],
})
export class RealisasiModule {}
