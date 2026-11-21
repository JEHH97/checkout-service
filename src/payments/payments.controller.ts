import {
  Controller,
  Headers,
  Param,
  Post,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/access.decorator';
@ApiTags('payments')
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}
  @Post(':orderId/intents')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  initiate(
    @Param('orderId') id: string,
    @Req() req: Request & { user?: { sub: string } },
    @Headers('idempotency-key') key?: string,
  ) {
    if (!key) throw new BadRequestException('Idempotency-Key header is required');
    return this.payments.initiate(id, req.user!.sub, key);
  }

  @Post(':orderId/refunds')
  @Roles('admin')
  refund(@Param('orderId') id: string) {
    return this.payments.refund(id);
  }
}
