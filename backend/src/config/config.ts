/**
 * Typed application configuration parsed from the environment (AGENTS: no
 * secrets in code; config via environment variables with a typed module).
 */
export interface AppConfig {
  readonly port: number;
  readonly llmBaseUrl: string;
  readonly llmApiKey: string;
  readonly llmTimeoutMs: number;
  /** Gateway API key -> tenant id, parsed from PG_API_KEYS (`key:tenant,...`). */
  readonly gatewayKeys: Readonly<Record<string, string>>;
}

export const DEFAULT_LLM_BASE_URL = 'https://api.openai.com';
export const DEFAULT_PORT = 3000;
export const DEFAULT_LLM_TIMEOUT_MS = 120_000;

export function parseAppConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: toPositiveInteger(env['PORT'], DEFAULT_PORT),
    llmBaseUrl: env['PG_LLM_BASE_URL'] ?? DEFAULT_LLM_BASE_URL,
    llmApiKey: env['PG_LLM_API_KEY'] ?? '',
    llmTimeoutMs: toPositiveInteger(env['PG_LLM_TIMEOUT_MS'], DEFAULT_LLM_TIMEOUT_MS),
    gatewayKeys: parseGatewayKeys(env['PG_API_KEYS']),
  };
}

function parseGatewayKeys(rawEnvValue: string | undefined): Record<string, string> {
  const gatewayKeys: Record<string, string> = {};
  if (!rawEnvValue) return gatewayKeys;
  for (const pair of rawEnvValue.split(',')) {
    const separatorIndex = pair.indexOf(':');
    if (separatorIndex <= 0) continue;
    const apiKey = pair.slice(0, separatorIndex).trim();
    const tenantId = pair.slice(separatorIndex + 1).trim();
    if (apiKey && tenantId) gatewayKeys[apiKey] = tenantId;
  }
  return gatewayKeys;
}

function toPositiveInteger(rawEnvValue: string | undefined, fallback: number): number {
  const parsed = Number(rawEnvValue);
  return rawEnvValue !== undefined && Number.isInteger(parsed) && parsed > 0
    ? parsed
    : fallback;
}
