export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
export type PaymentIntentResult = { id: string; clientSecret: string; status: string };
export interface PaymentGateway {
  createIntent(
    orderId: string,
    amountCents: number,
    idempotencyKey: string,
  ): Promise<PaymentIntentResult>;
  refund(paymentIntentId: string): Promise<{ id: string; status: string }>;
  verifyWebhook(
    rawBody: Buffer,
    signature: string,
  ): {
    id: string;
    type: string;
    data: { object: { id: string; metadata?: Record<string, string> } };
  };
}
