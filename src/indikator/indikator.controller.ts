import { Controller, Get } from '@nestjs/common';
import { IndikatorService } from './indikator.service';

@Controller('indikator')
export class IndikatorController {
  constructor(private readonly indikatorService: IndikatorService) {}

  @Get()
  findAll() {
    return this.indikatorService.findAll();
  }

  @Get('subindikator')
  findSubindikator() {
    return this.indikatorService.findSubindikator();
  }
}
