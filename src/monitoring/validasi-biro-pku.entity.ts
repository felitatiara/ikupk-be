import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Indikator } from '../indikator/indikator.entity';
import { User } from '../users/user.entity';

@Entity('validasi_biro_pku')
export class ValidasiBiroPKU {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'indikator_id' })
  indikatorId: number;

  @ManyToOne(() => Indikator, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'indikator_id' })
  indikator: Indikator;

  @Column({ length: 4 })
  tahun: string;

  @Column({ name: 'jumlah_valid', type: 'int', nullable: true })
  jumlahValid: number | null;

  @Column({ type: 'text', nullable: true })
  keterangan: string | null;

  @Column({ name: 'input_by', nullable: true })
  inputBy: number | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'input_by' })
  inputUser: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
