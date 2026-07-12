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

/** Status penandatanganan Hasil SKP per pegawai per tahun */
@Entity('skp_hasil_status')
@Unique('uq_skp_hasil_user_tahun', ['userId', 'tahun'])
export class SkpHasilStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  /** pending → signed_pegawai → checked → signed_penilai */
  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: string;

  @Column({ name: 'signature_pegawai', type: 'text', nullable: true })
  signaturePegawai: string | null;

  @Column({ name: 'signature_checker', type: 'text', nullable: true })
  signatureChecker: string | null;

  @Column({ name: 'signature_penilai', type: 'text', nullable: true })
  signaturePenilai: string | null;

  @Column({ name: 'signed_at_pegawai', type: 'timestamp', nullable: true })
  signedAtPegawai: Date | null;

  @Column({ name: 'checked_at', type: 'timestamp', nullable: true })
  checkedAt: Date | null;

  @Column({ name: 'signed_at_penilai', type: 'timestamp', nullable: true })
  signedAtPenilai: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
