import { Injectable, NestMiddleware } from '@nestjs/common';
import { requestContext } from './request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: any, _res: any, next: () => void) {
    let userId: number | undefined;
    const auth: string | undefined = req.headers?.authorization;
    if (auth?.startsWith('Bearer ')) {
      try {
        const parts = auth.slice(7).split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          if (payload?.sub) userId = parseInt(payload.sub, 10);
        }
      } catch { /* ignore malformed JWT */ }
    }
    requestContext.run({ userId }, next);
  }
}
