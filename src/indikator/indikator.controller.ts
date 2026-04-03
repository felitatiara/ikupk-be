import { Controller, Get, Post, Put, Delete, Query, Param, Body, ParseIntPipe } from '@nestjs/common';
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
  findGrouped(@Query('jenis') jenis: string, @Query('tahun') tahun: string) {
    return this.indikatorService.findGrouped(jenis, tahun);
  }

  @Post()
  create(@Body() data: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null }) {
    return this.indikatorService.create(data);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() data: { jenis?: string; kode?: string; nama?: string; level?: number; parentId?: number | null }) {
    return this.indikatorService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.remove(id);
  }
}
