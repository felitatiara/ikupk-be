import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

/** Log setiap pengembalian dokumen SKP untuk revisi */
@Entity('skp_revision_log')
export class SkpRevisionLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** Pegawai yang dokumennya dikembalikan */
  @Column({ name: 'user_id' })
  userId: number;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  /** 'rencana' | 'hasil' */
  @Column({ type: 'varchar', length: 10 })
  docType: string;

  /** Status sebelum dikembalikan (untuk restore saat resubmit) */
  @Column({ name: 'from_status', type: 'varchar', length: 30 })
  fromStatus: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  reason: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  /** Siapa yang mengembalikan (checker / pihak kedua / penilai) */
  @Column({ name: 'revised_by_user_id' })
  revisedByUserId: number;

  @CreateDateColumn({ name: 'revised_at' })
  revisedAt: Date;

  /** Diisi saat pegawai mengajukan kembali setelah revisi */
  @Column({ name: 'resubmitted_at', type: 'timestamp', nullable: true })
  resubmittedAt: Date | null;
}
