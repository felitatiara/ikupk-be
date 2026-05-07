import { Controller, Get, Post, Patch, Body, Param, Query, ParseIntPipe } from '@nestjs/common';
import { TargetsService } from './targets.service';

@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  getAll() {
    return this.targetsService.getAll();
  }

  @Get('role/:roleId')
  getByRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.targetsService.getTargetDetailByRole(roleId);
  }

  @Get('admin/fik')
  getAdminFIK() {
    return this.targetsService.getTargetsForAdminFIK();
  }

  @Get('admin')
  getAdmin() {
    return this.targetsService.getTargetsForAdminFIK();
  }

  @Get('admin/targets-grouped')
  getAdminTargetsGrouped() {
    return this.targetsService.getAdminTargetsGrouped();
  }

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

  @Patch(':id/target-fakultas')
  inputTargetFakultas(
    @Param('id', ParseIntPipe) id: number,
    @Body('nilaiTarget') nilaiTarget: number,
  ) {
    return this.targetsService.inputTargetFakultas(id, nilaiTarget);
  }

  @Post('submit-fakultas')
  submitFakultas(@Body() body: { items: { targetId: number; targetUniversitas: number }[] }) {
    return this.targetsService.submitTargetFakultas(body.items);
  }

  @Post('disposisi')
  disposisi(
    @Body('indikatorId') indikatorId: number,
    @Body('roleId') roleId: number,
    @Body('tahun') tahun: string,
    @Body('assignedTo') assignedTo: number,
  ) {
    return this.targetsService.disposisi(indikatorId, roleId, tahun, assignedTo);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.targetsService.updateStatus(id, status);
  }

  @Post()
  create(@Body() body: { indikatorId: number; roleId?: number; tahun: string; nilai?: number | null }) {
    return this.targetsService.create(body);
  }

  @Get('target-universitas')
  getTargetUniversitas(
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.targetsService.getTargetUniversitasByIndikator(indikatorId, tahun);
  }

  @Post('upsert-target-universitas')
  upsertTargetUniversitas(@Body() body: { indikatorId: number; roleId: number; tahun: string; persentase: number; tenggat?: string; satuan?: string }) {
    return this.targetsService.upsertTargetUniversitas(body.indikatorId, body.roleId, body.tahun, body.persentase, body.tenggat, body.satuan);
  }

  @Post('upsert-target-fakultas')
  upsertTargetFakultas(@Body() body: { indikatorId: number; roleId: number; tahun: string; targetFakultas: number }) {
    return this.targetsService.upsertTargetFakultas(body.indikatorId, body.roleId, body.tahun, body.targetFakultas);
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

  @Patch('master-skp/:userId/status')
  updateUserSKPStatus(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: { status: 'approved' | 'rejected'; tahun?: string },
  ) {
    return this.targetsService.updateUserSKPStatus(userId, body.status, body.tahun);
  }

  @Patch(':id/validation-status')
  updateValidationStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { status: 'pending' | 'approved' | 'rejected'; catatanAdmin?: string },
  ) {
    return this.targetsService.updateValidationStatus(id, body.status, body.catatanAdmin);
  }
}
