import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TargetUniversitas } from './target_universitas.entity';
import { TargetUniversitasService } from './target_universitas.service';
import { TargetUniversitasController } from './target_universitas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TargetUniversitas])],
  controllers: [TargetUniversitasController],
  providers: [TargetUniversitasService],
  exports: [TargetUniversitasService],
})
export class TargetUniversitasModule {}
