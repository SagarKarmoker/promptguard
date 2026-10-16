import { Inject, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ERROR_CODES, gatewayError, toErrorBody } from '../common/index.js';
import { ensureRequestContext } from '../common/index.js';
import { TENANT_RESOLVER, type TenantResolver } from './tenant-resolver.port.js';

const BEARER_PATTERN = /^Bearer\s+(\S+)$/i;

/**
 * Guards all `/v1/*` routes: requires `Authorization: Bearer <gateway key>`
 * and enriches the request context with tenant identity. Returns a
 * structured 401 (`{ error: { code: 'unauthorized' } }`) on failure.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    @Inject(TENANT_RESOLVER) private readonly tenantResolver: TenantResolver,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Mounted middleware sees a relative req.path; originalUrl is stable.
    if (!req.originalUrl.startsWith('/v1/')) {
      next();
      return;
    }
    const apiKey = extractBearerToken(req.headers['authorization']);
    const identity = apiKey ? this.tenantResolver.resolve(apiKey) : null;
    if (!identity) {
      res
        .status(401)
        .json(
          toErrorBody(
            gatewayError(
              ERROR_CODES.unauthorized,
              'missing or invalid gateway API key',
              401,
            ),
          ),
        );
      return;
    }
    const context = ensureRequestContext(req);
    context.tenantId = identity.tenantId;
    context.apiKeyId = identity.apiKeyId;
    next();
  }
}

function extractBearerToken(authorization: string | string[] | undefined): string | null {
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!value) return null;
  return value.match(BEARER_PATTERN)?.[1] ?? null;
}
