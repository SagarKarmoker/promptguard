import { DEFAULT_LLM_BASE_URL, DEFAULT_PORT, parseAppConfig } from './config.js';

describe('parseAppConfig', () => {
  it('applies safe defaults for an empty environment', () => {
    const config = parseAppConfig({});

    expect(config.port).toBe(DEFAULT_PORT);
    expect(config.llmBaseUrl).toBe(DEFAULT_LLM_BASE_URL);
    expect(config.llmTimeoutMs).toBe(120_000);
    expect(config.llmApiKey).toBe('');
    expect(config.gatewayKeys).toEqual({});
  });

  it('parses gateway keys into an apiKey -> tenant map, dropping malformed pairs', () => {
    const config = parseAppConfig({
      PG_API_KEYS: ' pgk_a : tenant-a , malformed , :no-key , pgk_b:tenant-b , pgk_c:',
    });

    expect(config.gatewayKeys).toEqual({ pgk_a: 'tenant-a', pgk_b: 'tenant-b' });
  });

  it('reads numeric overrides when valid, falling back otherwise', () => {
    expect(parseAppConfig({ PORT: '8787', PG_LLM_TIMEOUT_MS: '5000' }).port).toBe(8787);
    expect(parseAppConfig({ PORT: '8787', PG_LLM_TIMEOUT_MS: '5000' }).llmTimeoutMs).toBe(5000);
    expect(parseAppConfig({ PORT: 'nonsense' }).port).toBe(DEFAULT_PORT);
    expect(parseAppConfig({ PG_LLM_TIMEOUT_MS: '-1' }).llmTimeoutMs).toBe(120_000);
  });

  it('keeps a custom upstream base URL', () => {
    expect(
      parseAppConfig({ PG_LLM_BASE_URL: 'https://upstream.test' }).llmBaseUrl,
    ).toBe('https://upstream.test');
  });
});
