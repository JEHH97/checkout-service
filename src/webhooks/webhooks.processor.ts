import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { OrdersService } from '../orders/orders.service';
import { OrderState } from '../domain/order-state';
@Injectable()
@Processor('stripe-events')
export class WebhookProcessor extends WorkerHost {
  constructor(private readonly orders: OrdersService) {
    super();
  }
  async process(job: Job<{ orderId?: string; type: string }>) {
    if (job.data.type === 'payment_intent.succeeded' && job.data.orderId)
      return this.orders.transition(job.data.orderId, OrderState.Paid);
    return { ignored: true };
  }
}
