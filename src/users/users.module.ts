import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserRelation } from './user_relation.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { RoleViewPermission } from '../roles/role-view-permission.entity';
import { RoleFeaturePermission } from '../roles/role-feature-permission.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RoleViewPermissionService } from '../roles/role-view-permission.service';
import { RoleViewPermissionController } from '../roles/role-view-permission.controller';
import { RoleFeaturePermissionService } from '../roles/role-feature-permission.service';
import { RoleFeaturePermissionController } from '../roles/role-feature-permission.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRelation, Role, UserRole, RoleViewPermission, RoleFeaturePermission])],
  providers: [UsersService, RoleViewPermissionService, RoleFeaturePermissionService],
  controllers: [UsersController, RoleViewPermissionController, RoleFeaturePermissionController],
  exports: [UsersService, RoleViewPermissionService, RoleFeaturePermissionService],
})
export class UsersModule {}
