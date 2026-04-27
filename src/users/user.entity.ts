import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { UserRole } from '../roles/user-role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'nip', type: 'varchar', length: 20, nullable: false })
  nip: string;

  @Column({ name: 'nama', type: 'varchar', length: 100, nullable: false })
  nama: string;

  @Column({ name: 'email', type: 'varchar', length: 100, unique: true, nullable: false })
  email: string;

  @Column({ name: 'password', type: 'varchar', length: 255, nullable: false })
  password: string;

  // Jenis kepegawaian, e.g. "PNS", "Non-PNS", "Kontrak"
  @Column({ name: 'jenis', type: 'varchar', length: 50, nullable: true })
  jenis: string | null;

  @OneToMany(() => UserRole, (ur) => ur.user, { cascade: true, eager: false })
  userRoles: UserRole[];

  @Column({ name: 'created_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'updated_at', type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}
