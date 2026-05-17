import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

interface LoginDto {
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

  @UseGuards(JwtAuthGuard)
  @Post('switch-role')
  async switchRole(@Req() req: any, @Body() body: { roleId: number }) {
    return this.authService.switchRole(req.user.id, body.roleId);
  }
}
