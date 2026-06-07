import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';

@Entity('indikator')
@Unique(['jenis', 'kode', 'tahun'])
export class Indikator {
  @PrimaryGeneratedColumn()
  id!: number;

  // 'IKU' | 'PK'
  @Column({ length: 10 })
  jenis!: string;

  @Column({ length: 20 })
  kode!: string;

  @Column({ type: 'text' })
  nama!: string;

  // Tahun berlaku indikator ini — indikator bisa beda struktur tiap tahun
  @Column({ type: 'varchar', length: 4, default: '2025' })
  tahun!: string;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId!: number | null;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'parent_id' })
  parent!: Indikator;

  // IKU: level 0/1/2  |  PK: level 0/1/2/3
  @Column({ type: 'int', default: 0 })
  level!: number;

  // Digunakan untuk mencocokkan baseline_data.jenisData
  @Column({ name: 'jenis_data', type: 'varchar', length: 50, nullable: true })
  jenisData!: string | null;

  // 'repository' | 'ikupk' — menentukan apakah realisasi diambil dari repository atau input langsung
  @Column({ name: 'sumber_data', type: 'varchar', length: 20, default: 'repository' })
  sumberData!: string;

  // Untuk PK L3: referensi ke indikator IKU yang menjadi dasar (cross-reading realisasi)
  @Column({ name: 'linked_iku_id', type: 'int', nullable: true })
  linkedIkuId!: number | null;

  // Alur disposisi: JSON array user ID yang menjadi penerima disposisi secara berurutan
  @Column({ name: 'cascade_chain', type: 'text', nullable: true })
  cascadeChain!: string | null;

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'now()' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'now()' })
  updatedAt!: Date;
}
