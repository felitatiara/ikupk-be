import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Target } from '../target/target.entity';

@Entity('realisasi')
export class Realisasi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'target_id', type: 'int' })
  targetId: number;

  @ManyToOne(() => Target, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target: Target;

  @Column({ name: 'realisasi_angka', type: 'numeric' })
  realisasiAngka: number;

	@Column({ name: 'file_url', type: 'text', nullable: true })
	fileUrl: string;

	@Column({ name: 'created_by', type: 'int', nullable: true })
	createdBy: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'pending' })
  status: string;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
