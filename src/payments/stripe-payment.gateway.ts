import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PaymentGateway, PaymentIntentResult } from './payment-gateway';
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  private readonly stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? 'sk_test_xxx');
  async createIntent(
    orderId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<PaymentIntentResult> {
    const intent = await this.stripe.paymentIntents.create(
      { amount: amountCents, currency: 'usd', metadata: { orderId } },
      { idempotencyKey },
    );
    return { id: intent.id, clientSecret: intent.client_secret ?? '', status: intent.status };
  }
  async refund(paymentIntentId: string) {
    const result = await this.stripe.refunds.create({ payment_intent: paymentIntentId });
    return { id: result.id, status: result.status ?? 'pending' };
  }
  verifyWebhook(rawBody: Buffer, signature: string) {
    return this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET ?? 'whsec_xxx',
    ) as unknown as ReturnType<PaymentGateway['verifyWebhook']>;
  }
}
