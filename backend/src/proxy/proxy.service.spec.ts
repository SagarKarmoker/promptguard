import { UpstreamTimeoutError } from '../common/index.js';
import type { AppConfig } from '../config/index.js';
import { DEFAULT_LLM_TIMEOUT_MS } from '../config/index.js';
import { OpenAiProviderAdapter } from './openai-provider-adapter.js';
import type { ProxyRequestInput, ProxyOutcome } from './proxy.service.js';
import { ProxyService } from './proxy.service.js';
import type { UpstreamHttpClient, UpstreamRequest, UpstreamResponse } from './upstream-http.port.js';

class StubUpstreamHttpClient implements UpstreamHttpClient {
  readonly sentRequests: UpstreamRequest[] = [];

  constructor(
    private readonly impl: (request: UpstreamRequest) => Promise<UpstreamResponse>,
  ) {}

  async send(request: UpstreamRequest): Promise<UpstreamResponse> {
    this.sentRequests.push(request);
    return this.impl(request);
  }
}

const appConfig: AppConfig = {
  port: 3000,
  llmBaseUrl: 'https://upstream.test',
  llmApiKey: 'sk-upstream',
  llmTimeoutMs: DEFAULT_LLM_TIMEOUT_MS,
  gatewayKeys: {},
};

const json = (): UpstreamResponse => ({
  status: 200,
  headers: { 'content-type': 'application/json' },
  contentType: 'application/json',
  body: null,
});

function makeInput(overrides: Partial<ProxyRequestInput> = {}): ProxyRequestInput {
  return {
    method: 'POST',
    path: 'chat/completions',
    headers: { 'content-type': 'application/json' },
    body: null,
    ...overrides,
  };
}

describe('ProxyService.forward', () => {
  it('returns a structured 503 when no upstream API key is configured', async () => {
    const unconfigured: AppConfig = { ...appConfig, llmApiKey: '' };
    const service = new ProxyService(
      new StubUpstreamHttpClient(async () => json()),
      new OpenAiProviderAdapter('https://upstream.test', ''),
      unconfigured,
    );

    const outcome = await service.forward(makeInput());

    expect(outcome.kind).toBe('error');
    expect(outcome.status).toBe(503);
    expect(outcome.error.code).toBe('upstream_not_configured');
  });

  it('sends the provider target through the HTTP port and returns the upstream outcome', async () => {
    const client = new StubUpstreamHttpClient(async () => json());
    const service = new ProxyService(
      client,
      new OpenAiProviderAdapter('https://upstream.test', 'sk-upstream'),
      appConfig,
    );

    const outcome: ProxyOutcome = await service.forward(
      makeInput({ body: '{"messages":[]}', tenantId: 'tenant-a' }),
    );

    expect(outcome.kind).toBe('upstream');
    expect(client.sentRequests).toHaveLength(1);
    expect(client.sentRequests[0]?.url).toBe('https://upstream.test/v1/chat/completions');
    expect(client.sentRequests[0]?.headers['authorization']).toBe('Bearer sk-upstream');
    expect(client.sentRequests[0]?.body).toBe('{"messages":[]}');
    expect(client.sentRequests[0]?.timeoutMs).toBe(DEFAULT_LLM_TIMEOUT_MS);
  });

  it('maps timeouts to a 504 upstream_timeout outcome', async () => {
    const service = new ProxyService(
      new StubUpstreamHttpClient(async () => {
        throw new UpstreamTimeoutError();
      }),
      new OpenAiProviderAdapter('https://upstream.test', 'sk-upstream'),
      appConfig,
    );

    const outcome = await service.forward(makeInput());

    expect(outcome.kind).toBe('error');
    expect(outcome.status).toBe(504);
    expect(outcome.error.code).toBe('upstream_timeout');
  });

  it('maps network failures to a 502 upstream_unavailable outcome', async () => {
    const service = new ProxyService(
      new StubUpstreamHttpClient(async () => {
        throw new Error('connect ECONNREFUSED');
      }),
      new OpenAiProviderAdapter('https://upstream.test', 'sk-upstream'),
      appConfig,
    );

    const outcome = await service.forward(makeInput());

    expect(outcome.kind).toBe('error');
    expect(outcome.status).toBe(502);
    expect(outcome.error.code).toBe('upstream_unavailable');
  });
});
