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

/** Status penandatanganan Rencana SKP per pegawai per tahun */
@Entity('skp_rencana_status')
@Unique('uq_skp_rencana_user_tahun', ['userId', 'tahun'])
export class SkpRencanaStatus {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  /** draft → signed_pegawai → checked → signed_pihak_kedua */
  @Column({ type: 'varchar', length: 30, default: 'draft' })
  status: string;

  @Column({ name: 'signature_pegawai', type: 'text', nullable: true })
  signaturePegawai: string | null;

  @Column({ name: 'signature_checker', type: 'text', nullable: true })
  signatureChecker: string | null;

  @Column({ name: 'signature_pihak_kedua', type: 'text', nullable: true })
  signaturePihakKedua: string | null;

  @Column({ name: 'signed_at_pegawai', type: 'timestamp', nullable: true })
  signedAtPegawai: Date | null;

  @Column({ name: 'checked_at', type: 'timestamp', nullable: true })
  checkedAt: Date | null;

  @Column({ name: 'signed_at_pihak_kedua', type: 'timestamp', nullable: true })
  signedAtPihakKedua: Date | null;

  /** Berapa kali dokumen ini dikembalikan untuk revisi */
  @Column({ name: 'revision_count', default: 0 })
  revisionCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
