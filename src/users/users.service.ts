import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';
import { UserRelation } from './user_relation.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(UserRelation)
    private userRelationRepo: Repository<UserRelation>,
    @InjectRepository(Role)
    private roleRepo: Repository<Role>,
    @InjectRepository(UserRole)
    private userRoleRepo: Repository<UserRole>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find({
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { id },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { email },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  findByNip(nip: string): Promise<User | null> {
    return this.usersRepository.findOne({
      where: { nip },
      relations: ['userRoles', 'userRoles.role'],
    });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepository.create({
      nip: dto.nip,
      nama: dto.nama,
      email: dto.email,
      password: hashed,
      jenis: dto.jenis ?? null,
    });
    const savedUser = await this.usersRepository.save(user);

    // Assign primary role
    if (dto.roleId) {
      await this.userRoleRepo.save(
        this.userRoleRepo.create({ userId: savedUser.id, roleId: dto.roleId, isPrimary: true }),
      );
    }

    // Assign extra roles
    if (dto.extraRoleIds?.length) {
      for (const rid of dto.extraRoleIds) {
        await this.userRoleRepo.save(
          this.userRoleRepo.create({ userId: savedUser.id, roleId: rid, isPrimary: false }),
        );
      }
    }

    // Assign atasan relation
    if (dto.atasanId) {
      await this.userRelationRepo.save(
        this.userRelationRepo.create({ userId: savedUser.id, parentId: dto.atasanId }),
      );
    }

    return (await this.findOne(savedUser.id))!;
  }

  async findAllRoles(): Promise<Role[]> {
    return this.roleRepo.find({ order: { level: 'ASC', name: 'ASC' } });
  }

  async findByName(name: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { nama: name } });
  }

  async validateCredentials(identifier: string, password: string): Promise<{ user?: User; error?: string }> {
    let user = await this.findByEmail(identifier);
    if (!user) user = await this.findByNip(identifier);
    if (!user && !isNaN(Number(identifier))) user = await this.findOne(Number(identifier));
    if (!user) user = await this.findByName(identifier);
    if (!user) return { error: 'not_found' };

    let match = false;
    if (user.password.startsWith('$2')) {
      match = await bcrypt.compare(password, user.password);
    } else {
      match = password === user.password;
    }
    if (!match) return { error: 'wrong_password' };
    return { user };
  }

  async update(id: number, dto: UpdateUserDto): Promise<User | null> {
    const payload: Partial<User> = {};
    if (dto.nip !== undefined) payload.nip = dto.nip ?? null;
    if (dto.nama) payload.nama = dto.nama;
    if (dto.email) payload.email = dto.email;
    if (dto.password) payload.password = await bcrypt.hash(dto.password, 10);
    if (dto.jenis !== undefined) payload.jenis = dto.jenis ?? null;

    if (Object.keys(payload).length > 0) {
      await this.usersRepository.update(id, payload);
    }

    // Update primary role
    if (dto.roleId !== undefined) {
      await this.userRoleRepo.update({ userId: id, isPrimary: true }, { isPrimary: false });
      if (dto.roleId !== null) {
        const existing = await this.userRoleRepo.findOne({ where: { userId: id, roleId: dto.roleId } });
        if (existing) {
          await this.userRoleRepo.update(existing.id, { isPrimary: true });
        } else {
          await this.userRoleRepo.save(
            this.userRoleRepo.create({ userId: id, roleId: dto.roleId, isPrimary: true }),
          );
        }
      }
    }

    // Update atasan relation
    if (dto.atasanId !== undefined) {
      await this.userRelationRepo.delete({ userId: id });
      if (dto.atasanId !== null) {
        await this.userRelationRepo.save(
          this.userRelationRepo.create({ userId: id, parentId: dto.atasanId }),
        );
      }
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findByRole(roleId: number): Promise<User[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { roleId },
      relations: ['user'],
    });
    return userRoles.map((ur) => ur.user).filter(Boolean);
  }

  async findRelatedUsersFor(userId: number): Promise<User[]> {
    const relations = await this.userRelationRepo.find({
      where: { parentId: userId },
      relations: ['user', 'user.userRoles', 'user.userRoles.role'],
    });
    return relations.map((r) => r.user).filter(Boolean) as User[];
  }

  async hasRelatedUsers(userId: number): Promise<boolean> {
    const count = await this.userRelationRepo.count({ where: { parentId: userId } });
    return count > 0;
  }
}
