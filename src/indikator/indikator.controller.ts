import { Controller, Get, Post, Put, Delete, Query, Param, Body, ParseIntPipe, HttpCode } from '@nestjs/common';
import { IndikatorService } from './indikator.service';

@Controller('indikator')
export class IndikatorController {
  constructor(private readonly indikatorService: IndikatorService) {}

  @Get()
  findAll() {
    return this.indikatorService.findAll();
  }

  @Get('subindikator')
  findSubindikator() {
    return this.indikatorService.findSubindikator();
  }

  @Get('grouped')
  findGrouped(@Query('jenis') jenis: string, @Query('tahun') tahun: string, @Query('unitId') unitId?: string) {
    return this.indikatorService.findGrouped(jenis, tahun, unitId ? Number(unitId) : undefined);
  }

  @Get('pengajuan-grouped')
  findPengajuanGrouped(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('unitId', ParseIntPipe) unitId: number,
  ) {
    return this.indikatorService.findPengajuanGrouped(jenis, tahun, unitId);
  }

  @Get('grouped-user')
  findGroupedForUser(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('userId', ParseIntPipe) userId: number,
    @Query('unitId', ParseIntPipe) unitId: number,
  ) {
    return this.indikatorService.findGroupedForUser(jenis, tahun, userId, unitId);
  }

  @Post()
  create(@Body() data: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null; jenisData?: string | null; isPkBerbasisIku?: boolean }) {
    return this.indikatorService.create(data);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { jenis?: string; kode?: string; nama?: string; level?: number; parentId?: number | null; jenisData?: string | null; isPkBerbasisIku?: boolean }) {
    return this.indikatorService.update(id, data);
  }

  @Delete('all')
  @HttpCode(204)
  removeAll() {
    return this.indikatorService.removeAll();
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.remove(id);
  }
}
