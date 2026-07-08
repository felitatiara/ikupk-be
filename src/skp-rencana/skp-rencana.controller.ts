import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { SkpRencanaService } from './skp-rencana.service';

@Controller('skp-rencana')
export class SkpRencanaController {
  constructor(private readonly service: SkpRencanaService) {}

  @Get('status')
  getStatus(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.service.getStatus(userId, tahun);
  }

  /** Pegawai menyetujui Rencana SKP (tanpa TTD) — draft → disetujui_pegawai */
  @Post('setuju-pegawai')
  setujuByPegawai(@Body() body: { userId: number; tahun: string }) {
    return this.service.setujuByPegawai(body.userId, body.tahun);
  }

  /** Atasan langsung memvalidasi Rencana SKP bawahan — disetujui_pegawai → tervalidasi_atasan */
  @Post('validasi-atasan')
  validasiByAtasan(@Body() body: { targetUserId: number; tahun: string }) {
    return this.service.validasiByAtasan(body.targetUserId, body.tahun);
  }

  @Post('sign-pihak-kedua')
  signByPihakKedua(
    @Body() body: { targetUserId: number; tahun: string; signature?: string | null },
  ) {
    return this.service.signByPihakKedua(body.targetUserId, body.tahun, body.signature ?? null);
  }
}
