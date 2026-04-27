import { Controller, Get, Post, Body, Query, ParseIntPipe } from '@nestjs/common';
import { DisposisiService } from './disposisi.service';

@Controller('disposisi')
export class DisposisiController {
  constructor(private readonly disposisiService: DisposisiService) {}

  @Get()
  find(
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
    @Query('fromUserId') fromUserId?: string,
  ) {
    const from = fromUserId !== undefined
      ? (fromUserId === 'null' ? null : Number(fromUserId))
      : undefined;
    return this.disposisiService.findByIndikator(indikatorId, tahun, from);
  }

  @Get('received-jumlah')
  async getReceivedJumlah(
    @Query('toUserId', ParseIntPipe) toUserId: number,
    @Query('indikatorId', ParseIntPipe) indikatorId: number,
    @Query('tahun') tahun: string,
  ) {
    const jumlah = await this.disposisiService.getReceivedJumlah(toUserId, indikatorId, tahun);
    return { jumlah };
  }

  @Post()
  upsert(
    @Body('indikatorId') indikatorId: number,
    @Body('tahun') tahun: string,
    @Body('items') items: { toUserId: number; jumlahTarget: number }[],
    @Body('fromUserId') fromUserId?: number | null,
    @Body('parentId') parentId?: number | null,
  ) {
    return this.disposisiService.upsertMultiple(indikatorId, tahun, items, fromUserId, parentId);
  }

  @Get('chain')
  getChain(@Query('parentId', ParseIntPipe) parentId: number) {
    return this.disposisiService.findChain(parentId);
  }
}
