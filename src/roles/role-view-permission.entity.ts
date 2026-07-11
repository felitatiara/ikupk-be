import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { Role } from './role.entity';

@Entity('role_view_permissions')
export class RoleViewPermission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'viewer_role_id' })
  viewerRoleId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'viewer_role_id' })
  viewerRole: Role;

  @Column({ name: 'viewable_role_id' })
  viewableRoleId: number;

  @ManyToOne(() => Role)
  @JoinColumn({ name: 'viewable_role_id' })
  viewableRole: Role;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
