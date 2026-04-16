import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disposisi } from './disposisi.entity';
import { DisposisiService } from './disposisi.service';
import { DisposisiController } from './disposisi.controller';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [TypeOrmModule.forFeature([Disposisi]), UsersModule],
  providers: [DisposisiService],
  controllers: [DisposisiController],
  exports: [DisposisiService],
})
export class DisposisiModule {}
