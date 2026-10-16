import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Readable } from 'node:stream';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { ensureRequestContext, toErrorBody } from '../common/index.js';
import type { GatewayError } from '../common/index.js';
import type { ProxyRequestInput, ProxyOutcome } from './proxy.service.js';
import { ProxyService } from './proxy.service.js';

/** Upstream response headers safe to pass back to the client. */
const FORWARDABLE_RESPONSE_HEADERS = new Set([
  'content-type',
  'retry-after',
  'x-request-id',
]);

@Controller()
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @All('v1/*path')
  async proxy(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const method = req.method.toUpperCase();
    const context = ensureRequestContext(req);
    const input: ProxyRequestInput = {
      method,
      path: pathnameOf(req).replace(/^\/v1\//, ''),
      headers: req.headers,
      body: hasRequestBody(method) ? serializeJsonBody(req.body) : null,
      tenantId: context.tenantId,
    };

    const outcome = await this.proxyService.forward(input);

    if (outcome.kind === 'error') {
      respondWithGatewayError(res, outcome);
      return;
    }
    await respondWithUpstream(res, context.requestId, outcome);
  }
}

async function respondWithUpstream(
  res: Response,
  requestId: string,
  upstream: Extract<ProxyOutcome, { kind: 'upstream' }>,
): Promise<void> {
  res.status(upstream.status);
  res.setHeader('X-PG-Request-Id', requestId);
  for (const [name, value] of Object.entries(upstream.headers)) {
    if (isForwardableResponseHeader(name)) res.setHeader(name, value);
  }
  if (!upstream.body) {
    res.end();
    return;
  }
  const contentType = upstream.contentType ?? 'application/octet-stream';
  res.setHeader('content-type', contentType);
  if (contentType.includes('text/event-stream')) {
    // SSE goes chunk-by-chunk; never buffer the whole completion (PRD §5.4).
    await pipelineWebStreamToResponse(upstream.body, res);
    return;
  }
  res.send(await readBodyText(upstream.body));
}

function respondWithGatewayError(res: Response, error: GatewayError): void {
  if (error.retryAfterSeconds !== undefined) {
    res.setHeader('retry-after', String(error.retryAfterSeconds));
  }
  res.status(error.status).json(toErrorBody(error));
}

async function pipelineWebStreamToResponse(
  body: ReadableStream<Uint8Array>,
  res: Response,
): Promise<void> {
  const nodeStream = Readable.fromWeb(
    body as unknown as NodeWebReadableStream<Uint8Array>,
  );
  await new Promise<void>((resolve, reject) => {
    nodeStream.on('data', (chunk: Buffer) => {
      res.write(chunk);
    });
    nodeStream.on('end', () => {
      res.end();
      resolve();
    });
    nodeStream.on('error', reject);
  });
}

async function readBodyText(body: ReadableStream<Uint8Array>): Promise<string> {
  return new Response(body).text();
}

function isForwardableResponseHeader(name: string): boolean {
  if (name === 'x-pg-request-id') return false;
  return FORWARDABLE_RESPONSE_HEADERS.has(name) || name.startsWith('openai-');
}

function hasRequestBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

function serializeJsonBody(body: unknown): string {
  return JSON.stringify(body ?? {});
}

function pathnameOf(req: Request): string {
  // Mounted middleware/router layers may see a relative req.url.
  return new URL(req.originalUrl, 'http://promptguard.local').pathname;
}
