import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('baseline_data')
export class BaselineData {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'unit_id', type: 'int', nullable: true })
  unitId!: number;

  @Column({ name: 'jenis_data', type: 'varchar', length: 50, nullable: true })
  jenisData!: string | null;

  @Column({ name: 'jumlah', type: 'int', nullable: true })
  jumlah!: number | null;

  @Column({ name: 'tahun', type: 'varchar', length: 4 })
  tahun!: string;
}
