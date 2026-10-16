import type { Request } from 'express';

/**
 * Shared per-request context used by auth, proxy and (later) rate-limit/cache modules.
 * RequestIdMiddleware creates it for every request; AuthMiddleware enriches it.
 */
export interface RequestContext {
  requestId: string;
  startedAt: number;
  tenantId?: string;
  apiKeyId?: string;
}

/** Express `Request` extended with the optional PromptGuard context slot. */
export interface PgRequest extends Request {
  pgContext?: RequestContext;
}

export function peekRequestContext(req: Request): RequestContext | undefined {
  return (req as PgRequest).pgContext;
}

/** Guarantees a context exists (self-healing fallback for minimal paths). */
export function ensureRequestContext(req: Request): RequestContext {
  const holder = req as PgRequest;
  holder.pgContext ??= { requestId: crypto.randomUUID(), startedAt: Date.now() };
  return holder.pgContext;
}

/** Reads the first scalar value of a possibly repeated header. */
export function firstHeader(value: string | string[] | undefined): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
