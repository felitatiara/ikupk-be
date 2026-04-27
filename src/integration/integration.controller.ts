import { Controller, Get, Query, Req, UseGuards, ParseIntPipe } from '@nestjs/common';
import { IntegrationService } from './integration.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('integration')
@UseGuards(JwtAuthGuard)
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * GET /integration/realisasi-files?indikatorId=15
   *
   * Endpoint utama untuk submit realisasi.
   * Ambil file dari repository di folder yang namanya = kode indikator.
   * Email diambil otomatis dari JWT token.
   *
   * Contoh: indikator kode "1.1.1" → repository cari folder bernama "1.1.1"
   * → return semua file di folder itu yang bisa diakses user ini.
   */
  @Get('realisasi-files')
  getFilesForIndikator(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
  ) {
    const email: string = req.user.email;
    return this.integrationService.getFilesForIndikator(indikatorId, email);
  }

  /**
   * GET /integration/all-realisasi-files?indikatorId=15
   *
   * Untuk pimpinan/admin: ambil SEMUA file di folder indikator dari semua dosen.
   * Tiap file menyertakan ownerEmail dan ownerName agar bisa dikelompokkan per dosen.
   */
  @Get('all-realisasi-files')
  getAllFilesForIndikator(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
  ) {
    const email: string = req.user.email;
    return this.integrationService.getAllFilesForIndikator(indikatorId, email);
  }

  /**
   * GET /integration/shared-folders
   * Browsing umum: semua folder yang di-share ke user ini.
   */
  @Get('shared-folders')
  getSharedFolders(@Req() req: any) {
    const email: string = req.user.email;
    return this.integrationService.getSharedFolders(email);
  }

  /**
   * GET /integration/files?folderId=xxx
   * Ambil file dalam folder tertentu beserta preview_url dan download_url.
   */
  @Get('files')
  getFiles(@Req() req: any, @Query('folderId') folderId: string) {
    const email: string = req.user.email;
    return this.integrationService.getFilesInFolder(folderId, email);
  }

  /**
   * GET /integration/files/search?name=xxx
   * Cari file berdasarkan kata kunci nama folder.
   */
  @Get('files/search')
  searchFiles(@Req() req: any, @Query('name') name: string) {
    const email: string = req.user.email;
    return this.integrationService.searchFiles(name, email);
  }
}
