import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kriteria')
export class Kriteria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @Column({ type: 'text' })
  nama: string;
}
