import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PaymentsModule } from '../payments/payments.module';
import { OrdersModule } from '../orders/orders.module';
import { WebhooksController } from './webhooks.controller';
import { WebhookProcessor } from './webhooks.processor';
@Module({
  imports: [BullModule.registerQueue({ name: 'stripe-events' }), PaymentsModule, OrdersModule],
  controllers: [WebhooksController],
  providers: [WebhookProcessor],
})
export class WebhooksModule {}
