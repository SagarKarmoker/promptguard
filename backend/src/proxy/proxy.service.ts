import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from '../config/index.js';
import { APP_CONFIG } from '../config/index.js';
import { ERROR_CODES, gatewayError, UpstreamTimeoutError } from '../common/index.js';
import type { GatewayError } from '../common/index.js';
import type { ProviderAdapter } from './provider-adapter.port.js';
import { PROVIDER_ADAPTER } from './provider-adapter.port.js';
import type {
  UpstreamHttpClient,
  UpstreamResponse,
} from './upstream-http.port.js';
import { UPSTREAM_HTTP_CLIENT } from './upstream-http.port.js';

export interface ProxyRequestInput {
  readonly method: string;
  readonly path: string;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly body: string | null;
  readonly tenantId?: string;
}

export interface UpstreamOutcome extends UpstreamResponse {
  readonly kind: 'upstream';
}

export interface ErrorOutcome extends GatewayError {
  readonly kind: 'error';
}

export type ProxyOutcome = UpstreamOutcome | ErrorOutcome;

/**
 * Sending-off point between the gateway and the upstream provider.
 * Owns request shaping (via the provider adapter port), timeouts,
 * and the error semantics defined in PRD §7.
 */
@Injectable()
export class ProxyService {
  constructor(
    @Inject(UPSTREAM_HTTP_CLIENT) private readonly httpClient: UpstreamHttpClient,
    @Inject(PROVIDER_ADAPTER) private readonly providerAdapter: ProviderAdapter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async forward(input: ProxyRequestInput): Promise<ProxyOutcome> {
    if (!this.config.llmApiKey) {
      return {
        kind: 'error',
        ...gatewayError(
          ERROR_CODES.upstreamUnconfigured,
          'no upstream LLM API key configured (PG_LLM_API_KEY)',
          503,
        ),
      };
    }
    const target = this.providerAdapter.buildTarget({
      method: input.method,
      path: input.path,
      incomingHeaders: input.headers,
    });
    try {
      const response = await this.httpClient.send({
        method: input.method,
        url: target.url,
        headers: { ...target.headers },
        body: input.body,
        timeoutMs: this.config.llmTimeoutMs,
      });
      return { kind: 'upstream', ...response };
    } catch (error) {
      if (error instanceof UpstreamTimeoutError) {
        return {
          kind: 'error',
          ...gatewayError(
            ERROR_CODES.upstreamTimeout,
            'upstream LLM provider timed out',
            504,
          ),
        };
      }
      return {
        kind: 'error',
        ...gatewayError(
          ERROR_CODES.upstreamUnavailable,
          'upstream LLM provider is unreachable',
          502,
        ),
      };
    }
  }
}
