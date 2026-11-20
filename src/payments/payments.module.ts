import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { FakePaymentGateway } from './fake-payment.gateway';
import { StripePaymentGateway } from './stripe-payment.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { PaymentsService } from './payments.service';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () =>
        process.env.PAYMENT_ADAPTER === 'stripe'
          ? new StripePaymentGateway()
          : new FakePaymentGateway(),
    },
    PaymentsService,
  ],
  exports: [PAYMENT_GATEWAY, PaymentsService],
})
export class PaymentsModule {}
