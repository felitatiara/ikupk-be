import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
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
  getIkuPk(@Query('unitId', ParseIntPipe) unitId: number, @Query('userId') userId?: string) {
    return this.targetsService.getIkuPk(unitId, userId ? Number(userId) : undefined);
  }

  @Get('dekan-validasi')
  getDekanValidasi(@Query('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getForDekanValidasi(unitId);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
    @Body('assignedTo') assignedTo?: number,
  ) {
    return this.targetsService.updateStatus(id, status, assignedTo);
  }

  @Post()
  create(@Body() body: { indikatorId: number; unitId: number; tahun: string; targetAngka: number; targetUniversitas?: number | null }) {
    return this.targetsService.create(body);
  }
}
