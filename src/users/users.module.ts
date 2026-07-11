import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './user.entity';
import { UserRelation } from './user_relation.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { RoleViewPermission } from '../roles/role-view-permission.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { RoleViewPermissionService } from '../roles/role-view-permission.service';
import { RoleViewPermissionController } from '../roles/role-view-permission.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserRelation, Role, UserRole, RoleViewPermission])],
  providers: [UsersService, RoleViewPermissionService],
  controllers: [UsersController, RoleViewPermissionController],
  exports: [UsersService, RoleViewPermissionService],
})
export class UsersModule {}
