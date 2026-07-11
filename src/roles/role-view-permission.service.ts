import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleViewPermission } from './role-view-permission.entity';

@Injectable()
export class RoleViewPermissionService {
  constructor(
    @InjectRepository(RoleViewPermission)
    private roleViewPermissionRepo: Repository<RoleViewPermission>,
  ) {}

  findAll(): Promise<RoleViewPermission[]> {
    return this.roleViewPermissionRepo.find({
      relations: ['viewerRole', 'viewableRole'],
    });
  }

  findForViewer(viewerRoleId: number): Promise<RoleViewPermission[]> {
    return this.roleViewPermissionRepo.find({
      where: { viewerRoleId },
      relations: ['viewerRole', 'viewableRole'],
    });
  }

  async setPermissionsForViewer(
    viewerRoleId: number,
    viewableRoleIds: number[],
  ): Promise<RoleViewPermission[]> {
    await this.roleViewPermissionRepo.delete({ viewerRoleId });

    if (viewableRoleIds.length === 0) return [];

    const entities = viewableRoleIds.map((viewableRoleId) =>
      this.roleViewPermissionRepo.create({ viewerRoleId, viewableRoleId }),
    );

    return this.roleViewPermissionRepo.save(entities);
  }

  async getViewableRoleIds(viewerRoleId: number): Promise<number[]> {
    const permissions = await this.roleViewPermissionRepo.find({
      where: { viewerRoleId },
    });
    return permissions.map((p) => p.viewableRoleId);
  }
}
