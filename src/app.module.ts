import 'dotenv/config';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { LoggerModule } from 'nestjs-pino';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ProductsModule } from './products/products.module';
import { CartModule } from './cart/cart.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { HealthModule } from './health/health.module';
import { OutboxModule } from './outbox/outbox.module';
import { RootController } from './root.controller';
import { redisConnectionFromUrl } from './common/redis-connection';
import { pinoHttpOptions } from './common/logger.config';
import { rateLimitConfig } from './common/rate-limit.config';
const redisConnection = redisConnectionFromUrl(process.env.REDIS_URL ?? 'redis://localhost:6379');
const limits = rateLimitConfig();
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    LoggerModule.forRoot({ pinoHttp: pinoHttpOptions }),
    ThrottlerModule.forRoot([{ ttl: limits.ttl, limit: limits.globalLimit }]),
    BullModule.forRoot({ connection: redisConnection }),
    PrismaModule,
    AuthModule,
    ProductsModule,
    CartModule,
    OrdersModule,
    PaymentsModule,
    WebhooksModule,
    HealthModule,
    OutboxModule,
  ],
  controllers: [RootController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
