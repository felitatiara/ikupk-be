import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from '../users/users.service';
import { UserRole } from '../roles/user-role.entity';
import { JwtPayload } from '../common/interfaces/jwt-payload.interfaces';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
  ) {}

  async validateUser(nip: string, password: string) {
    return this.usersService.validateCredentials(nip, password);
  }

  async login(nip: string, password: string) {
    const result = await this.validateUser(nip, password);
    if (result.error === 'not_found') throw new UnauthorizedException('User not found');
    if (result.error === 'wrong_password') throw new UnauthorizedException('Wrong password');
    const user = result.user;
    if (!user) throw new UnauthorizedException('User validation failed');

    // Load roles untuk user ini
    const userRoles = await this.userRoleRepo.find({
      where: { userId: user.id },
      relations: ['role'],
    });
    const primaryRole = userRoles.find((ur) => ur.isPrimary) ?? userRoles[0];

    const payload: JwtPayload = {
      sub: user.id.toString(),
      email: user.email,
      role: primaryRole?.role?.name?.toLowerCase() ?? '',
      role_id: primaryRole?.roleId?.toString() ?? '',
    };

    const isPKUAdmin =
      primaryRole?.role?.name?.toLowerCase() === 'admin' &&
      primaryRole?.role?.unitNama?.toLowerCase().includes('pku');

    return {
      token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        nip: user.nip,
        nama: user.nama,
        email: user.email,
        jenis: user.jenis,
        role: primaryRole?.role?.name?.toLowerCase() ?? null,
        roleId: primaryRole?.roleId ?? null,
        unitNama: primaryRole?.role?.unitNama ?? null,
        roles: userRoles.map((ur) => ({
          id: ur.roleId,
          name: ur.role?.name,
          unitNama: ur.role?.unitNama,
          level: ur.role?.level,
          isPrimary: ur.isPrimary,
        })),
      },
      isPKUAdmin,
    };
  }
}
