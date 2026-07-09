import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { SkpPenilaiService } from './skp-penilai.service';

@Controller('skp-penilai')
export class SkpPenilaiController {
  constructor(private readonly service: SkpPenilaiService) {}

  @Get()
  findAll() { return this.service.findAll(); }

  @Get('roles')
  findAllRoles() { return this.service.findAllRoles(); }

  @Get('users')
  findAllUsers() { return this.service.findAllUsers(); }

  @Post()
  upsert(@Body() body: {
    roleId: number;
    checkerUserId?: number | null;
    pihakKeduaUserId?: number | null;
    penilaiUserId?: number | null;
  }) {
    return this.service.upsert(body.roleId, {
      checkerUserId: body.checkerUserId,
      pihakKeduaUserId: body.pihakKeduaUserId,
      penilaiUserId: body.penilaiUserId,
    });
  }

  @Get('checker/:userId')
  getCheckerBawahan(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('tahun') tahun: string,
  ) {
    return this.service.getCheckerBawahan(userId, tahun ?? String(new Date().getFullYear()));
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
