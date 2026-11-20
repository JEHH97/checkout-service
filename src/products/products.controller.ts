import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { PrismaService } from '../prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public, Roles } from '../auth/access.decorator';

class CreateProductDto {
  @IsString() name!: string;
  @IsInt() @Min(0) priceCents!: number;
  @IsInt() @Min(0) stock!: number;
}

class UpdateProductDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsInt() @Min(0) priceCents?: number;
  @IsOptional() @IsInt() @Min(0) stock?: number;
}

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get()
  @Public()
  async list(@Query('page') page = '1', @Query('limit') limit = '20', @Query('q') q?: string) {
    const take = Math.min(Math.max(Number(limit) || 20, 1), 100);
    const skip = (Math.max(Number(page) || 1, 1) - 1) * take;
    return this.prisma.product.findMany({
      where: q ? { name: { contains: q, mode: 'insensitive' } } : {},
      skip,
      take,
      orderBy: { name: 'asc' },
    });
  }
  @Post()
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  async create(@Body() body: CreateProductDto) {
    return this.prisma.product.create({ data: { ...body, available: body.stock } });
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  async update(@Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.prisma.product.update({
      where: { id },
      data: { name: body.name, priceCents: body.priceCents, available: body.stock },
    });
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @Roles('admin')
  async remove(@Param('id') id: string) {
    return this.prisma.product.delete({ where: { id } });
  }
}
