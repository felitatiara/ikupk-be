import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kriteria } from './kriteria.entity';
import { KriteriaService } from './kriteria.service';
import { KriteriaController } from './kriteria.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Kriteria])],
  providers: [KriteriaService],
  controllers: [KriteriaController],
  exports: [KriteriaService],
})
export class KriteriaModule {}
