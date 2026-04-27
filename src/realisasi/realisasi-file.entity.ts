import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Realisasi } from './realisasi.entity';

/**
 * Bukti file dari sistem repository yang mendukung satu realisasi.
 * Satu realisasi bisa memiliki banyak file bukti.
 */
@Entity('realisasi_file')
export class RealisasiFile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'realisasi_id', type: 'int' })
  realisasiId: number;

  @ManyToOne(() => Realisasi, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'realisasi_id' })
  realisasi: Realisasi;

  // ID file dari sistem repository (untuk referensi silang)
  @Column({ name: 'repository_file_id', type: 'varchar', length: 100, nullable: true })
  repositoryFileId: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
