import {
  ProviderAdapter,
  firstHeaderValue,
  type ProviderTarget,
  type ProviderTargetContext,
} from './provider-adapter.port.js';

/**
 * OpenAI-compatible provider adapter: forwards the proxied path under the
 * configured base URL's `/v1` segment and swaps the gateway bearer token
 * for the upstream one.
 */
export class OpenAiProviderAdapter implements ProviderAdapter {
  readonly providerId = 'openai';

  constructor(private readonly baseUrl: string, private readonly apiKey: string) {}

  buildTarget(context: ProviderTargetContext): ProviderTarget {
    const url = `${trimTrailingSlash(this.baseUrl)}/v1/${trimLeadingSlash(context.path)}`;
    const headers: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
      'content-type':
        firstHeaderValue(context.incomingHeaders['content-type']) ?? 'application/json',
    };
    const accept = firstHeaderValue(context.incomingHeaders['accept']);
    if (accept) headers['accept'] = accept;
    return { url, headers };
  }
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/, '');
}
