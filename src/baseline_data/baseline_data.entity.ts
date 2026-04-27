import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('baseline_data')
@Unique(['jenisData', 'tahun'])
export class BaselineData {
  @PrimaryGeneratedColumn()
  id!: number;

  // Cocok dengan indikator.jenisData untuk menentukan baseline yang dipakai
  @Column({ name: 'jenis_data', type: 'varchar', length: 50 })
  jenisData!: string;

  // Jumlah aktual (denominatorpersentase), misal: 500 lulusan, 150 dosen
  @Column({ name: 'jumlah', type: 'int' })
  jumlah!: number;

  @Column({ name: 'tahun', type: 'varchar', length: 4 })
  tahun!: string;

  // Keterangan opsional, misal: "Total lulusan wisuda 2024"
  @Column({ name: 'keterangan', type: 'text', nullable: true })
  keterangan!: string | null;
}
