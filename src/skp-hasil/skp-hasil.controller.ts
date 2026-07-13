import { Controller, Get, Post, Body, Query, ParseIntPipe, Request } from '@nestjs/common';
import { SkpHasilService } from './skp-hasil.service';

@Controller('skp-hasil')
export class SkpHasilController {
  constructor(private readonly service: SkpHasilService) {}

  @Get('status')
  getStatus(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.service.getStatus(userId, tahun);
  }

  /** Pegawai mengajukan Hasil SKP — pending → signed_pegawai */
  @Post('submit-pegawai')
  submitByPegawai(@Body() body: { userId: number; tahun: string; signature?: string | null }) {
    return this.service.submitByPegawai(body.userId, body.tahun, body.signature ?? null);
  }

  /** Checker memvalidasi Hasil SKP — signed_pegawai → checked */
  @Post('check-checker')
  checkByChecker(@Body() body: { targetUserId: number; tahun: string; signature?: string | null }) {
    return this.service.checkByChecker(body.targetUserId, body.tahun, body.signature ?? null);
  }

  /** Pejabat Penilai menandatangani Hasil SKP — checked → signed_penilai */
  @Post('sign-penilai')
  signByPenilai(@Body() body: { targetUserId: number; tahun: string; signature?: string | null }) {
    return this.service.signByPenilai(body.targetUserId, body.tahun, body.signature ?? null);
  }

  /** Kembalikan Hasil SKP untuk revisi (oleh checker / penilai) */
  @Post('return-revision')
  returnForRevision(
    @Body() body: { targetUserId: number; tahun: string; reason?: string; note?: string },
    @Request() req: any,
  ) {
    const revisedByUserId: number = req.user?.userId ?? req.user?.id ?? 0;
    return this.service.returnForRevision(
      body.targetUserId,
      body.tahun,
      body.reason ?? null,
      body.note ?? null,
      revisedByUserId,
    );
  }

  /** Pegawai mengajukan kembali Hasil SKP setelah revisi */
  @Post('resubmit')
  resubmit(@Body() body: { tahun: string }, @Request() req: any) {
    const userId: number = req.user?.userId ?? req.user?.id ?? 0;
    return this.service.resubmitByPegawai(userId, body.tahun);
  }

  /** Ambil riwayat revisi Hasil SKP untuk satu user */
  @Get('revisions')
  getRevisions(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.service.getRevisionLogs(userId, tahun);
  }
}
