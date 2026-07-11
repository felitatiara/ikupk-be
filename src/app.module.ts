import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RequestContextMiddleware } from './common/request-context.middleware';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { User } from './users/user.entity';
import { UserRelation } from './users/user_relation.entity';
import { Role } from './roles/role.entity';
import { UserRole } from './roles/user-role.entity';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { IndikatorModule } from './indikator/indikator.module';
import { Indikator } from './indikator/indikator.entity';
import { TargetUniversitas } from './target/target.entity';
import { TargetUnit } from './target/target-unit.entity';
import { TargetsModule } from './targets/targets.module';
import { Realisasi } from './realisasi/realisasi.entity';
import { RealisasiFile } from './realisasi/realisasi-file.entity';
import { RealisasiModule } from './realisasi/realisasi.module';
import { BaselineData } from './baseline_data/baseline_data.entity';
import { BaselineDataModule } from './baseline_data/baseline_data.module';
import { Kriteria } from './kriteria/kriteria.entity';
import { KriteriaModule } from './kriteria/kriteria.module';
import { Disposisi } from './disposisi/disposisi.entity';
import { DisposisiModule } from './disposisi/disposisi.module';
import { MonitoringModule } from './monitoring/monitoring.module';
import { IntegrationModule } from './integration/integration.module';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/notification.entity';
import { ValidasiBiroPKU } from './monitoring/validasi-biro-pku.entity';
import { EventsModule } from './events/events.module';
import { SkpPenilaiModule } from './skp-penilai/skp-penilai.module';
import { SkpPenilaiConfig } from './skp-penilai/skp-penilai.entity';
import { SkpRencanaModule } from './skp-rencana/skp-rencana.module';
import { SkpRencanaStatus } from './skp-rencana/skp-rencana.entity';
import { RoleViewPermission } from './roles/role-view-permission.entity';
import jwtConfig from './config/jwt.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [jwtConfig],
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
        entities: [
          User, UserRelation,
          Role, UserRole,
          Indikator,
          TargetUniversitas, TargetUnit,
          Realisasi, RealisasiFile,
          BaselineData, Kriteria, Disposisi,
          Notification,
          ValidasiBiroPKU,
          SkpPenilaiConfig,
          SkpRencanaStatus,
          RoleViewPermission,
        ],
        synchronize: configService.get('DATABASE_SYNCHRONIZE') === 'true',
        logging: configService.get('DATABASE_LOGGING') === 'true',
      }),
    }),
    ScheduleModule.forRoot(),
    EventsModule,
    UsersModule,
    AuthModule,
    IndikatorModule,
    TargetsModule,
    RealisasiModule,
    BaselineDataModule,
    KriteriaModule,
    DisposisiModule,
    MonitoringModule,
    IntegrationModule,
    NotificationsModule,
    SkpPenilaiModule,
    SkpRencanaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
