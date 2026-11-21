import { NestFactory } from '@nestjs/core';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma.service';
import { AuthController } from '../../src/auth/auth.controller';
import { rateLimitConfig } from '../../src/common/rate-limit.config';

describe('checkout HTTP flow', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: import('http').Server;

  beforeAll(async () => {
    process.env.PAYMENT_ADAPTER = 'fake';
    process.env.DEMO_MODE = 'true';
    app = await NestFactory.create(AppModule, { rawBody: true });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    server = app.getHttpServer();
  });

  beforeEach(async () => {
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.cartItem.deleteMany();
    await prisma.cart.deleteMany();
    await prisma.idempotencyRecord.deleteMany();
    await prisma.webhookEvent.deleteMany();
    await prisma.outboxEvent.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, carts, creates and pays an order through a signed webhook', async () => {
    const registration = await request(server)
      .post('/auth/register')
      .send({ email: `buyer-${Date.now()}@example.test`, password: 'DemoPass123!' })
      .expect(201);
    const token = registration.body.accessToken as string;
    const product = await prisma.product.create({
      data: { name: 'Desk Lamp', priceCents: 3200, available: 2 },
    });

    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);
    const created = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'e2e-order-1')
      .expect(201);
    expect(created.body.state).toBe('awaiting_payment');

    const payment = await request(server)
      .post(`/payments/${created.body.id}/intents`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'e2e-payment-1')
      .expect(201);
    expect(payment.body.id).toBe(`pi_${created.body.id}`);

    const event = {
      id: 'evt_e2e_payment_succeeded',
      type: 'payment_intent.succeeded',
      data: { object: { id: payment.body.id, metadata: { orderId: created.body.id } } },
    };
    await request(server)
      .post('/webhooks/stripe')
      .set('Stripe-Signature', 'test-signature')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify(event))
      .expect(201);

    let state = 'awaiting_payment';
    for (let attempt = 0; attempt < 30 && state !== 'paid'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const current = await prisma.order.findUnique({ where: { id: created.body.id } });
      state = current?.state ?? 'missing';
    }
    expect(state).toBe('paid');
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.available).toBe(1);
    expect(await prisma.webhookEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
  });

  it('completes a fake checkout through the API-only demo trigger, gated by DEMO_MODE', async () => {
    const registration = await request(server)
      .post('/auth/register')
      .send({ email: `demo-${Date.now()}@example.test`, password: 'DemoPass123!' })
      .expect(201);
    const token = registration.body.accessToken as string;
    const product = await prisma.product.create({
      data: { name: 'Demo Coffee Mug', priceCents: 1400, available: 2 },
    });

    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);
    const order = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'demo-order-key')
      .expect(201);
    const payment = await request(server)
      .post(`/payments/${order.body.id}/intents`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'demo-payment-key')
      .expect(201);
    expect(payment.body.status).toBe('requires_payment_method');

    process.env.DEMO_MODE = 'false';
    await request(server)
      .post(`/demo/orders/${order.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    process.env.DEMO_MODE = 'true';

    await request(server)
      .post(`/demo/orders/${order.body.id}/pay`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    let state = 'awaiting_payment';
    for (let attempt = 0; attempt < 30 && state !== 'paid'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      const current = await request(server)
        .get(`/orders/${order.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      state = current.body.state as string;
    }
    expect(state).toBe('paid');
  });

  it('redirects the root URL to the Swagger docs', async () => {
    await request(server).get('/').expect(302).expect('Location', '/docs');
  });

  it('configures stricter throttles on registration and login', () => {
    const { authLimit, ttl } = rateLimitConfig();
    for (const handler of [AuthController.prototype.login, AuthController.prototype.register]) {
      expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(authLimit);
      expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(ttl);
    }
  });

  it('prevents another customer from operating on an order and restricts refunds to admins', async () => {
    const ownerEmail = `owner-${Date.now()}@example.test`;
    const otherEmail = `other-${Date.now()}@example.test`;
    const owner = await request(server)
      .post('/auth/register')
      .send({ email: ownerEmail, password: 'DemoPass123!' })
      .expect(201);
    const other = await request(server)
      .post('/auth/register')
      .send({ email: otherEmail, password: 'DemoPass123!' })
      .expect(201);
    const product = await prisma.product.create({
      data: { name: 'Owner Only Item', priceCents: 2200, available: 1 },
    });
    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${owner.body.accessToken as string}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);
    const order = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${owner.body.accessToken as string}`)
      .set('Idempotency-Key', 'ownership-order')
      .expect(201);
    await request(server)
      .post(`/payments/${order.body.id}/intents`)
      .set('Authorization', `Bearer ${owner.body.accessToken as string}`)
      .set('Idempotency-Key', 'ownership-payment')
      .expect(201);

    const otherToken = other.body.accessToken as string;
    await request(server)
      .post(`/payments/${order.body.id}/intents`)
      .set('Authorization', `Bearer ${otherToken}`)
      .set('Idempotency-Key', 'ownership-attack-payment')
      .expect(404);
    await request(server)
      .get(`/orders/${order.body.id}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server)
      .post(`/orders/${order.body.id}/cancel`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server)
      .post(`/demo/orders/${order.body.id}/pay`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(404);
    await request(server)
      .post(`/payments/${order.body.id}/refunds`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403);
    await request(server)
      .post(`/payments/${order.body.id}/refunds`)
      .set('Authorization', `Bearer ${owner.body.accessToken as string}`)
      .expect(403);

    await prisma.order.update({ where: { id: order.body.id as string }, data: { state: 'paid' } });
    await prisma.user.update({
      where: { id: other.body.userId as string },
      data: { role: 'admin' },
    });
    const admin = await request(server)
      .post('/auth/login')
      .send({ email: otherEmail, password: 'DemoPass123!' })
      .expect(201);
    await request(server)
      .post(`/payments/${order.body.id}/refunds`)
      .set('Authorization', `Bearer ${admin.body.accessToken as string}`)
      .expect(201);
  });

  it('releases reserved stock when a customer cancels before payment', async () => {
    const registration = await request(server)
      .post('/auth/register')
      .send({ email: `cancel-${Date.now()}@example.test`, password: 'DemoPass123!' })
      .expect(201);
    const token = registration.body.accessToken as string;
    const product = await prisma.product.create({
      data: { name: 'Reusable Water Bottle', priceCents: 1600, available: 1 },
    });
    await request(server)
      .post('/cart/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ productId: product.id, quantity: 1 })
      .expect(201);
    const order = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'cancel-order-1')
      .expect(201);
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.available).toBe(0);
    await request(server)
      .post(`/orders/${order.body.id}/cancel`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.available).toBe(1);
  });

  it('does not oversell when two customers reserve the final unit concurrently', async () => {
    const first = await request(server)
      .post('/auth/register')
      .send({ email: `first-${Date.now()}@example.test`, password: 'DemoPass123!' })
      .expect(201);
    const second = await request(server)
      .post('/auth/register')
      .send({ email: `second-${Date.now()}@example.test`, password: 'DemoPass123!' })
      .expect(201);
    const product = await prisma.product.create({
      data: { name: 'Limited Edition Notebook', priceCents: 1200, available: 1 },
    });
    const tokens = [first.body.accessToken as string, second.body.accessToken as string];
    await Promise.all(
      tokens.map((token) =>
        request(server)
          .post('/cart/items')
          .set('Authorization', `Bearer ${token}`)
          .send({ productId: product.id, quantity: 1 })
          .expect(201),
      ),
    );
    const outcomes = await Promise.all(
      tokens.map((token, index) =>
        request(server)
          .post('/orders')
          .set('Authorization', `Bearer ${token}`)
          .set('Idempotency-Key', `concurrent-order-${index}`),
      ),
    );
    expect(outcomes.filter((result) => result.status === 201)).toHaveLength(1);
    expect(await prisma.order.count()).toBe(1);
    expect((await prisma.product.findUnique({ where: { id: product.id } }))?.available).toBe(0);
  });
});
