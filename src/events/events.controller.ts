import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { EventsService } from './events.service';

@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * GET /events/stream
   *
   * Server-Sent Events endpoint. Any connected browser tab subscribes here
   * and receives 'config' events whenever an admin mutates data, plus a
   * 'heartbeat' ping every 25 s to keep the connection alive.
   *
   * NestJS automatically sets:
   *   Content-Type: text/event-stream
   *   Cache-Control: no-cache
   *   Connection: keep-alive
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.eventsService.stream$;
  }
}
