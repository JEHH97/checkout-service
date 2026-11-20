import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class OutboxRelay implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelay.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.publishBatch(), 2500);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async publishBatch() {
    try {
      const events = await this.prisma.outboxEvent.findMany({
        where: { publishedAt: null },
        take: 50,
        orderBy: { createdAt: 'asc' },
      });
      for (const event of events) {
        this.logger.log(
          { eventId: event.id, topic: event.topic, aggregateId: event.aggregateId },
          'outbox event relayed',
        );
        await this.prisma.outboxEvent.update({
          where: { id: event.id },
          data: { publishedAt: new Date() },
        });
      }
    } catch (error) {
      this.logger.warn(`outbox relay will retry after transient error: ${String(error)}`);
    }
  }
}
