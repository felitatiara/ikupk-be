import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('baseline_data')
export class BaselineData {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @Column({ name: 'unit_id', type: 'int' })
  unitId: number;

  @Column({ name: 'tahun', type: 'varchar', length: 4 })
  tahun: string;

  @Column({ name: 'jenis_data', type: 'varchar', length: 50, nullable: true })
  jenisData: string | null;

  @Column({ name: 'jumlah', type: 'int' })
  jumlah: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}
