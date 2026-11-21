import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { fingerprint, replayOrConflict } from '../domain/idempotency';
import { OrderState, transitionOrder } from '../domain/order-state';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}
  async create(userId: string, key: string) {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });
    if (!cart?.items.length) throw new BadRequestException('Cart is empty');
    const request = cart.items.map(({ productId, quantity }) => ({ productId, quantity }));
    const prior = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
    const replay = replayOrConflict(
      prior
        ? {
            requestHash: prior.requestHash,
            status: prior.statusCode,
            body: prior.response as object,
          }
        : undefined,
      request,
    );
    if (replay) return replay.body;
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          let totalCents = 0;
          const lines: { productId: string; quantity: number; unitPrice: number }[] = [];
          for (const item of cart.items) {
            const reserved = await tx.product.updateMany({
              where: {
                id: item.productId,
                version: item.product.version,
                available: { gte: item.quantity },
              },
              data: { available: { decrement: item.quantity }, version: { increment: 1 } },
            });
            if (reserved.count !== 1)
              throw new BadRequestException(`Stock unavailable for ${item.product.name}`);
            totalCents += item.product.priceCents * item.quantity;
            lines.push({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.product.priceCents,
            });
          }
          const order = await tx.order.create({
            data: {
              userId,
              state: OrderState.AwaitingPayment,
              totalCents,
              items: { create: lines },
            },
          });
          const response = { id: order.id, state: order.state, totalCents };
          await tx.idempotencyRecord.create({
            data: { key, requestHash: fingerprint(request), statusCode: 201, response },
          });
          await tx.outboxEvent.create({
            data: { topic: 'order.created', aggregateId: order.id, payload: response },
          });
          await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
          return response;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ConflictException('Inventory changed concurrently; retry with a new order key');
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const record = await this.prisma.idempotencyRecord.findUnique({ where: { key } });
        const result = replayOrConflict(
          record
            ? {
                requestHash: record.requestHash,
                status: record.statusCode,
                body: record.response as object,
              }
            : undefined,
          request,
        );
        if (result) return result.body;
      }
      throw error;
    }
  }
  async transition(id: string, next: OrderState, ownerId?: string) {
    const order = await this.prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new NotFoundException('Order not found');
    if (ownerId && order.userId !== ownerId) throw new NotFoundException('Order not found');
    const state = transitionOrder(order.state as OrderState, next);
    return this.prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id }, data: { state } });
      if (state === OrderState.Cancelled) {
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { available: { increment: item.quantity }, version: { increment: 1 } },
          });
        }
      }
      await tx.outboxEvent.create({
        data: { topic: `order.${state}`, aggregateId: id, payload: { id, state } },
      });
      return { id, state };
    });
  }

  async find(id: string, ownerId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, payments: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.userId !== ownerId) throw new NotFoundException('Order not found');
    return order;
  }
}
