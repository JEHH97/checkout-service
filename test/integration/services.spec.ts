import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
const hasServices = Boolean(process.env.DATABASE_URL && process.env.REDIS_URL);
describe('PostgreSQL and Redis integration', () => {
  const prisma = new PrismaClient();
  const redis = new Redis(process.env.REDIS_URL ?? 'redis://127.0.0.1:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  afterAll(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
  (hasServices ? it : it.skip)('persists an outbox event and reaches the queue store', async () => {
    await prisma.$connect();
    const event = await prisma.outboxEvent.create({
      data: { topic: 'integration.ping', aggregateId: 'test', payload: { ok: true } },
    });
    expect(await prisma.outboxEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
    await prisma.outboxEvent.delete({ where: { id: event.id } });
    await redis.connect();
    expect(await redis.ping()).toBe('PONG');
    await redis.set('checkout:integration-smoke', 'ok', 'EX', 15);
    expect(await redis.get('checkout:integration-smoke')).toBe('ok');
    await redis.del('checkout:integration-smoke');
  });
});
