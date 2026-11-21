import { Controller, Get, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Response } from 'express';

@ApiExcludeController()
@Controller()
export class RootController {
  @Get()
  redirectToDocs(@Res() response: Response): void {
    response.redirect('/docs');
  }
}
