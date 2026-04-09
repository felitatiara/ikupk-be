import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disposisi } from './disposisi.entity';
import { DisposisiService } from './disposisi.service';
import { DisposisiController } from './disposisi.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Disposisi])],
  providers: [DisposisiService],
  controllers: [DisposisiController],
  exports: [DisposisiService],
})
export class DisposisiModule {}
