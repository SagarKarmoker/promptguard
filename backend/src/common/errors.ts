/**
 * Stable error vocabulary for the PromptGuard gateway (see PRD §7).
 * Error bodies follow the shape: { error: { code, message } }.
 */
export const ERROR_CODES = {
  unauthorized: 'unauthorized',
  upstreamUnconfigured: 'upstream_not_configured',
  upstreamUnavailable: 'upstream_unavailable',
  upstreamTimeout: 'upstream_timeout',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface GatewayErrorBody {
  error: { code: ErrorCode; message: string };
}

export interface GatewayError extends GatewayErrorBody {
  readonly status: number;
  readonly retryAfterSeconds?: number;
}

/** Body-only view of a gateway error (without transport metadata). */
export function toErrorBody(error: GatewayError): GatewayErrorBody {
  return { error: error.error };
}

export function gatewayError(
  code: ErrorCode,
  message: string,
  status: number,
  retryAfterSeconds?: number,
): GatewayError {
  return { error: { code, message }, status, retryAfterSeconds };
}

/** Thrown when the upstream HTTP call exceeds its configured timeout. */
export class UpstreamTimeoutError extends Error {
  constructor(message = 'upstream timed out') {
    super(message);
    this.name = 'UpstreamTimeoutError';
  }
}

/** Thrown when the upstream HTTP call fails to connect or mid-flight. */
export class UpstreamUnavailableError extends Error {
  constructor(cause: unknown) {
    super('upstream fetch failed');
    this.name = 'UpstreamUnavailableError';
    this.cause = cause;
  }
}
