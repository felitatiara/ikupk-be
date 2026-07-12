import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('verifikasi_ekspektasi')
@Unique('uq_verifikasi_ekspektasi', ['targetUserId', 'penilaiUserId', 'tahun'])
export class VerifikasiEkspektasi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'target_user_id' })
  targetUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @Column({ name: 'penilai_user_id' })
  penilaiUserId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'penilai_user_id' })
  penilaiUser: User;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  /** 'melebihi' | 'sesuai' | 'di_bawah' */
  @Column({ type: 'varchar', length: 20 })
  ekspektasi: string;

  @Column({ type: 'text', nullable: true, default: null })
  catatan: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
