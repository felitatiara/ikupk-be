import {
  Controller, Get, Post, Put, Delete,
  Query, Param, Body, ParseIntPipe, HttpCode,
} from '@nestjs/common';
import { IndikatorService } from './indikator.service';
import { EventsService } from '../events/events.service';

@Controller('indikator')
export class IndikatorController {
  constructor(
    private readonly indikatorService: IndikatorService,
    private readonly eventsService: EventsService,
  ) {}

  @Get('years')
  findAvailableYears() {
    return this.indikatorService.findAvailableYears();
  }

  @Get('monitoring-bawahan')
  getMonitoringBawahan(
    @Query('jenis') jenis: string,
    @Query('tahun') tahun: string,
    @Query('userId', ParseIntPipe) userId: number,
    @Query('roleLevel', ParseIntPipe) roleLevel: number,
  ) {
    return this.indikatorService.getMonitoringBawahan(jenis, tahun, userId, roleLevel);
  }

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

  @Get('iku-options')
  getIkuOptions(@Query('tahun') tahun: string) {
    return this.indikatorService.getIkuOptions(tahun);
  }

  @Get(':id/cascade-chain')
  getCascadeChain(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.getCascadeChain(id);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.indikatorService.findOne(id);
  }

  // ── Mutations — emit SSE event after each successful write ────────────────

  @Post()
  async create(
    @Body() data: {
      jenis: string; kode: string; nama: string; tahun: string; level: number;
      parentId?: number | null; jenisData?: string | null; sumberData?: string;
      linkedIkuId?: number | null; kategori?: string | null;
    },
  ) {
    const result = await this.indikatorService.create(data);
    this.eventsService.emit('indikator', 'created', result.id);
    return result;
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: {
      jenis?: string; kode?: string; nama?: string; tahun?: string; level?: number;
      parentId?: number | null; jenisData?: string | null; sumberData?: string;
      linkedIkuId?: number | null; kategori?: string | null;
    },
  ) {
    const result = await this.indikatorService.update(id, data);
    this.eventsService.emit('indikator', 'updated', id);
    return result;
  }

  @Post(':id/cascade-chain')
  async saveCascadeChain(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { chain: (number | number[])[] },
  ) {
    const result = await this.indikatorService.saveCascadeChain(id, body.chain);
    this.eventsService.emit('cascade', 'updated', id);
    return result;
  }

  @Post('import-bulk')
  async importBulk(
    @Body() body: {
      jenis: string; tahun: string;
      rows: Array<{
        kode: string; nama: string; level: number; parentKode: string | null;
        kategori: string | null; tenggat: string | null; target: number | null;
        satuan: string | null; sumberData: string;
      }>;
    },
  ) {
    const result = await this.indikatorService.importBulk(body.jenis, body.tahun, body.rows);
    this.eventsService.emit('indikator', 'bulk');
    return result;
  }

  @Post('copy-year')
  async copyFromYear(@Body() body: { fromTahun: string; toTahun: string }) {
    const result = await this.indikatorService.copyFromYear(body.fromTahun, body.toTahun);
    this.eventsService.emit('indikator', 'bulk', undefined, { toTahun: body.toTahun });
    return result;
  }

  @Delete('all')
  @HttpCode(204)
  async removeAll(@Query('tahun') tahun?: string) {
    await this.indikatorService.removeAll(tahun);
    this.eventsService.emit('indikator', 'bulk', undefined, { tahun });
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    const result = await this.indikatorService.remove(id);
    this.eventsService.emit('indikator', 'deleted', id);
    return result;
  }
}
