import { Controller, Get, Post, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TargetsService } from './targets.service';

@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  getAll() {
    return this.targetsService.getAll();
  }

  @Get('unit/:unitId')
  getByUnit(@Param('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getTargetDetailByUnit(unitId);
  }

  @Get('admin/pku')
  getAdminPKU() {
    return this.targetsService.getTargetsForAdminPKU();
  }

  @Get('iku-pk')
  getIkuPk(@Query('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getIkuPk(unitId);
  }

  @Post()
  create(@Body() body: { indikatorId: number; unitId: number; tahun: string; targetAngka: number; targetUniversitas?: number | null }) {
    return this.targetsService.create(body);
  }
}
