import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TargetsService } from './targets.service';

@Controller('targets')
export class TargetsController {
  constructor(private readonly targetsService: TargetsService) {}

  @Get()
  getAll() {
    return this.targetsService.getAll();
  }

  @Get('unit/:unitId')
  getByUnit(@Param('unitId', ParseIntPipe) unitId: number) {
    return this.targetsService.getTargetDetailByUnit(unitId);
  }

  @Get('admin/pku')
  getAdminPKU() {
    return this.targetsService.getTargetsForAdminPKU();
  }
}
