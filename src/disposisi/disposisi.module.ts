import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Disposisi } from './disposisi.entity';
import { DisposisiService } from './disposisi.service';
import { DisposisiController } from './disposisi.controller';
import { UserRelation } from '../users/user_relation.entity';
import { User } from '../users/user.entity';
import { UserRole } from '../roles/user-role.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Disposisi, UserRelation, User, UserRole])],
  providers: [DisposisiService],
  controllers: [DisposisiController],
  exports: [DisposisiService],
})
export class DisposisiModule {}
