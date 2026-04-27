import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

/**
 * Target yang ditetapkan per unit/role untuk indikator level 1/2/3.
 * Merepresentasikan komitmen tiap unit terhadap indikator kinerja.
 */
@Entity('target_unit')
@Unique(['indikatorId', 'roleId', 'tahun'])
export class TargetUnit {
  @PrimaryGeneratedColumn()
  id!: number;

  // Indikator level 1/2/3 yang menjadi tanggung jawab unit ini
  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId!: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator!: Indikator;

  @Column({ name: 'role_id', type: 'int' })
  roleId!: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role!: Role;

  @Column({ type: 'varchar', length: 4 })
  tahun!: string;

  @Column({ name: 'nilai_target', type: 'numeric', nullable: true })
  nilaiTarget!: number | null;

  // 'draft' | 'diajukan' | 'disetujui' | 'ditolak'
  @Column({ name: 'status_validasi', type: 'varchar', length: 30, default: 'draft' })
  statusValidasi!: string;

  @Column({ type: 'text', nullable: true })
  catatan!: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy!: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator!: User | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;
}
