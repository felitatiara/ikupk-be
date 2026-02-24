import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  /**
   * Create a user.
   * Accepts either `name` or `nama` in the DTO and maps it to the entity's `name`.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const payload: Partial<User> = {
      nama: dto.nama,
      email: dto.email,
      password: hashed,
      role: dto.role,
      unitId: dto.unitId ?? null,
    };

    const user = this.usersRepository.create(payload);
    return this.usersRepository.save(user);
  }

  async findByName(name: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { nama: name } });
  }

  /**
   * Returns:
   *   { user } if success
   *   { error: 'not_found' } if user not found
   *   { error: 'wrong_password' } if password mismatch
   */
  async validateCredentials(identifier: string, password: string): Promise<{ user?: User; error?: string }> {
    // try by email
    let user = await this.findByEmail(identifier);
    // try by id
    if (!user && !isNaN(Number(identifier))) {
      user = await this.findOne(Number(identifier));
    }
    // try by nama
    if (!user) {
      user = await this.findByName(identifier);
    }

    if (!user) return { error: 'not_found' };

    // Allow login with either bcrypt or plaintext password (for legacy users)
    let match = false;
    if (user.password.startsWith('$2')) {
      // bcrypt hash
      match = await bcrypt.compare(password, user.password);
    } else {
      // plaintext fallback
      match = password === user.password;
    }
    if (!match) return { error: 'wrong_password' };
    return { user };
  }

  /**
   * Update user by id. Maps `nama` -> `name` if provided.
   */
  async update(id: number, dto: UpdateUserDto): Promise<User | null> {
    const payload: Partial<User> = {};
    if (dto.nama) payload.nama = dto.nama;
    if (dto.email) payload.email = dto.email;
    if (dto.password) payload.password = await bcrypt.hash(dto.password, 10);
    if (dto.role !== undefined) payload.role = dto.role;
    if (dto.unitId !== undefined) payload.unitId = dto.unitId ?? null;

    await this.usersRepository.update(id, payload);
    return (await this.findOne(id)) as User | null;
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }
}
