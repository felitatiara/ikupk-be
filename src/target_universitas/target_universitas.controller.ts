import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { TargetUniversitasService } from './target_universitas.service';

@Controller('target-universitas')
export class TargetUniversitasController {
  constructor(private readonly service: TargetUniversitasService) {}

  @Get()
  findAll(
    @Query('indikatorId') indikatorId?: string,
    @Query('tahun') tahun?: string,
  ) {
    if (indikatorId && tahun) {
      return this.service.findByIndikatorAndTahun(Number(indikatorId), tahun);
    }
    return this.service.findAll();
  }

  @Post()
  upsert(@Body() body: { indikatorId: number; tahun: string; targetAngka: number }) {
    return this.service.upsert(body.indikatorId, body.tahun, body.targetAngka);
  }
}
