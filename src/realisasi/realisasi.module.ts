import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Realisasi } from './realisasi.entity';
import { Disposisi } from '../disposisi/disposisi.entity';
import { Target } from '../target/target.entity';
import { RealisasiService } from './realisasi.service';
import { RealisasiController } from './realisasi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Realisasi, Disposisi, Target])],
  providers: [RealisasiService],
  controllers: [RealisasiController],
  exports: [RealisasiService],
})
export class RealisasiModule {}
