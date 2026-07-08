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
import { Role } from '../roles/role.entity';
import { User } from '../users/user.entity';

/**
 * Konfigurasi penandatangan SKP per role:
 *  - pihakKeduaUserId : penandatangan Rencana SKP (Pihak Kedua)
 *  - penilaiUserId    : Pejabat Penilai Kinerja di Formulir EKP
 */
@Entity('skp_penilai_config')
@Unique('uq_skp_penilai_role', ['roleId'])
export class SkpPenilaiConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @ManyToOne(() => Role, { onDelete: 'CASCADE', eager: false })
  @JoinColumn({ name: 'role_id' })
  role: Role;

  /** Pihak Kedua untuk Rencana SKP */
  @Column({ name: 'pihak_kedua_user_id', nullable: true, default: null })
  pihakKeduaUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: false, nullable: true })
  @JoinColumn({ name: 'pihak_kedua_user_id' })
  pihakKeduaUser: User | null;

  /** Pejabat Penilai Kinerja untuk Formulir EKP */
  @Column({ name: 'penilai_user_id', nullable: true, default: null })
  penilaiUserId: number | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', eager: false, nullable: true })
  @JoinColumn({ name: 'penilai_user_id' })
  penilaiUser: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
