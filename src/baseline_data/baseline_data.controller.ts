import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe } from '@nestjs/common';
import { BaselineDataService } from './baseline_data.service';
import { BaselineData } from './baseline_data.entity';
import { EventsService } from '../events/events.service';

@Controller('baseline-data')
export class BaselineDataController {
  constructor(
    private readonly baselineDataService: BaselineDataService,
    private readonly eventsService: EventsService,
  ) {}

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

  // ── Mutations ─────────────────────────────────────────────────────────────

  @Post('upsert')
  async upsert(
    @Body() body: { jenisData: string; tahun: string; jumlah: number; keterangan?: string },
  ) {
    const result = await this.baselineDataService.upsert(body);
    this.eventsService.emit('baseline', 'updated');
    return result;
  }

  @Post()
  async create(@Body() data: Partial<BaselineData>): Promise<BaselineData> {
    const result = await this.baselineDataService.create(data);
    this.eventsService.emit('baseline', 'created', result.id);
    return result;
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: Partial<BaselineData>,
  ): Promise<BaselineData | null> {
    const result = await this.baselineDataService.update(id, data);
    this.eventsService.emit('baseline', 'updated', id);
    return result;
  }

  @Delete(':id')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.baselineDataService.delete(id);
    this.eventsService.emit('baseline', 'deleted', id);
  }
}
