import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from './user-role.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ name: 'unit_nama', type: 'varchar', length: 100 })
  unitNama: string;

  /**
   * Hierarki level disposisi:
   * 0 = Super Admin / Admin
   * 1 = Pimpinan Fakultas (Dekan, Wakil Dekan 1/2/3)
   * 2 = Kepala Jurusan
   * 3 = Koordinator Prodi
   * 4 = Dosen / Tendik
   */
  @Column({ type: 'int', default: 4 })
  level: number;

  @OneToMany(() => UserRole, (ur) => ur.role)
  userRoles: UserRole[];
}