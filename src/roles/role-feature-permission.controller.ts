import { Controller, Get, Put, Body, Param, ParseIntPipe } from '@nestjs/common';
import { RoleFeaturePermissionService } from './role-feature-permission.service';

@Controller('role-feature-permissions')
export class RoleFeaturePermissionController {
  constructor(private readonly service: RoleFeaturePermissionService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Get(':roleId/feature-keys')
  getFeatureKeys(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.service.getFeatureKeysForRole(roleId);
  }

  @Get(':roleId')
  findForRole(@Param('roleId', ParseIntPipe) roleId: number) {
    return this.service.findForRole(roleId);
  }

  @Put(':roleId')
  setFeatures(
    @Param('roleId', ParseIntPipe) roleId: number,
    @Body('featureKeys') featureKeys: string[],
  ) {
    return this.service.setFeaturesForRole(roleId, featureKeys ?? []);
  }
}
