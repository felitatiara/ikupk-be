import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Realisasi } from './realisasi.entity';
import { RealisasiService } from './realisasi.service';
import { RealisasiController } from './realisasi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Realisasi])],
  providers: [RealisasiService],
  controllers: [RealisasiController],
  exports: [RealisasiService],
})
export class RealisasiModule {}
