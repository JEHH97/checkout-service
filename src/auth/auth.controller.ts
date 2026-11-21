import { Body, Controller, Post } from '@nestjs/common';
import { ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { AuthService } from './auth.service';

class CredentialsDto {
  @ApiProperty({ example: 'admin@example.test' })
  @IsEmail()
  email!: string;
  @ApiProperty({ example: 'DemoAdmin2026!' })
  @IsString()
  @MinLength(8)
  password!: string;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Post('register') register(@Body() body: CredentialsDto) {
    return this.auth.register(body.email, body.password);
  }
  @Post('login') login(@Body() body: CredentialsDto) {
    return this.auth.login(body.email, body.password);
  }
}
