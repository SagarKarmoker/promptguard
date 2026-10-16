import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthMiddleware, AuthModule } from './auth/index.js';
import { RequestIdMiddleware } from './common/index.js';
import { ConfigModule } from './config/index.js';
import { HealthModule } from './health/index.js';
import { ProxyModule } from './proxy/index.js';

@Module({
  imports: [ConfigModule, AuthModule, HealthModule, ProxyModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
    consumer.apply(AuthMiddleware).forRoutes('*path');
  }
}
