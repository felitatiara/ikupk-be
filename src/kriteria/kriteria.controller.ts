import { Controller, Get } from '@nestjs/common';
import { KriteriaService } from './kriteria.service';

@Controller('kriteria')
export class KriteriaController {
  constructor(private readonly kriteriaService: KriteriaService) {}

  @Get()
  findAll() {
    return this.kriteriaService.findAll();
  }
}
