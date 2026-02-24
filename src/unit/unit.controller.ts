import { Controller, Get, Post, Body, Param, Put, Delete, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { UnitService } from './unit.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';

@Controller('units')
export class UnitController {
  constructor(private unitService: UnitService) {}

  @Post()
  create(@Body() createUnitDto: CreateUnitDto) {
    return this.unitService.create(createUnitDto);
  }

  @Get()
  findAll() {
    return this.unitService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    const unit = await this.unitService.findOne(id);
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    const unit = await this.unitService.update(id, updateUnitDto);
    if (!unit) throw new NotFoundException('Unit not found');
    return unit;
  }

  @Delete(':id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.unitService.remove(id);
    return { message: 'Unit deleted successfully' };
  }
}
