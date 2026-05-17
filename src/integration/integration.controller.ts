import { Controller, Get, Query, Req, Param, Res, UseGuards, ParseIntPipe } from '@nestjs/common';
import type { Response } from 'express';
import { IntegrationService } from './integration.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('integration')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  /**
   * GET /integration/realisasi-files?indikatorId=15
   * File milik sendiri untuk indikator tertentu — email dari JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Get('realisasi-files')
  getFilesForIndikator(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
  ) {
    return this.integrationService.getFilesForIndikator(indikatorId, req.user.email);
  }

  /**
   * GET /integration/all-realisasi-files?indikatorId=15
   * Semua file untuk indikator (atasan/admin) — email dari JWT.
   */
  @UseGuards(JwtAuthGuard)
  @Get('all-realisasi-files')
  getAllFilesForIndikator(
    @Req() req: any,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
  ) {
    return this.integrationService.getAllFilesForIndikator(indikatorId, req.user.email);
  }

  /**
   * GET /integration/folders?email=xxx
   * Semua folder yang bisa diakses user — email dari query param (sesuai repository-nest).
   */
  @Get('folders')
  getFolders(@Query('email') email: string) {
    return this.integrationService.getFolders(email);
  }

  /**
   * GET /integration/files/in-children?parentFolderId=xxx&email=xxx
   * File dari sub-folder langsung di bawah parentFolderId — sesuai repository-nest.
   */
  @Get('files/in-children')
  getFilesInChildren(
    @Query('parentFolderId') parentFolderId: string,
    @Query('email') email: string,
  ) {
    return this.integrationService.getFilesInChildren(parentFolderId, email);
  }

  /**
   * GET /integration/files/search?name=xxx&email=xxx
   *                          atau ?jenis=xxx&kode=xxx&nama=xxx&email=xxx
   * Cari file — sesuai repository-nest (hierarchical atau legacy).
   */
  @Get('files/search')
  searchFiles(
    @Query('name') name: string,
    @Query('jenis') jenis: string,
    @Query('kode') kode: string,
    @Query('nama') nama: string,
    @Query('email') email: string,
  ) {
    return this.integrationService.searchFiles(name, email, jenis, kode, nama);
  }

  /**
   * GET /integration/files?folderId=xxx&email=xxx
   * File dalam folder tertentu — sesuai repository-nest.
   */
  @Get('files')
  getFiles(
    @Query('folderId') folderId: string,
    @Query('email') email: string,
  ) {
    return this.integrationService.getFilesInFolder(folderId, email);
  }

  /**
   * GET /integration/preview/:fileId — proxy preview file, tanpa auth (sesuai repository-nest).
   */
  @Get('preview/:fileId')
  previewFile(@Param('fileId') fileId: string, @Res() res: Response) {
    return this.integrationService.proxyFile(fileId, 'inline', res);
  }

  /**
   * GET /integration/download/:fileId — proxy download file, tanpa auth (sesuai repository-nest).
   */
  @Get('download/:fileId')
  downloadFile(@Param('fileId') fileId: string, @Res() res: Response) {
    return this.integrationService.proxyFile(fileId, 'download', res);
  }
}
