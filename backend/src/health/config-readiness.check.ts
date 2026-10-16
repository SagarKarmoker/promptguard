import type { AppConfig } from '../config/index.js';
import type { ReadinessCheck } from './readiness-check.port.js';

/** v1 readiness: process-critical configuration must be present (PRD §7). */
export class ConfigReadinessCheck implements ReadinessCheck {
  readonly name = 'config';

  constructor(private readonly config: AppConfig) {}

  async check(): Promise<void> {
    if (!this.config.llmBaseUrl) {
      throw new Error('PG_LLM_BASE_URL is not configured');
    }
    if (!this.config.llmApiKey) {
      throw new Error('PG_LLM_API_KEY is not configured');
    }
    if (Object.keys(this.config.gatewayKeys).length === 0) {
      throw new Error('PG_API_KEYS is not configured');
    }
  }
}
