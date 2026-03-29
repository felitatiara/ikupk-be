import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BaselineData } from './baseline_data.entity';
import { BaselineDataService } from './baseline_data.service';
import { BaselineDataController } from './baseline_data.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BaselineData])],
  providers: [BaselineDataService],
  controllers: [BaselineDataController],
  exports: [BaselineDataService],
})
export class BaselineDataModule {}
