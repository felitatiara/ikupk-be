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

  @Get('admin/targets-grouped')
  getAdminTargetsGrouped() {
    return this.targetsService.getAdminTargetsGrouped();
  }

  @Get('iku-pk')
  getIkuPk(@Query('unitId', ParseIntPipe) unitId: number, @Query('userId') userId?: string) {
    return this.targetsService.getIkuPk(unitId, userId ? Number(userId) : undefined);
  }

  @Get('dekan-validasi')
  getDekanValidasi(@Query('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getForDekanValidasi(unitId);
  }

  @Get('pending-fakultas')
  getPendingFakultas(@Query('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getPendingFakultas(unitId);
  }

  @Get('target-items')
  getTargetItems(
    @Query('unitId', ParseIntPipe) unitId: number,
    @Query('rootIndikatorId', ParseIntPipe) rootIndikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.targetsService.getTargetItemsByRoot(unitId, rootIndikatorId, tahun);
  }

  @Patch(':id/target-fakultas')
  inputTargetFakultas(
    @Param('id', ParseIntPipe) id: number,
    @Body('targetUniversitas') targetUniversitas: number,
  ) {
    return this.targetsService.inputTargetFakultas(id, targetUniversitas);
  }

  @Post('submit-fakultas')
  submitFakultas(
    @Body() body: { items: { targetId: number; targetUniversitas: number }[] },
  ) {
    return this.targetsService.submitTargetFakultas(body.items);
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
  create(@Body() body: { indikatorId: number; unitId: number; tahun: string; targetUniversitas?: number | null }) {
    return this.targetsService.create(body);
  }

  @Post('upsert-target-universitas')
  upsertTargetUniversitas(@Body() body: { indikatorId: number; unitId: number; tahun: string; targetUniversitas: number }) {
    return this.targetsService.upsertTargetUniversitas(body.indikatorId, body.unitId, body.tahun, body.targetUniversitas);
  }
}
