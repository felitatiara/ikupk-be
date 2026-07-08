import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkpRencanaStatus } from './skp-rencana.entity';
import { SkpRencanaService } from './skp-rencana.service';
import { SkpRencanaController } from './skp-rencana.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkpRencanaStatus])],
  providers: [SkpRencanaService],
  controllers: [SkpRencanaController],
  exports: [SkpRencanaService],
})
export class SkpRencanaModule {}
