import { Controller, Headers, Param, Post, BadRequestException, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
@ApiTags('payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post(':orderId/intents')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  initiate(@Param('orderId') id: string, @Headers('idempotency-key') key?: string) {
    if (!key) throw new BadRequestException('Idempotency-Key header is required');
    return this.payments.initiate(id, key);
  }

  @Post(':orderId/refunds') refund(@Param('orderId') id: string) {
    return this.payments.refund(id);
  }
}
