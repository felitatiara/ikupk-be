import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/user.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { IndikatorModule } from './indikator/indikator.module';
import { Indikator } from './indikator/indikator.entity';
import { Target } from './target/target.entity';
import { TargetsModule } from './targets/targets.module';
import { Unit } from './unit/unit.entity';
import { UnitModule } from './unit/unit.module';
import { Realisasi } from './realisasi/realisasi.entity';
import { RealisasiModule } from './realisasi/realisasi.module';
import { BaselineData } from './baseline_data/baseline_data.entity';
import { BaselineDataModule } from './baseline_data/baseline_data.module';
import { Kriteria } from './kriteria/kriteria.entity';
import { KriteriaModule } from './kriteria/kriteria.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DATABASE_HOST') || 'localhost',
        port: parseInt(configService.get('DATABASE_PORT') || '5432', 10),
        username: configService.get('DATABASE_USERNAME') || 'postgres',
        password: configService.get('DATABASE_PASSWORD') || '',
        database: configService.get('DATABASE_NAME') || 'iku_pk',
        entities: [User, Indikator, Target, Unit, Realisasi, BaselineData, Kriteria],
        synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true',
        logging: configService.get('DATABASE_LOGGING') === 'true',
      }),
    }),
    UsersModule,
    AuthModule,
    IndikatorModule,
    TargetsModule,
    UnitModule,
    RealisasiModule,
    BaselineDataModule,
    KriteriaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
