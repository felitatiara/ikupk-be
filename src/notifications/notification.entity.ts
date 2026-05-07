import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  // 'tenggat_7hari' | 'tenggat_1hari'
  @Column({ type: 'varchar', length: 30, nullable: true })
  type: string | null;

  // L0 indikator ID yang menjadi sumber notifikasi
  @Column({ name: 'indikator_id', type: 'int', nullable: true })
  indikatorId: number | null;

  @Column({ type: 'varchar', length: 4, nullable: true })
  tahun: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
