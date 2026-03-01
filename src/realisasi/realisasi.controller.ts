import { Controller } from '@nestjs/common';
import { RealisasiService } from './realisasi.service';

@Controller('realisasi')
export class RealisasiController {
  constructor(private readonly realisasiService: RealisasiService) {}
}
