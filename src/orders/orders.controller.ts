import {
  BadRequestException,
  Controller,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrderState } from '../domain/order-state';
import { Request } from 'express';
@ApiTags('orders')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}
  @Post() create(
    @Req() req: Request & { user?: { sub: string } },
    @Headers('idempotency-key') key?: string,
  ) {
    if (!key) throw new BadRequestException('Idempotency-Key header is required');
    return this.orders.create(req.user!.sub, key);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Req() req: Request & { user?: { sub: string } }) {
    return this.orders.transition(id, OrderState.Cancelled, req.user!.sub);
  }
}
