import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import type { Response } from 'express';
import { Indikator } from '../indikator/indikator.entity';

@Injectable()
export class IntegrationService {
  private readonly repoUrl: string;
  private readonly selfUrl: string;

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
    this.selfUrl =
      this.configService.get<string>('SELF_URL') ||
      'http://localhost:4000';
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
      preview_url: `${this.selfUrl}/integration/preview/${file.id}`,
      download_url: `${this.selfUrl}/integration/download/${file.id}`,
    };
  }

  /**
   * Ambil file MILIK SENDIRI dari repository untuk indikator tertentu.
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
   * Ambil semua folder yang dapat diakses oleh email tersebut.
   */
  async getFolders(email: string): Promise<any[]> {
    if (!email) return [];
    return this.get<any[]>(`/api/integration/folders?email=${encodeURIComponent(email)}`);
  }

  /**
   * Ambil file dari sub-folder langsung (level-2) di bawah parentFolderId.
   */
  async getFilesInChildren(parentFolderId: string, email: string): Promise<any[]> {
    if (!parentFolderId || !email) return [];
    const files = await this.get<any[]>(
      `/api/integration/files/in-children?parentFolderId=${encodeURIComponent(parentFolderId)}&email=${encodeURIComponent(email)}`,
    );
    return files.map((f) => this.appendFileUrls(f));
  }

  /**
   * Ambil file dalam folder tertentu.
   */
  async getFilesInFolder(folderId: string, email: string): Promise<any[]> {
    if (!folderId || !email) return [];
    const files = await this.get<any[]>(
      `/api/integration/files?folderId=${encodeURIComponent(folderId)}&email=${encodeURIComponent(email)}`,
    );
    return files.map((f) => this.appendFileUrls(f));
  }

  /**
   * Cari file — mode hierarchical (jenis+kode) atau legacy (name), sesuai repository-nest.
   */
  async searchFiles(name: string, email: string, jenis?: string, kode?: string, nama?: string): Promise<any[]> {
    let path: string;
    if (jenis && kode) {
      path = `/api/integration/files/search?jenis=${encodeURIComponent(jenis)}&kode=${encodeURIComponent(kode)}&nama=${encodeURIComponent(nama || kode)}&email=${encodeURIComponent(email || '')}`;
    } else if (name) {
      path = `/api/integration/files/search?name=${encodeURIComponent(name)}&email=${encodeURIComponent(email || '')}`;
    } else {
      return [];
    }
    const files = await this.get<any[]>(path);
    return files.map((f) => this.appendFileUrls(f));
  }

  /**
   * Proxy file dari repository-nest ke client (preview inline atau force-download).
   */
  async proxyFile(fileId: string, mode: 'inline' | 'download', res: Response): Promise<void> {
    const endpoint = mode === 'inline' ? 'preview' : 'download';
    try {
      const upstream = await fetch(
        `${this.repoUrl}/api/integration/${endpoint}/${encodeURIComponent(fileId)}`,
      );
      if (!upstream.ok || !upstream.body) {
        res.status(404).json({ error: 'File not found' });
        return;
      }
      for (const header of ['content-type', 'content-length', 'content-disposition']) {
        const value = upstream.headers.get(header);
        if (value) res.setHeader(header, value);
      }
      Readable.fromWeb(upstream.body as any).pipe(res);
    } catch {
      res.status(502).json({ error: 'Repository unavailable' });
    }
  }
}
