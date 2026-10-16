import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import type {
  UpstreamHttpClient,
  UpstreamRequest,
  UpstreamResponse,
} from '../src/proxy/index.js';
import { UPSTREAM_HTTP_CLIENT } from '../src/proxy/index.js';

process.env['PG_API_KEYS'] ??= 'pgk_test:tenant-a';
process.env['PG_LLM_API_KEY'] ??= 'sk-test-upstream';
process.env['PG_LLM_BASE_URL'] ??= 'https://upstream.test';

const createJsonBody = (text: string): ReadableStream<Uint8Array> => {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return stream;
};

/** Scriptable stand-in for the upstream LLM provider; records what we sent. */
class RecordingFakeUpstream implements UpstreamHttpClient {
  readonly sentRequests: UpstreamRequest[] = [];
  private scriptedResponse: UpstreamResponse | null = null;
  private scriptedFailure: Error | null = null;

  respondWith(response: UpstreamResponse): void {
    this.scriptedResponse = response;
  }

  failWith(error: Error): void {
    this.scriptedFailure = error;
  }

  async send(sentRequest: UpstreamRequest): Promise<UpstreamResponse> {
    this.sentRequests.push(sentRequest);
    if (this.scriptedFailure) throw this.scriptedFailure;
    return (
      this.scriptedResponse ?? {
        status: 200,
        headers: { 'content-type': 'application/json' },
        contentType: 'application/json',
        body: createJsonBody('{"ok":true}'),
      }
    );
  }
}

describe('PromptGuard gateway (e2e)', () => {
  let app: INestApplication;
  const upstream = new RecordingFakeUpstream();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(UPSTREAM_HTTP_CLIENT)
      .useValue(upstream)
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
    upstream.sentRequests.length = 0;
    upstream.scriptedResponse = null;
    upstream.scriptedFailure = null;
  });

  afterEach(async () => {
    await app.close();
  });

  it('serves liveness without authentication', async () => {
    const response = await request(app.getHttpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns a structured 401 for missing gateway keys on /v1 routes', async () => {
    const response = await request(app.getHttpServer()).get('/v1/chat/completions');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { code: 'unauthorized', message: expect.any(String) },
    });
    expect(upstream.sentRequests).toHaveLength(0);
  });

  it('proxies authenticated requests to the upstream provider', async () => {
    upstream.respondWith({
      status: 200,
      headers: { 'content-type': 'application/json' },
      contentType: 'application/json',
      body: createJsonBody('{"id":"chatcmpl_1"}'),
    });

    const response = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('authorization', 'Bearer pgk_test')
      .send({ model: 'gpt-4o-mini', messages: [] });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: 'chatcmpl_1' });
    expect(response.headers['x-pg-request-id']).toEqual(expect.any(String));

    const sent = upstream.sentRequests[0];
    expect(sent.url).toBe('https://upstream.test/v1/chat/completions');
    expect(sent.headers['authorization']).toBe('Bearer sk-test-upstream');
    expect(sent.body).toContain('"model":"gpt-4o-mini"');
  });

  it('streams SSE responses chunk-by-chunk without buffering', async () => {
    upstream.respondWith({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      contentType: 'text/event-stream',
      body: createJsonBody('data: {"chunk":1}\n\ndata: {"chunk":2}\n\ndata: [DONE]\n\n'),
    });

    const response = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('authorization', 'Bearer pgk_test')
      .send({ stream: true });

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');
    expect(response.text).toContain('data: {"chunk":1}');
    expect(response.text).toContain('data: [DONE]');
  });

  it('maps upstream network failures to a structured 502', async () => {
    upstream.failWith(new Error('connect ECONNREFUSED'));

    const response = await request(app.getHttpServer())
      .post('/v1/chat/completions')
      .set('authorization', 'Bearer pgk_test')
      .send({});

    expect(response.status).toBe(502);
    expect(response.body).toEqual({
      error: { code: 'upstream_unavailable', message: expect.any(String) },
    });
  });
});
