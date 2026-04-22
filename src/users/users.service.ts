import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';
import { Unit } from '../unit/unit.entity';
import { UserRelation } from './user_relation.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Unit)
    private unitRepository: Repository<Unit>,
    @InjectRepository(UserRelation)
    private userRelationRepo: Repository<UserRelation>,
  ) {}

  findAll(): Promise<User[]> {
    return this.usersRepository.find();
  }

  findOne(id: number): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email }, relations: ['unit'] });
  }

  findByNip(nip: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { nip }, relations: ['unit'] });
  }

  /**
   * Create a user.
   * Also creates a relationship in user_relations if atasanId is provided.
   */
  async create(dto: CreateUserDto): Promise<User> {
    const hashed = await bcrypt.hash(dto.password, 10);
    const payload: Partial<User> = {
      nip: dto.nip,
      nama: dto.nama,
      email: dto.email,
      password: hashed,
      role: dto.role,
      jenis: dto.jenis || "Dosen",
      unitId: dto.unitId ?? null,
    };

    const user = this.usersRepository.create(payload);
    const savedUser = await this.usersRepository.save(user);

    if (dto.atasanId) {
      const relation = this.userRelationRepo.create({
        userId: savedUser.id,
        parentId: dto.atasanId,
      });
      await this.userRelationRepo.save(relation);
    }

    return savedUser;
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
    // try by NIP
    if (!user) {
      user = await this.findByNip(identifier);
    }
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
   * Update user by id.
   * Also updates relationship in user_relations if atasanId is provided.
   */
  async update(id: number, dto: UpdateUserDto): Promise<User | null> {
    const payload: Partial<User> = {};
    if (dto.nip !== undefined) payload.nip = dto.nip ?? null;
    if (dto.nama) payload.nama = dto.nama;
    if (dto.email) payload.email = dto.email;
    if (dto.password) payload.password = await bcrypt.hash(dto.password, 10);
    if (dto.role !== undefined) payload.role = dto.role;
    if (dto.jenis !== undefined) payload.jenis = dto.jenis;
    if (dto.unitId !== undefined) payload.unitId = dto.unitId ?? null;

    await this.usersRepository.update(id, payload);

    if (dto.atasanId !== undefined) {
      // Remove old relations
      await this.userRelationRepo.delete({ userId: id });
      
      if (dto.atasanId !== null) {
        // Add new relation
        const relation = this.userRelationRepo.create({
          userId: id,
          parentId: dto.atasanId,
        });
        await this.userRelationRepo.save(relation);
      }
    }

    return (await this.findOne(id)) as User | null;
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  async findByUnit(unitId: number): Promise<User[]> {
    // Get child units (e.g. Prodi under Fakultas)
    const childUnits = await this.unitRepository.find({
      where: { parentId: unitId },
    });
    const unitIds = [unitId, ...childUnits.map((u) => u.id)];
    return this.usersRepository.find({
      where: { unitId: In(unitIds) },
      select: ['id', 'nip', 'nama', 'email', 'role'],
    });
  }

  /**
   * Mengambil daftar user yang berada DI BAWAH userId dalam hierarki user_relations.
   * Artinya: ambil semua user_relations di mana parent_id = userId,
   * lalu kembalikan data user-nya.
   */
  async findRelatedUsersFor(userId: number): Promise<User[]> {
    const relations = await this.userRelationRepo.find({
      where: { parentId: userId },
      relations: ['user'],
    });
    const userIds = relations.map((r) => r.user?.id).filter(Boolean) as number[];
    if (userIds.length === 0) return [];
    return this.usersRepository.find({
      where: { id: In(userIds) },
      select: ['id', 'nip', 'nama', 'email', 'role'],
    });
  }

  /**
   * Mengecek apakah user ini memiliki bawahan di user_relations.
   */
  async hasRelatedUsers(userId: number): Promise<boolean> {
    const count = await this.userRelationRepo.count({
      where: { parentId: userId },
    });
    return count > 0;
  }
}
