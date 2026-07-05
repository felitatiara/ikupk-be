import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe, Res } from '@nestjs/common';
import type { Response } from 'express';
import { TargetsService } from './targets.service';
import { EventsService } from '../events/events.service';

@Controller('targets')
export class TargetsController {
  constructor(
    private readonly targetsService: TargetsService,
    private readonly eventsService: EventsService,
  ) {}

  // ── Read-only endpoints ───────────────────────────────────────────────────

  @Get()
  getAll() { return this.targetsService.getAll(); }

  @Get('role/:roleId')
  getByRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.targetsService.getTargetDetailByRole(roleId);
  }

  @Get('admin/fik')
  getAdminFIK() { return this.targetsService.getTargetsForAdminFIK(); }

  @Get('admin')
  getAdmin() { return this.targetsService.getTargetsForAdminFIK(); }

  @Get('admin/targets-grouped')
  getAdminTargetsGrouped() { return this.targetsService.getAdminTargetsGrouped(); }

  @Get('iku-pk')
  getIkuPk(@Query('roleId', ParseIntPipe) roleId: number, @Query('userId') userId?: string) {
    return this.targetsService.getIkuPk(roleId, userId ? Number(userId) : undefined);
  }

  @Get('pimpinan-validasi')
  getPimpinanValidasi(@Query('roleId', ParseIntPipe) roleId: number) {
    return this.targetsService.getForPimpinanValidasi(roleId);
  }

  @Get('pending-fakultas')
  getPendingFakultas(@Query('roleId', ParseIntPipe) roleId: number) {
    return this.targetsService.getPendingFakultas(roleId);
  }

  @Get('target-items')
  getTargetItems(
    @Query('roleId', ParseIntPipe) roleId: number,
    @Query('rootIndikatorId', ParseIntPipe) rootIndikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.targetsService.getTargetItemsByRoot(roleId, rootIndikatorId, tahun);
  }

  @Get('target-universitas')
  async getTargetUniversitas(
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
    @Res() res: Response,
  ) {
    const result = await this.targetsService.getTargetUniversitasByIndikator(indikatorId, tahun);
    res.json(result);
  }

  @Get('for-validation')
  getForValidation(
    @Query('roleId') roleId?: string,
    @Query('tahun') tahun?: string,
    @Query('statusValidasi') statusValidasi?: string,
  ) {
    return this.targetsService.getForValidation(roleId ? Number(roleId) : undefined, tahun, statusValidasi);
  }

  @Get('master-skp')
  getMasterSKP(@Query('tahun') tahun?: string, @Query('roleId') roleId?: string) {
    return this.targetsService.getMasterSKP(tahun, roleId ? Number(roleId) : undefined);
  }

  // ── Mutations — emit SSE event after each successful write ────────────────

  @Post()
  async create(@Body() body: { indikatorId: number; roleId?: number; tahun: string; nilai?: number | null }) {
    const result = await this.targetsService.create(body);
    this.eventsService.emit('target', 'created');
    return result;
  }

  @Patch(':id/target-fakultas')
  async inputTargetFakultas(
    @Param('id', ParseIntPipe) id: number,
    @Body('nilaiTarget') nilaiTarget: number,
  ) {
    const result = await this.targetsService.inputTargetFakultas(id, nilaiTarget);
    this.eventsService.emit('target', 'updated', id);
    return result;
  }

  @Post('submit-fakultas')
  async submitFakultas(@Body() body: { items: { targetId: number; targetUniversitas: number }[] }) {
    const result = await this.targetsService.submitTargetFakultas(body.items);
    this.eventsService.emit('target', 'bulk');
    return result;
  }

  @Post('disposisi')
  async disposisi(
    @Body('indikatorId') indikatorId: number,
    @Body('roleId') roleId: number,
    @Body('tahun') tahun: string,
    @Body('assignedTo') assignedTo: number,
  ) {
    const result = await this.targetsService.disposisi(indikatorId, roleId, tahun, assignedTo);
    this.eventsService.emit('target', 'updated');
    return result;
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    const result = await this.targetsService.updateStatus(id, status);
    this.eventsService.emit('target', 'updated', id);
    return result;
  }

  @Post('upsert-target-universitas')
  async upsertTargetUniversitas(
    @Body() body: { indikatorId: number; roleId: number; tahun: string; persentase: number; tenggat?: string; satuan?: string },
  ) {
    const result = await this.targetsService.upsertTargetUniversitas(
      body.indikatorId, body.roleId, body.tahun, body.persentase, body.tenggat, body.satuan,
    );
    this.eventsService.emit('target', 'updated', body.indikatorId);
    return result;
  }

  @Post('upsert-target-fakultas')
  async upsertTargetFakultas(
    @Body() body: { indikatorId: number; roleId: number; tahun: string; targetFakultas: number },
  ) {
    const result = await this.targetsService.upsertTargetFakultas(
      body.indikatorId, body.roleId, body.tahun, body.targetFakultas,
    );
    this.eventsService.emit('target', 'updated', body.indikatorId);
    return result;
  }

  @Patch('master-skp/:userId/status')
  async updateUserSKPStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { status: 'approved' | 'rejected'; tahun?: string },
  ) {
    const result = await this.targetsService.updateUserSKPStatus(userId, body.status, body.tahun);
    this.eventsService.emit('target', 'updated', userId, { kind: 'skp-status' });
    return result;
  }

  @Patch(':id/validation-status')
  async updateValidationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'pending' | 'approved' | 'rejected'; catatanAdmin?: string },
  ) {
    const result = await this.targetsService.updateValidationStatus(id, body.status, body.catatanAdmin);
    this.eventsService.emit('target', 'updated', id, { kind: 'validation' });
    return result;
  }
}
