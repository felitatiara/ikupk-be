import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Unit } from '../unit/unit.entity';
import { User } from '../users/user.entity';

@Entity('target')
export class Target {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator: Indikator;

  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @ManyToOne(() => Unit, (unit) => unit.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  @Column({ name: 'target_universitas', type: 'numeric', nullable: true })
  targetUniversitas: number | null;

  @Column({ name: 'target_fakultas', type: 'numeric', nullable: true })
  targetFakultas: number | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @Column({ name: 'status', type: 'varchar', length: 30, default: 'pending_dekan' })
  status: string;

  @Column({ name: 'assigned_to', type: 'int', nullable: true })
  assignedTo: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'assigned_to' })
  assignedUser: User | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
