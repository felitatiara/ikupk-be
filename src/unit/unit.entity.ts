import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../users/user.entity';
import { Target } from '../target/target.entity';

@Entity('unit')
export class Unit {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  nama: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  jenis: string | null;

  @Column({ name: 'parent_id', type: 'int', nullable: true })
  parentId: number | null;

  @ManyToOne(() => Unit, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent: Unit | null;

  @OneToMany(() => Unit, (unit) => unit.parent)
  children: Unit[];

  @OneToMany(() => User, (user) => user.unit)
  users: User[];

  @OneToMany(() => Target, (target) => target.unit)
  targets: Target[];
}
