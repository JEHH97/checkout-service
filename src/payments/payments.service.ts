import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { fingerprint, replayOrConflict } from '../domain/idempotency';
import { OrderState, transitionOrder } from '../domain/order-state';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway';
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
  ) {}
  async initiate(orderId: string, userId: string, key: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId } });
    if (!order) throw new NotFoundException('Order not found');
    const previous = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    const replay = replayOrConflict(
      previous
        ? {
            requestHash: previous.requestHash,
            status: previous.statusCode,
            body: previous.response as object,
          }
        : undefined,
      { orderId },
    );
    if (replay) return replay.body;
    const result = await this.gateway.createIntent(order.id, order.totalCents, key);
    await this.prisma.$transaction([
      this.prisma.payment.create({
        data: { orderId, providerId: result.id, status: result.status },
      }),
      this.prisma.idempotencyRecord.create({
        data: { key, requestHash: fingerprint({ orderId }), statusCode: 201, response: result },
      }),
    ]);
    return result;
  }

  async refund(orderId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    const state = transitionOrder(payment.order.state as OrderState, OrderState.Refunded);
    const refund = await this.gateway.refund(payment.providerId);
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: orderId }, data: { state } }),
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: refund.status } }),
      this.prisma.outboxEvent.create({
        data: {
          topic: 'order.refunded',
          aggregateId: orderId,
          payload: { orderId, refundId: refund.id },
        },
      }),
    ]);
    return refund;
  }
}
