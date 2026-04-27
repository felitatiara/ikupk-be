import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { IntegrationService } from './integration.service';
import { IntegrationController } from './integration.controller';
import { User } from '../users/user.entity';
import { Indikator } from '../indikator/indikator.entity';
import { JwtStrategy } from '../strategy/jwt.strategy';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User, Indikator])],
  providers: [IntegrationService, JwtStrategy],
  controllers: [IntegrationController],
})
export class IntegrationModule {}
