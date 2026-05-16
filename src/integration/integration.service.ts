import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';

@Injectable()
export class IntegrationService {
  private readonly repoUrl: string;

  /** Map jenis singkatan ke label folder di repository */
  private readonly jenisLabelMap: Record<string, string> = {
    IKU: 'Indikator Kinerja Utama',
    PK: 'Perjanjian Kinerja',
  };

  constructor(
    private configService: ConfigService,
    @InjectRepository(Indikator)
    private readonly indikatorRepo: Repository<Indikator>,
  ) {
    this.repoUrl =
      this.configService.get<string>('REPOSITORY_NEST_URL') ||
      'http://localhost:3005';
  }

  private async get<T>(path: string, headers?: Record<string, string>): Promise<T> {
    const res = await fetch(`${this.repoUrl}${path}`, { headers });
    if (!res.ok) {
      throw new InternalServerErrorException(
        `Repository responded ${res.status} for ${path}`,
      );
    }
    return res.json() as Promise<T>;
  }

  private appendFileUrls(file: any): any {
    return {
      ...file,
      // Preview via public integration endpoint (no auth required — UUID is unguessable)
      preview_url: `${this.repoUrl}/api/integration/preview/${file.id}`,
      download_url: `${this.repoUrl}/api/integration/download/${file.id}`,
    };
  }

  /**
   * Ambil file MILIK SENDIRI dari repository.
   * Alur hierarkis:
   *   → Folder parent: nama = label jenis (misal "Indikator Kinerja Utama")
   *   → Sub-folder: nama = "kode nama" (misal "1.1.1 Lulusan Tepat Waktu")
   *   → Filter: hanya file milik email ini
   */
  async getFilesForIndikator(indikatorId: number, email: string): Promise<{
    indikatorKode: string;
    indikatorNama: string;
    files: any[];
  }> {
    const indikator = await this.indikatorRepo.findOneBy({ id: indikatorId });
    if (!indikator) {
      throw new NotFoundException(`Indikator ID ${indikatorId} tidak ditemukan`);
    }

    const jenisLabel = this.jenisLabelMap[indikator.jenis?.toUpperCase()] || indikator.jenis || '';

    const allFiles = await this.get<any[]>(
      `/api/integration/files/search?jenis=${encodeURIComponent(jenisLabel)}&kode=${encodeURIComponent(indikator.kode)}&nama=${encodeURIComponent(indikator.nama)}&email=${encodeURIComponent(email)}`,
    );

    return {
      indikatorKode: indikator.kode,
      indikatorNama: indikator.nama,
      files: allFiles.map((f) => this.appendFileUrls(f)),
    };
  }

  /**
   * Ambil SEMUA file dalam folder indikator tanpa filter pemilik (untuk pimpinan/admin).
   * Menggunakan endpoint khusus di repository yang dilindungi shared secret —
   * permission repository tetap berlaku untuk semua akses user biasa.
   */
  async getAllFilesForIndikator(indikatorId: number, _email: string): Promise<{
    indikatorKode: string;
    indikatorNama: string;
    folderLink: string | null;
    files: any[];
  }> {
    const indikator = await this.indikatorRepo.findOneBy({ id: indikatorId });
    if (!indikator) {
      throw new NotFoundException(`Indikator ID ${indikatorId} tidak ditemukan`);
    }

    const jenisLabel = this.jenisLabelMap[indikator.jenis?.toUpperCase()] || indikator.jenis || '';
    const secret = this.configService.get<string>('INTEGRATION_SECRET') ?? '';

    const files = await this.get<any[]>(
      `/api/integration/files/unrestricted?jenis=${encodeURIComponent(jenisLabel)}&kode=${encodeURIComponent(indikator.kode)}&nama=${encodeURIComponent(indikator.nama)}`,
      { 'x-integration-secret': secret },
    );

    // Ambil folder_id dari file pertama untuk link ke repository frontend
    const repoFeUrl = this.configService.get<string>('REPOSITORY_FE_URL') || 'http://localhost:3000';
    const firstFolderId = files.length > 0 ? files[0].folder_id : null;
    const folderLink = firstFolderId ? `${repoFeUrl}/dashboard?folderId=${firstFolderId}` : null;

    return {
      indikatorKode: indikator.kode,
      indikatorNama: indikator.nama,
      folderLink,
      files: files.map((f) => ({
        ...this.appendFileUrls(f),
        ownerEmail: f.owner?.email,
        ownerName: f.owner?.name,
      })),
    };
  }

  /**
   * Ambil semua folder yang di-share ke user (bukan miliknya sendiri).
   * Dipakai untuk browsing umum.
   */
  async getSharedFolders(email: string): Promise<any[]> {
    const folders = await this.get<any[]>(
      `/api/integration/folders?email=${encodeURIComponent(email)}`,
    );
    // Tampilkan folder yang bukan milik sendiri; folder tanpa owner dianggap shared
    return folders.filter((f) => !f.owner || f.owner.email !== email);
  }

  /**
   * Ambil file dalam folder tertentu.
   */
  async getFilesInFolder(folderId: string, email: string): Promise<any[]> {
    const files = await this.get<any[]>(
      `/api/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`,
    );
    return files.map((f) => this.appendFileUrls(f));
  }

  /**
   * Cari file berdasarkan nama di semua folder yang bisa diakses user.
   */
  async searchFiles(name: string, email: string): Promise<any[]> {
    const files = await this.get<any[]>(
      `/api/integration/files/search?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email)}`,
    );
    return files.map((f) => this.appendFileUrls(f));
  }
}
