import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { Unit } from '../unit/unit.entity';

@Entity('indikator')
@Unique(['jenis', 'kode'])
export class Indikator {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ length: 10 })
  jenis!: string;

  @Column({ length: 20 })
  kode!: string;

  @Column({ type: 'text' })
  nama!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Indikator;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId!: number | null;

  @ManyToOne(() => Unit, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'unit_id' })
  unit!: Unit;

  @Column({ type: 'int', default: 1 })
  level!: number;

  @Column({ name: 'jenis_data', type: 'varchar', length: 50, nullable: true })
  jenisData!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
