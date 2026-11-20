import { Injectable } from '@nestjs/common';
import { PaymentGateway, PaymentIntentResult } from './payment-gateway';
@Injectable()
export class FakePaymentGateway implements PaymentGateway {
  async createIntent(orderId: string, amountCents: number): Promise<PaymentIntentResult> {
    return {
      id: `pi_${orderId}`,
      clientSecret: `secret_${orderId}`,
      status: amountCents > 0 ? 'requires_payment_method' : 'succeeded',
    };
  }
  async refund(paymentIntentId: string): Promise<{ id: string; status: string }> {
    return { id: `re_${paymentIntentId}`, status: 'succeeded' };
  }
  verifyWebhook(rawBody: Buffer, signature: string) {
    if (signature !== 'test-signature') throw new Error('Invalid webhook signature');
    return JSON.parse(rawBody.toString()) as ReturnType<PaymentGateway['verifyWebhook']>;
  }
}
