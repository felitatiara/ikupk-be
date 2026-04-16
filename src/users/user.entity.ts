import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { Unit } from '../unit/unit.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nip', type: 'varchar', length: 20, nullable: false })
  nip: string;

  @Column({ name: 'nama', type: 'varchar', length: 100, nullable: false })
  nama: string;

  @Column({ name: 'email', type: 'varchar', length: 100, unique: true, nullable: false })
  email: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: false })
  password: string;

  @Column({ name: 'jenis', type: 'varchar', length: 50, nullable: false })
  jenis: string;

  @Column({ name: 'role', type: 'varchar', length: 50, nullable: false })
  role: string;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId: number | null;

  @ManyToOne(() => Unit, (unit) => unit.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'unit_id' })
  unit: Unit | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
