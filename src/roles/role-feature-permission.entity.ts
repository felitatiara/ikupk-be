import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('role_feature_permissions')
export class RoleFeaturePermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'role_id' })
  roleId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'role_id' })
  role: Role;

  @Column({ name: 'feature_key' })
  featureKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
