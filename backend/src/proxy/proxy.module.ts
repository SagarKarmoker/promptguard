import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { FetchUpstreamHttpClient } from './fetch-upstream-http.adapter.js';
import { OpenAiProviderAdapter } from './openai-provider-adapter.js';
import { ProxyController } from './proxy.controller.js';
import { ProxyService } from './proxy.service.js';
import { PROVIDER_ADAPTER } from './provider-adapter.port.js';
import { UPSTREAM_HTTP_CLIENT } from './upstream-http.port.js';

@Module({
  controllers: [ProxyController],
  providers: [
    ProxyService,
    {
      provide: UPSTREAM_HTTP_CLIENT,
      useFactory: () => new FetchUpstreamHttpClient(),
    },
    {
      provide: PROVIDER_ADAPTER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        new OpenAiProviderAdapter(config.llmBaseUrl, config.llmApiKey),
    },
  ],
  exports: [ProxyService],
})
export class ProxyModule {}
