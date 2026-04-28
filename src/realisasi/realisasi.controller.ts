import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Req } from '@nestjs/common';
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

  @Post()
  create(@Body() body: { targetId: number; realisasiAngka: number; fileUrl?: string; createdBy?: number }) {
    return this.realisasiService.create(body);
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

