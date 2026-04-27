import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { BaselineDataService } from './baseline_data.service';
import { BaselineData } from './baseline_data.entity';

@Controller('baseline-data')
export class BaselineDataController {
  constructor(private readonly baselineDataService: BaselineDataService) {}

  @Get()
  findAll(
    @Query('jenisData') jenisData?: string,
    @Query('tahun') tahun?: string,
  ): Promise<BaselineData[] | BaselineData | null> {
    if (jenisData && tahun) {
      return this.baselineDataService.findByJenisDataAndTahun(jenisData, tahun);
    }
    return this.baselineDataService.findAll(tahun);
  }

  @Post('upsert')
  upsert(
    @Body() body: { jenisData: string; tahun: string; jumlah: number; keterangan?: string },
  ) {
    return this.baselineDataService.upsert(body);
  }

  @Post()
  create(@Body() data: Partial<BaselineData>): Promise<BaselineData> {
    return this.baselineDataService.create(data);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<BaselineData>,
  ): Promise<BaselineData | null> {
    return this.baselineDataService.update(id, data);
  }

  @Delete(':id')
  delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.baselineDataService.delete(id);
  }
}
