import {
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('demo')
@UseGuards(JwtAuthGuard)
@Controller('demo')
export class DemoPaymentsController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('stripe-events') private readonly queue: Queue,
  ) {}

  @Post('orders/:orderId/pay')
  async completeFakePayment(
    @Param('orderId') orderId: string,
    @Req() req: Request & { user?: { sub: string; role: string } },
  ) {
    if (process.env.DEMO_MODE !== 'true' || process.env.PAYMENT_ADAPTER !== 'fake') {
      throw new NotFoundException();
    }

    const payment = await this.prisma.payment.findFirst({
      where: { orderId },
      include: { order: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.order.userId !== req.user!.sub && req.user!.role !== 'admin')
      throw new NotFoundException('Payment not found');
    if (payment.order.state === 'paid') {
      return { received: true, duplicate: true, orderId };
    }
    if (payment.order.state !== 'awaiting_payment') {
      throw new ConflictException('Order is not awaiting payment');
    }

    const eventId = `evt_demo_${payment.id}`;
    const existing = await this.prisma.webhookEvent.findUnique({ where: { id: eventId } });
    if (existing) return { received: true, duplicate: true, eventId, orderId };

    await this.prisma.webhookEvent.create({
      data: { id: eventId, type: 'payment_intent.succeeded' },
    });
    await this.queue.add(
      'process',
      { type: 'payment_intent.succeeded', orderId },
      { jobId: eventId, removeOnComplete: true },
    );
    return { received: true, eventId, orderId };
  }
}
