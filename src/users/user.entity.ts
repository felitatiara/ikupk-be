import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from '../unit/unit.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nip', type: 'varchar', length: 50, nullable: true })
  nip: string | null;

  @Column({ name: 'nama', length: 100 })
  nama: string;

  @Column({ length: 100, unique: true })
  email: string;

  @Column({ type: 'text' })
  password: string;

  @Column({ type: 'varchar', length: 50 })
  role: string;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId: number | null;

  @ManyToOne(() => Unit, (unit) => unit.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;
}
