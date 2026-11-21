import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { PaymentsService } from './payments.service';
import { createPaymentGateway } from './payment-gateway.factory';
import { AuthModule } from '../auth/auth.module';
@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      useFactory: () => createPaymentGateway(process.env.PAYMENT_ADAPTER),
    },
    PaymentsService,
  ],
  exports: [PAYMENT_GATEWAY, PaymentsService],
})
export class PaymentsModule {}
