import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../users/user.entity';
import { Indikator } from '../indikator/indikator.entity';
import { Role } from '../roles/role.entity';
import { Disposisi } from '../disposisi/disposisi.entity';

@Entity('realisasi')
export class Realisasi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator: Indikator;

  // Disposisi yang dipenuhi oleh realisasi ini (null jika langsung tanpa disposisi)
  @Column({ name: 'disposisi_id', type: 'int', nullable: true })
  disposisiId: number | null;

  @ManyToOne(() => Disposisi, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'disposisi_id' })
  disposisi: Disposisi | null;

  // Role unit dosen saat mengisi realisasi (untuk agregasi ke atas)
  @Column({ name: 'role_id', type: 'int', nullable: true })
  roleId: number | null;

  @ManyToOne(() => Role, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ type: 'varchar', length: 4, nullable: true })
  tahun: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  periode: string | null;

  @Column({ name: 'realisasi_angka', type: 'numeric' })
  realisasiAngka: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  // 'pending' | 'approved' | 'rejected'
  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
