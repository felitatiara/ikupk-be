import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtPayload } from '../common/interfaces/jwt-payload.interfaces';
import { User } from '../users/user.entity';
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req) => {
          if (req.query && req.query.token) {
            return req.query.token as string;
          }
          return null;
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret') || 'default-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: parseInt(payload.sub, 10) },
      relations: ['userRoles', 'userRoles.role'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Attach active switched role from JWT so controllers can use it
    (user as any).activeRoleId = payload.role_id ? parseInt(payload.role_id, 10) : null;

    return user;
  }
}

