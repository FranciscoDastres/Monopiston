import { Controller, Get } from '@nestjs/common';

@Controller('api')
export class ApiController {
  @Get()
  info() {
    return {
      name: 'Taller Mono Pistón API',
      version: '0.1.0',
    };
  }
}
