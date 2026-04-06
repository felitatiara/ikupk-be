import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(private usersService: UsersService) {}

  async validateUser(email: string, password: string) {
    // Use UsersService's credential validation (handles bcrypt)
    return this.usersService.validateCredentials(email, password);
  }

  async login(email: string, password: string) {
    const result = await this.validateUser(email, password);
    if (result.error === 'not_found') {
      throw new UnauthorizedException('User not found');
    }
    if (result.error === 'wrong_password') {
      throw new UnauthorizedException('Wrong password');
    }
    const user = result.user;
    if (!user) {
      throw new UnauthorizedException('User validation failed');
    }
    // Tambahkan flag isPKUAdmin
    const isPKUAdmin = user.role === 'admin' && user.unitId === 4;
    return {
      token: `dummy-token-for-user-${user.id}`,
      user: { id: user.id, nip: user.nip, nama: user.nama, email: user.email, role: user.role, unitId: user.unitId },
      isPKUAdmin
    };
  }
}
