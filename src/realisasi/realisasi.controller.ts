import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, Query, UseGuards, Req } from '@nestjs/common';
import { RealisasiService } from './realisasi.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('realisasi')
export class RealisasiController {
  constructor(private readonly realisasiService: RealisasiService) {}

  @Get()
  findAll() {
    return this.realisasiService.findAll();
  }

  @Get('validasi')
  getForValidasi() {
    return this.realisasiService.getForValidasi();
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status: string,
  ) {
    return this.realisasiService.updateStatus(id, status);
  }

  /** Semua submission realisasi dosen untuk indikator tertentu — dipakai atasan untuk validasi */
  @Get('submissions')
  getSubmissions(
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.realisasiService.getSubmissions(indikatorId, tahun);
  }

  /** Semua submission realisasi dari bawahan langsung seorang atasan, dikelompokkan per indikator */
  @Get('submissions-for-atasan')
  getSubmissionsForAtasan(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.realisasiService.getSubmissionsForAtasan(userId, tahun);
  }

  /** Atasan menetapkan jumlah file valid pada sebuah submission */
  @Patch(':id/validate-atasan')
  validateAtasan(
    @Param('id', ParseIntPipe) id: number,
    @Body('validFileCount', ParseIntPipe) validFileCount: number,
  ) {
    return this.realisasiService.validateSubmission(id, validFileCount);
  }

  @Post()
  create(@Body() body: { targetId: number; realisasiAngka: number; fileUrl?: string; createdBy?: number }) {
    return this.realisasiService.create(body);
  }

  /** Status SKP milik sendiri (dosen/bawahan) */
  @Get('my-skp')
  getMySkpStatus(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.realisasiService.getMySkpStatus(userId, tahun);
  }

  /** SKP summary per-bawahan untuk atasan; forDekan=true → semua user yang punya realisasi */
  @Get('skp-bawahan')
  getSkpBawahan(
    @Query('atasanId', ParseIntPipe) atasanId: number,
    @Query('tahun') tahun: string,
    @Query('forDekan') forDekan?: string,
  ) {
    return this.realisasiService.getSkpBawahan(atasanId, tahun, forDekan === 'true');
  }

  /** Approve atau reject semua realisasi bawahan untuk tahun tertentu */
  @Patch('skp-bawahan/:userId/approve')
  approveBawahanSkp(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('action') action: 'approved' | 'rejected',
    @Body('tahun') tahun: string,
  ) {
    return this.realisasiService.approveBawahanSkp(userId, action, tahun);
  }

  @UseGuards(JwtAuthGuard)
  @Post('from-file')
  submitFromFile(
    @Req() req: any,
    @Body() body: {
      indikatorId: number;
      tahun: string;
      periode: string;
      fileCount: number;
    },
  ) {
    const userId: number = req.user?.id;
    // userRoles is loaded by JwtStrategy via eager relations; pick primary
    const primaryUserRole =
      req.user?.userRoles?.find((ur: any) => ur.isPrimary) ??
      req.user?.userRoles?.[0];
    const roleId: number | null = primaryUserRole?.roleId ?? null;
    return this.realisasiService.submitFromFile({
      indikatorId: body.indikatorId,
      roleId,
      tahun: body.tahun,
      periode: body.periode,
      fileCount: body.fileCount,
      userId,
    });
  }
}

