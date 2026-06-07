import { Controller, Get, Post, Body, Param, ParseIntPipe, Query, DefaultValuePipe } from '@nestjs/common';
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

  @Get('disposisi-dosen')
  async getDisposisiDosen(
    @Query('fromUserId', ParseIntPipe) fromUserId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.monitoringService.getDisposisiDosen(fromUserId, tahun);
  }

  @Get('validasi-biro-pku')
  async getValidasiBiroPKU(@Query('tahun') tahun: string) {
    return this.monitoringService.getValidasiBiroPKU(tahun);
  }

  @Post('validasi-biro-pku')
  async upsertValidasiBiroPKU(
    @Body() body: { indikatorId: number; tahun: string; jumlahValid: number | null; keterangan?: string; inputBy?: number },
  ) {
    return this.monitoringService.upsertValidasiBiroPKU(body);
  }

  @Get('scope')
  async getScopeForUser(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
    @Query('jenis', new DefaultValuePipe('IKU')) jenis: string,
  ) {
    return this.monitoringService.getScopeForUser(userId, tahun, jenis);
  }
}
