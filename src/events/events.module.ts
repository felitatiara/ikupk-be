import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';

/**
 * @Global() makes EventsService injectable in every module without each
 * one needing to import EventsModule. Register this module once in AppModule.
 */
@Global()
@Module({
  providers: [EventsService],
  controllers: [EventsController],
  exports: [EventsService],
})
export class EventsModule {}
