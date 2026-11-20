import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; userId: string }> {
    const user = await this.prisma.user.create({
      data: { email, passwordHash: await bcrypt.hash(password, 10), role: 'customer' },
    });
    return {
      userId: user.id,
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
    };
  }

  async login(email: string, password: string): Promise<{ accessToken: string; userId: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash)))
      throw new UnauthorizedException('Invalid credentials');
    return {
      userId: user.id,
      accessToken: await this.jwt.signAsync({ sub: user.id, role: user.role }),
    };
  }
}
