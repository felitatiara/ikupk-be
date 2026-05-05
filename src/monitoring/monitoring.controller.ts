import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';

@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get('aggregated')
  async getAggregated(
    @Query('tahun') tahun: string,
    @Query('jenis') jenis: string,
  ) {
    return this.monitoringService.getAggregatedProgress(tahun, jenis);
  }

  @Get('indikator/:id/detail')
  async getIndikatorDetail(
    @Param('id', ParseIntPipe) id: number,
    @Query('tahun') tahun: string,
  ) {
    return this.monitoringService.getIndikatorDetail(id, tahun);
  }

  @Get('progress')
  async getProgress(
    @Query('unitId') unitId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.monitoringService.getUnitProgress(unitId, tahun);
  }
}
