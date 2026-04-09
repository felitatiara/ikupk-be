import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { Unit } from '../unit/unit.entity';
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

  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @ManyToOne(() => Unit, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit;

  @Column({ type: 'varchar', length: 4 })
  tahun: string;

  @Column({ name: 'assigned_to', type: 'int' })
  assignedTo: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'assigned_to' })
  assignedUser: User;

  @Column({ name: 'disposed_by', type: 'int', nullable: true })
  disposedBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'disposed_by' })
  disposedByUser: User | null;

  @Column({ type: 'numeric' })
  jumlah: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;
}
