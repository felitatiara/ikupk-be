import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { DisposisiService } from './disposisi.service';

@Controller('disposisi')
export class DisposisiController {
  constructor(private readonly disposisiService: DisposisiService) {}

  @Get()
  find(
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('unitId', ParseIntPipe) unitId: number,
    @Query('tahun') tahun: string,
    @Query('disposedBy') disposedBy?: string,
  ) {
    const db = disposedBy !== undefined ? (disposedBy === 'null' ? null : Number(disposedBy)) : undefined;
    return this.disposisiService.findByIndikator(indikatorId, unitId, tahun, db);
  }

  @Post()
  upsert(
    @Body('indikatorId') indikatorId: number,
    @Body('unitId') unitId: number,
    @Body('tahun') tahun: string,
    @Body('items') items: { assignedTo: number; jumlah: number }[],
    @Body('disposedBy') disposedBy?: number | null,
  ) {
    return this.disposisiService.upsertMultiple(indikatorId, unitId, tahun, items, disposedBy);
  }
}
