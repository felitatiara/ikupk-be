import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, Query, UseGuards, Req, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
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

  /** WD2: semua user yang punya realisasi validated_atasan */
  @Get('submissions-for-wd2')
  getSubmissionsForWD2(@Query('tahun') tahun: string) {
    return this.realisasiService.getSubmissionsForWD2(tahun);
  }

  /** WD2: validasi semua realisasi validated_atasan milik seorang user → validated_wd2 */
  @Patch('skp-wd2/:userId/validate')
  validateWD2(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('tahun') tahun: string,
  ) {
    return this.realisasiService.validateWD2Batch(userId, tahun);
  }

  /** Approve atau reject semua realisasi validated_wd2 bawahan (Dekan) */
  @Patch('skp-bawahan/:userId/approve')
  approveBawahanSkp(
    @Param('userId', ParseIntPipe) userId: number,
    @Body('action') action: 'approved' | 'rejected',
    @Body('tahun') tahun: string,
  ) {
    return this.realisasiService.approveBawahanSkp(userId, action, tahun);
  }

  /** Ambil submission direct-input milik user yang sedang login untuk indikator + tahun */
  @UseGuards(JwtAuthGuard)
  @Get('direct-input')
  getMyDirectInput(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    const userId: number = req.user?.id;
    return this.realisasiService.getMyRealisasiDirect(indikatorId, tahun, userId);
  }

  /** Submit atau upsert realisasi direct-input (sumberData = 'ikupk') */
  @UseGuards(JwtAuthGuard)
  @Post('direct-input')
  submitDirectInput(
    @Req() req: any,
    @Body() body: {
      indikatorId: number;
      tahun: string;
      periode: string;
      realisasiAngka: number;
      keterangan?: string;
    },
  ) {
    const userId: number = req.user?.id;
    const activeRoleId: number | null = req.user?.activeRoleId ?? null;
    const primaryUserRole =
      req.user?.userRoles?.find((ur: any) => ur.isPrimary) ?? req.user?.userRoles?.[0];
    const roleId: number | null = activeRoleId ?? primaryUserRole?.roleId ?? null;
    return this.realisasiService.submitDirect({
      indikatorId: body.indikatorId,
      roleId,
      tahun: body.tahun,
      periode: body.periode,
      realisasiAngka: body.realisasiAngka,
      keterangan: body.keterangan,
      userId,
    });
  }

  /** Upload file bukti langsung ke sistem IKU PK (sumberData = 'ikupk') */
  @UseGuards(JwtAuthGuard)
  @Post('ikupk-upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads/realisasi',
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, uniqueSuffix + extname(file.originalname));
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
  }))
  uploadIkupkFile(
    @Req() req: any,
    @UploadedFile() file: { originalname: string; filename: string },
    @Body() body: { indikatorId: string; tahun: string; periode: string },
  ) {
    const userId: number = req.user?.id;
    return this.realisasiService.saveIkupkFile({
      indikatorId: parseInt(body.indikatorId),
      tahun: body.tahun,
      periode: body.periode,
      fileName: file.originalname,
      fileUrl: `/uploads/realisasi/${file.filename}`,
      createdBy: userId,
    });
  }

  /** Ambil daftar file ikupk milik user login untuk indikator + tahun */
  @UseGuards(JwtAuthGuard)
  @Get('ikupk-files')
  getIkupkFiles(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    const userId: number = req.user?.id;
    return this.realisasiService.getIkupkFiles(indikatorId, tahun, userId);
  }

  /** Ambil daftar file ikupk milik user tertentu — untuk atasan saat validasi */
  @Get('ikupk-files-by-user')
  getIkupkFilesByUser(
    @Query('userId', ParseIntPipe) userId: number,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.realisasiService.getIkupkFiles(indikatorId, tahun, userId);
  }

  /** Hapus file ikupk milik user login */
  @UseGuards(JwtAuthGuard)
  @Delete('ikupk-files/:id')
  deleteIkupkFile(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const userId: number = req.user?.id;
    return this.realisasiService.deleteIkupkFile(id, userId);
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
    const activeRoleId: number | null = req.user?.activeRoleId ?? null;
    // userRoles is loaded by JwtStrategy via eager relations; pick primary
    const primaryUserRole =
      req.user?.userRoles?.find((ur: any) => ur.isPrimary) ??
      req.user?.userRoles?.[0];
    const roleId: number | null = activeRoleId ?? primaryUserRole?.roleId ?? null;
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

