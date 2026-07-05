import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { MessageEvent } from '@nestjs/common';
import { Observable, Subject, merge, interval } from 'rxjs';
import { map } from 'rxjs/operators';
import { requestContext } from '../common/request-context';

export type ConfigDomain =
  | 'indikator'
  | 'cascade'
  | 'target'
  | 'baseline'
  | 'user'
  | 'disposisi';

export type ConfigAction = 'created' | 'updated' | 'deleted' | 'bulk';

export interface ConfigEvent {
  domain: ConfigDomain;
  action: ConfigAction;
  id?: number;
  meta?: Record<string, unknown>;
  actorId?: number;
  timestamp: string;
}

@Injectable()
export class EventsService implements OnModuleDestroy {
  private readonly subject = new Subject<ConfigEvent>();

  /**
   * Heartbeat every 25 s keeps SSE connections alive through proxies/firewalls
   * that close idle HTTP connections.
   */
  private readonly heartbeat$ = interval(25_000).pipe(
    map((): MessageEvent => ({ type: 'heartbeat', data: { ts: Date.now() } })),
  );

  /** Observable consumed by @Sse controller — one subscription per connected client. */
  get stream$(): Observable<MessageEvent> {
    const config$ = this.subject.pipe(
      map((event): MessageEvent => ({
        type: 'config',
        data: JSON.stringify(event),
      })),
    );
    return merge(config$, this.heartbeat$);
  }

  /**
   * Broadcast a config change event to all connected SSE clients.
   * Called by mutation controllers immediately after a successful write.
   */
  emit(
    domain: ConfigDomain,
    action: ConfigAction,
    id?: number,
    meta?: Record<string, unknown>,
  ): void {
    const actorId = requestContext.getStore()?.userId;
    this.subject.next({
      domain,
      action,
      id,
      meta,
      actorId,
      timestamp: new Date().toISOString(),
    });
  }

  onModuleDestroy() {
    this.subject.complete();
  }
}
