import { FakePaymentGateway } from './fake-payment.gateway';
import { PaymentGateway } from './payment-gateway';
import { StripePaymentGateway } from './stripe-payment.gateway';

export function createPaymentGateway(adapter?: string): PaymentGateway {
  if (adapter === 'stripe') return new StripePaymentGateway();
  if (adapter === 'fake') return new FakePaymentGateway();

  // Preserve the existing fallback behavior for deployments without an adapter value.
  return new FakePaymentGateway();
}
