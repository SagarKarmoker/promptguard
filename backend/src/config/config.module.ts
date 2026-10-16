import { Global, Module } from '@nestjs/common';
import { parseAppConfig } from './config.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Global()
@Module({
  providers: [
    { provide: APP_CONFIG, useFactory: () => parseAppConfig(process.env) },
  ],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
