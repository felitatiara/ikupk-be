import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { JwtStrategy } from '../strategy/jwt.strategy';
import { UserRole } from '../roles/user-role.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    TypeOrmModule.forFeature([UserRole, User]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret') || 'your-secret-key-change-in-production',
        signOptions: { expiresIn: (config.get<string>('jwt.expiresIn') || '24h') as any },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
