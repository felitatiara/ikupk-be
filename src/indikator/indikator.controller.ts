import {
  Controller, Get, Post, Put, Delete,
  Query, Param, Body, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { IndikatorService } from './indikator.service';

@Controller('indikator')
export class IndikatorController {
  constructor(private readonly indikatorService: IndikatorService) {}

  /** Daftar tahun yang sudah ada indikatornya — untuk dropdown pilih tahun */
  @Get('years')
  findAvailableYears() {
    return this.indikatorService.findAvailableYears();
  }

  /** Monitoring disposisi bawahan: siapa dapat target apa */
  @Get('monitoring-bawahan')
  getMonitoringBawahan(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('userId', ParseIntPipe) userId: number,
    @Query('roleLevel', ParseIntPipe) roleLevel: number,
  ) {
    return this.indikatorService.getMonitoringBawahan(jenis, tahun, userId, roleLevel);
  }

  /** Laporan hierarki IKU/PK dengan target + realisasi untuk export Excel */
  @Get('laporan')
  getLaporanWithRealisasi(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('roleId', ParseIntPipe) roleId: number,
    @Query('periode') periode?: string,
  ) {
    return this.indikatorService.getLaporanWithRealisasi(jenis, tahun, roleId, periode);
  }

  @Get()
  findAll(@Query('tahun') tahun?: string) {
    return this.indikatorService.findAll(tahun);
  }

  @Get('subindikator')
  findSubindikator(@Query('tahun') tahun?: string) {
    return this.indikatorService.findSubindikator(tahun);
  }

  @Get('grouped')
  findGrouped(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('roleId') roleId?: string,
  ) {
    return this.indikatorService.findGrouped(jenis, tahun, roleId ? Number(roleId) : undefined);
  }

  @Get('pengajuan-grouped')
  findPengajuanGrouped(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.indikatorService.findPengajuanGrouped(jenis, tahun, roleId);
  }

  @Get('grouped-user')
  findGroupedForUser(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('userId', ParseIntPipe) userId: number,
    @Query('roleId', ParseIntPipe) roleId: number,
  ) {
    return this.indikatorService.findGroupedForUser(jenis, tahun, userId, roleId);
  }

  /** Copy semua indikator dari tahun lama ke tahun baru */
  @Post('copy-year')
  copyFromYear(@Body() body: { fromTahun: string; toTahun: string }) {
    return this.indikatorService.copyFromYear(body.fromTahun, body.toTahun);
  }

  @Post()
  create(
    @Body() data: {
      jenis: string;
      kode: string;
      nama: string;
      tahun: string;
      level: number;
      parentId?: number | null;
      jenisData?: string | null;
    },
  ) {
    return this.indikatorService.create(data);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      jenis?: string;
      kode?: string;
      nama?: string;
      tahun?: string;
      level?: number;
      parentId?: number | null;
      jenisData?: string | null;
      sumberData?: string;
    },
  ) {
    return this.indikatorService.update(id, data);
  }

  /** Hapus semua indikator — jika ?tahun= diberikan, hanya hapus tahun itu */
  @Get(':id/cascade-chain')
  getCascadeChain(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.getCascadeChain(id);
  }

  @Post(':id/cascade-chain')
  saveCascadeChain(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { chain: number[] },
  ) {
    return this.indikatorService.saveCascadeChain(id, body.chain);
  }

  @Delete('all')
  @HttpCode(204)
  removeAll(@Query('tahun') tahun?: string) {
    return this.indikatorService.removeAll(tahun);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.remove(id);
  }
}
