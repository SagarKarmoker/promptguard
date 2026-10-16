import { Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { ConfigReadinessCheck } from './config-readiness.check.js';
import { HealthController } from './health.controller.js';
import { READINESS_CHECKS } from './readiness-check.port.js';

@Module({
  controllers: [HealthController],
  providers: [
    {
      provide: READINESS_CHECKS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [new ConfigReadinessCheck(config)],
    },
  ],
})
export class HealthModule {}
