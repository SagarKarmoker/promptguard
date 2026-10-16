/**
 * Port: minimal HTTP client abstraction over the upstream LLM provider.
 * Implementations must honor `timeoutMs` and surface errors as
 * UpstreamTimeoutError / UpstreamUnavailableError.
 */
export interface UpstreamRequest {
  readonly method: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string | null;
  readonly timeoutMs: number;
}

export interface UpstreamResponse {
  readonly status: number;
  /** Lower-cased response headers from the upstream provider. */
  readonly headers: Readonly<Record<string, string>>;
  readonly contentType: string | undefined;
  readonly body: ReadableStream<Uint8Array> | null;
}

export interface UpstreamHttpClient {
  send(request: UpstreamRequest): Promise<UpstreamResponse>;
}

export const UPSTREAM_HTTP_CLIENT = Symbol('UPSTREAM_HTTP_CLIENT');
