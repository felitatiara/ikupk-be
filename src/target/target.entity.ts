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

  @Column({ name: 'target_angka', type: 'numeric' })
  targetAngka: number;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
