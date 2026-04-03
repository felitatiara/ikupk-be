import { Controller, Get, Post, Put, Delete, Param, Body, ParseIntPipe } from '@nestjs/common';
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

  @Post()
  create(@Body() body: { jenis: string; kode: string; nama: string; level: number; parentId?: number | null }) {
    return this.indikatorService.create(body);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<{ jenis: string; kode: string; nama: string; level: number; parentId: number | null }>) {
    return this.indikatorService.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.remove(id);
  }
}
