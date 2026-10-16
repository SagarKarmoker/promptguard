import type { AppConfig } from '../config/index.js';
import { ConfigModule } from '../config/index.js';
import { HealthController } from './health.controller.js';
import { ConfigReadinessCheck } from './config-readiness.check.js';
import { HealthModule } from './health.module.js';

const makeConfig = (overrides: Partial<AppConfig> = {}): AppConfig => ({
  port: 3000,
  llmBaseUrl: 'https://upstream.test',
  llmApiKey: 'sk-upstream',
  llmTimeoutMs: 1000,
  gatewayKeys: { 'pgk_a': 'tenant-a' },
  ...overrides,
});

describe('ConfigReadinessCheck', () => {
  it('passes when critical config is present', async () => {
    await expect(new ConfigReadinessCheck(makeConfig()).check()).resolves.toBeUndefined();
  });

  it('names the exact missing variable when config is incomplete', async () => {
    await expect(new ConfigReadinessCheck(makeConfig({ llmApiKey: '' })).check()).rejects.toThrow(
      'PG_LLM_API_KEY is not configured',
    );
    await expect(new ConfigReadinessCheck(makeConfig({ gatewayKeys: {} })).check()).rejects.toThrow(
      'PG_API_KEYS is not configured',
    );
  });
});

describe('HealthModule wiring', () => {
  it('injects every registered check into the controller', async () => {
    const { Test } = await import('@nestjs/testing');
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, HealthModule],
    }).compile();
    const controller: HealthController = moduleRef.get(HealthController);

    expect(controller.liveness()).toEqual({ status: 'ok' });
  });
});
