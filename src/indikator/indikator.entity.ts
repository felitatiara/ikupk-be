import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('indikator')
export class Indikator {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 10 })
  jenis: string;

  @Column({ length: 20 })
  kode: string;

  @Column({ type: 'text' })
  nama: string;

  @Column({ length: 4 })
  tahun: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()', onUpdate: 'now()' })
  updatedAt: Date;


  @Column({ type: 'int', default: 1 })
  level: number;
}
