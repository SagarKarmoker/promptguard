import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ensureRequestContext, firstHeader } from './request-context.js';

/**
 * Assigns a request id to every incoming request and echoes it on the
 * response as `X-PG-Request-Id` (PRD §7). Runs before auth.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = firstHeader(req.headers['x-pg-request-id'] ?? req.headers['x-request-id']);
    const context = ensureRequestContext(req);
    context.requestId = incoming ?? context.requestId;
    res.setHeader('X-PG-Request-Id', context.requestId);
    next();
  }
}
