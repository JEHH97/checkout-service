import { BadRequestException, Controller, Headers, Inject, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Request } from 'express';
import { PaymentGateway, PAYMENT_GATEWAY } from '../payments/payment-gateway';
import { PrismaService } from '../prisma.service';
@ApiTags('webhooks')
@Controller('webhooks')
export class WebhooksController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    @InjectQueue('stripe-events') private readonly queue: Queue,
  ) {}
  @Post('stripe') async receive(
    @Req() req: Request & { rawBody?: Buffer },
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature || !req.rawBody)
      throw new BadRequestException('Signed raw webhook body required');
    let event;
    try {
      event = this.gateway.verifyWebhook(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid webhook signature');
    }
    const seen = await this.prisma.webhookEvent.findUnique({ where: { id: event.id } });
    if (seen) return { received: true, duplicate: true };
    await this.prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
    const orderId = event.data.object.metadata?.orderId;
    await this.queue.add(
      'process',
      { type: event.type, orderId },
      { jobId: event.id, removeOnComplete: true },
    );
    return { received: true };
  }
}
