import { Global, Module } from '@nestjs/common';
import { APP_CONFIG } from '../config/index.js';
import type { AppConfig } from '../config/index.js';
import { EnvTenantResolver } from './env-tenant-resolver.adapter.js';
import { AuthMiddleware } from './auth.middleware.js';
import { TENANT_RESOLVER } from './tenant-resolver.port.js';

@Global()
@Module({
  providers: [
    AuthMiddleware,
    {
      provide: TENANT_RESOLVER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new EnvTenantResolver(config.gatewayKeys),
    },
  ],
  exports: [TENANT_RESOLVER],
})
export class AuthModule {}
