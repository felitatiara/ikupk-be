import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';

@Injectable()
export class IntegrationService {
  private readonly repoUrl: string;

  constructor(
    private configService: ConfigService,
    @InjectRepository(Indikator)
    private readonly indikatorRepo: Repository<Indikator>,
  ) {
    this.repoUrl =
      this.configService.get<string>('REPOSITORY_NEST_URL') ||
      'http://localhost:3005';
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.repoUrl}${path}`);
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
      preview_url: `${this.repoUrl}/api/files/${file.id}/preview`,
      download_url: `${this.repoUrl}/api/files/${file.id}/download`,
    };
  }

  /**
   * Ambil file MILIK SENDIRI dari repository di folder bernama sesuai kode indikator.
   * Contoh: indikator kode "1.1.1" → cari folder "1.1.1" → filter hanya file milik email ini.
   * Dipakai saat dosen submit realisasi (hanya tampilkan file yang dia upload sendiri).
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

    const allFiles = await this.get<any[]>(
      `/api/integration/files/search?name=${encodeURIComponent(indikator.kode)}&email=${encodeURIComponent(email)}`,
    );

    // Filter hanya file yang di-upload oleh user ini (bukan file dosen lain di folder yang sama)
    const ownFiles = allFiles.filter((f) => f.owner?.email === email);

    return {
      indikatorKode: indikator.kode,
      indikatorNama: indikator.nama,
      files: ownFiles.map((f) => this.appendFileUrls(f)),
    };
  }

  /**
   * Ambil SEMUA file dalam folder indikator tanpa filter pemilik.
   * Dipakai oleh pimpinan/admin untuk melihat realisasi seluruh dosen pada satu indikator.
   */
  async getAllFilesForIndikator(indikatorId: number, email: string): Promise<{
    indikatorKode: string;
    indikatorNama: string;
    files: any[];
  }> {
    const indikator = await this.indikatorRepo.findOneBy({ id: indikatorId });
    if (!indikator) {
      throw new NotFoundException(`Indikator ID ${indikatorId} tidak ditemukan`);
    }

    const files = await this.get<any[]>(
      `/api/integration/files/search?name=${encodeURIComponent(indikator.kode)}&email=${encodeURIComponent(email)}`,
    );

    return {
      indikatorKode: indikator.kode,
      indikatorNama: indikator.nama,
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
    return folders.filter((f) => f.owner?.email !== email);
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
