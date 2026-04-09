import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe } from '@nestjs/common';
import { RealisasiService } from './realisasi.service';

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

  @Post()
  create(@Body() body: { targetId: number; realisasiAngka: number; fileUrl?: string; createdBy?: number }) {
    return this.realisasiService.create(body);
  }

  @Post('from-file')
  submitFromFile(
    @Body() body: {
      indikatorId: number;
      unitId: number;
      tahun: string;
      periode: string;
      fileCount: number;
      userId: number;
    },
  ) {
    return this.realisasiService.submitFromFile(body);
  }
}
