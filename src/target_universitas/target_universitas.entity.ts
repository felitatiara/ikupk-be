import { Entity, PrimaryGeneratedColumn, Column, Unique } from 'typeorm';

@Entity('target_universitas')
@Unique(['indikatorId', 'tahun'])
export class TargetUniversitas {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id', type: 'int' })
  indikatorId: number;

  @Column({ name: 'tahun', type: 'varchar', length: 4 })
  tahun: string;

  @Column({ name: 'target_angka', type: 'numeric' })
  targetAngka: number;

  @Column({ name: 'target_fakultas', type: 'numeric', nullable: true, default: 0 })
  targetFakultas: number;
}
