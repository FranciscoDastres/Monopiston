import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get()
  info() {
    return {
      name: 'Monopiston API',
      version: '0.1.0',
    };
  }
}
