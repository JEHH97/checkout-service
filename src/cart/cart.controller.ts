import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
class AddItemDto {
  @IsString() productId!: string;
  @IsInt() @Min(1) quantity!: number;
}
@ApiTags('cart')
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly prisma: PrismaService) {}
  @Post('items') async add(@Req() req: { user?: { sub: string } }, @Body() body: AddItemDto) {
    const userId = req.user!.sub;
    const cart = await this.prisma.cart.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
    return this.prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: body.productId } },
      create: { cartId: cart.id, productId: body.productId, quantity: body.quantity },
      update: { quantity: { increment: body.quantity } },
    });
  }
}
