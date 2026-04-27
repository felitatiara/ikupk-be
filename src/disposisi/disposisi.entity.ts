import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { User } from '../users/user.entity';

@Entity('disposisi')
export class Disposisi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator: Indikator;

  // User yang MEMBERI disposisi (null = dari pimpinan tertinggi / super admin)
  @Column({ name: 'from_user_id', type: 'int', nullable: true })
  fromUserId: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User | null;

  // User yang MENERIMA disposisi
  @Column({ name: 'to_user_id', type: 'int', nullable: true })
  toUserId: number;

  @ManyToOne(() => User, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  // Jumlah target yang didisposisikan
  @Column({ name: 'jumlah_target', type: 'numeric' })
  jumlahTarget: number;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  // Pointer ke disposisi induk untuk melacak rantai:
  // Wadek→Kajur (parent_id: null) → Kajur→Kaprodi → Kaprodi→Dosen
  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Disposisi, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_id' })
  parent: Disposisi | null;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: string; // 'pending' | 'diterima' | 'ditolak'

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
