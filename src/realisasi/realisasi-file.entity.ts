import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Realisasi } from './realisasi.entity';

@Entity('realisasi_file')
export class RealisasiFile {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'realisasi_id', type: 'int', nullable: true })
  realisasiId!: number | null;

  @ManyToOne(() => Realisasi, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'realisasi_id' })
  realisasi!: Realisasi | null;

  @Column({ name: 'indikator_id', type: 'int', nullable: true })
  indikatorId!: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @Column({ name: 'tahun', type: 'varchar', length: 4, nullable: true })
  tahun!: string | null;

  @Column({ name: 'periode', type: 'varchar', length: 100, nullable: true })
  periode!: string | null;

  @Column({ name: 'repository_file_id', type: 'varchar', length: 100, nullable: true })
  repositoryFileId!: string | null;

  @Column({ name: 'file_name', type: 'varchar', length: 255 })
  fileName!: string;

  @Column({ name: 'file_url', type: 'text' })
  fileUrl!: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;
}
