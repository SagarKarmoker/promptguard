import { Injectable } from '@nestjs/common';
import {
  UpstreamTimeoutError,
  UpstreamUnavailableError,
} from '../common/index.js';
import type {
  UpstreamHttpClient,
  UpstreamRequest,
  UpstreamResponse,
} from './upstream-http.port.js';

/** Global `fetch`-based adapter for the UpstreamHttpClient port. */
@Injectable()
export class FetchUpstreamHttpClient implements UpstreamHttpClient {
  async send(request: UpstreamRequest): Promise<UpstreamResponse> {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(
      () => controller.abort(new UpstreamTimeoutError()),
      request.timeoutMs,
    );
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body ?? undefined,
        signal: controller.signal,
      });
      return {
        status: response.status,
        headers: headersToRecord(response.headers),
        contentType: response.headers.get('content-type') ?? undefined,
        body: response.body,
      };
    } catch (error) {
      if (error instanceof UpstreamTimeoutError) throw error;
      throw new UpstreamUnavailableError(error);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}
