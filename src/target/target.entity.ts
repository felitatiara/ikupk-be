import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { User } from '../users/user.entity';

/**
 * Target persentase yang ditetapkan oleh Superadmin untuk setiap IKU/PK level 0 per tahun.
 * Nilai absolut dihitung saat query: persentase × baseline_data.jumlah / 100
 */
@Entity('target_universitas')
@Unique(['indikatorId', 'tahun'])
export class TargetUniversitas {
  @PrimaryGeneratedColumn()
  id!: number;

  // Hanya boleh indikator level 0
  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId!: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator!: Indikator;

  @Column({ type: 'varchar', length: 4 })
  tahun!: string;

  // IKU: nilai dalam persen (0–100). PK: nilai absolut (e.g. 5 dokumen).
  @Column({ type: 'numeric' })
  persentase!: number;

  // Satuan target — diisi untuk PK (free text, e.g. "Dokumen", "Kegiatan").
  @Column({ type: 'varchar', length: 100, nullable: true })
  satuan!: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  tenggat!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;
}
