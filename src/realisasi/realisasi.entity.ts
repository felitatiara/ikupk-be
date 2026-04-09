import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Target } from '../target/target.entity';
import { Indikator } from '../indikator/indikator.entity';
import { Unit } from '../unit/unit.entity';

@Entity('realisasi')
export class Realisasi {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'target_id', type: 'int', nullable: true })
  targetId: number | null;

  @ManyToOne(() => Target, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'target_id' })
  target: Target;

  @Column({ name: 'indikator_id', type: 'int', nullable: true })
  indikatorId: number | null;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'indikator_id' })
  indikator: Indikator;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId: number | null;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 4, nullable: true })
  tahun: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  periode: string | null;

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
