import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SkpHasilStatus } from './skp-hasil.entity';
import { SkpHasilService } from './skp-hasil.service';
import { SkpHasilController } from './skp-hasil.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SkpHasilStatus])],
  providers: [SkpHasilService],
  controllers: [SkpHasilController],
  exports: [SkpHasilService],
})
export class SkpHasilModule {}
