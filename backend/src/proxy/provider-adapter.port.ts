/**
 * Port: describes how to reach one upstream LLM provider for a proxied call.
 * Adapters normalize provider-specific auth, base path and header rules
 * (OpenAI, Anthropic, generic OpenAI-compatible, ...).
 */
export interface ProviderTargetContext {
  readonly method: string;
  readonly path: string;
  readonly incomingHeaders: Readonly<Record<string, string | string[] | undefined>>;
}

export interface ProviderTarget {
  readonly url: string;
  readonly headers: Record<string, string>;
}

export interface ProviderAdapter {
  readonly providerId: string;
  buildTarget(context: ProviderTargetContext): ProviderTarget;
}

export const PROVIDER_ADAPTER = Symbol('PROVIDER_ADAPTER');

/** Reads the first scalar value of a possibly repeated header. */
export function firstHeaderValue(
  value: string | string[] | undefined,
): string | undefined {
  if (value === undefined) return undefined;
  return Array.isArray(value) ? value[0] : value;
}
