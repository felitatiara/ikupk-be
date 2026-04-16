import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

class LoginDto {
  nip: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
    return this.authService.login(body.nip, body.password);
  }
}
