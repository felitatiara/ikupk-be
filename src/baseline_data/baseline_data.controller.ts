import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common';
import { BaselineDataService } from './baseline_data.service';
import { BaselineData } from './baseline_data.entity';

@Controller('baseline-data')
export class BaselineDataController {
  constructor(private readonly baselineDataService: BaselineDataService) {}

  @Get()
  async findAll(
    @Query('indikatorId') indikatorId?: string,
    @Query('unitId') unitId?: string,
  ): Promise<BaselineData[]> {
    if (indikatorId && unitId) {
      return this.baselineDataService.findByIndikatorAndUnit(Number(indikatorId), Number(unitId));
    }
    return this.baselineDataService.findAll();
  }

  @Get('unit/:unitId')
  async findByUnit(@Param('unitId') unitId: number): Promise<BaselineData[]> {
    return this.baselineDataService.findByUnit(unitId);
  }

  @Post()
  async create(@Body() data: Partial<BaselineData>): Promise<BaselineData> {
    return this.baselineDataService.create(data);
  }

  @Put(':id')
  async update(@Param('id') id: number, @Body() data: Partial<BaselineData>): Promise<BaselineData | null> {
    return this.baselineDataService.update(id, data);
  }

  @Delete(':id')
  async delete(@Param('id') id: number): Promise<void> {
    return this.baselineDataService.delete(id);
  }
}
