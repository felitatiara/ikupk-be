import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';

@Entity('indikator')
@Unique(['jenis', 'kode'])
export class Indikator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10 })
  jenis: string;

  @Column({ length: 20 })
  kode: string;

  @Column({ type: 'text' })
  nama: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent: Indikator;

  @Column({ type: 'int', default: 1 })
  level: number;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt: Date;
}
