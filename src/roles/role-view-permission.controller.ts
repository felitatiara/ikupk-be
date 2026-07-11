import { Controller, Get, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { RoleViewPermissionService } from './role-view-permission.service';

@Controller('role-view-permissions')
export class RoleViewPermissionController {
  constructor(private readonly roleViewPermissionService: RoleViewPermissionService) {}

  @Get()
  findAll() {
    return this.roleViewPermissionService.findAll();
  }

  @Get(':viewerRoleId/viewable-ids')
  getViewableIds(@Param('viewerRoleId', ParseIntPipe) viewerRoleId: number) {
    return this.roleViewPermissionService.getViewableRoleIds(viewerRoleId);
  }

  @Get(':viewerRoleId')
  findForViewer(@Param('viewerRoleId', ParseIntPipe) viewerRoleId: number) {
    return this.roleViewPermissionService.findForViewer(viewerRoleId);
  }

  @Put(':viewerRoleId')
  setPermissions(
    @Param('viewerRoleId', ParseIntPipe) viewerRoleId: number,
    @Body('viewableRoleIds') viewableRoleIds: number[],
  ) {
    return this.roleViewPermissionService.setPermissionsForViewer(viewerRoleId, viewableRoleIds);
  }
}
