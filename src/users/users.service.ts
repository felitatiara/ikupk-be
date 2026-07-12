import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { User } from './user.entity';
import { UserRelation } from './user_relation.entity';
import { Role } from '../roles/role.entity';
import { UserRole } from '../roles/user-role.entity';
import { RoleViewPermission } from '../roles/role-view-permission.entity';
import { RoleFeaturePermission } from '../roles/role-feature-permission.entity';
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
    @InjectRepository(RoleViewPermission)
    private roleViewPermRepo: Repository<RoleViewPermission>,
    @InjectRepository(RoleFeaturePermission)
    private roleFeaturePermRepo: Repository<RoleFeaturePermission>,
  ) {}

  async findAll(): Promise<any[]> {
    const users = await this.usersRepository.find({
      relations: ['userRoles', 'userRoles.role'],
      order: { nama: 'ASC' },
    });

    const relations = await this.userRelationRepo.find({
      relations: ['parent'],
    });
    const atasanMap = new Map<number, UserRelation[]>();
    for (const r of relations) {
      if (!atasanMap.has(r.userId)) atasanMap.set(r.userId, []);
      atasanMap.get(r.userId)!.push(r);
    }

    return users.map((u) => {
      const primaryRole = u.userRoles?.find((ur) => ur.isPrimary) ?? u.userRoles?.[0];
      const seniorRole = [...(u.userRoles ?? [])].sort((a, b) => (a.role?.level ?? 99) - (b.role?.level ?? 99))[0] ?? primaryRole;
      const atasanRels = atasanMap.get(u.id) ?? [];
      return {
        id: u.id,
        nip: u.nip,
        nama: u.nama,
        email: u.email,
        jenis: u.jenis,
        role: seniorRole?.role?.name ?? '',
        roleId: primaryRole?.roleId ?? null,
        roleLevel: seniorRole?.role?.level ?? null,
        unitNama: primaryRole?.role?.unitNama ?? null,
        atasanId: atasanRels[0]?.parentId ?? null,
        atasanNama: atasanRels[0]?.parent?.nama ?? null,
        atasanIds: atasanRels.map((r) => r.parentId),
        atasanNamas: atasanRels.map((r) => r.parent?.nama ?? ''),
        userRoles: (u.userRoles ?? []).map((ur) => ({
          id: ur.id,
          roleId: ur.roleId,
          isPrimary: ur.isPrimary,
          role: ur.role
            ? { id: ur.role.id, name: ur.role.name, unitNama: ur.role.unitNama, level: ur.role.level }
            : null,
        })),
      };
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
      nip: dto.nip ?? null,
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

    // Assign atasan relations (atasanIds takes priority over atasanId)
    const atasanIdList = dto.atasanIds?.length ? dto.atasanIds : (dto.atasanId ? [dto.atasanId] : []);
    for (const pid of atasanIdList) {
      await this.userRelationRepo
        .createQueryBuilder()
        .insert()
        .into(UserRelation)
        .values({ userId: savedUser.id, parentId: pid })
        .orIgnore()
        .execute();
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

    // Update extra roles jika dikirim
    if (dto.extraRoleIds !== undefined) {
      await this.userRoleRepo.delete({ userId: id, isPrimary: false });
      for (const rid of dto.extraRoleIds) {
        const exists = await this.userRoleRepo.findOne({ where: { userId: id, roleId: rid } });
        if (!exists) {
          await this.userRoleRepo.save(
            this.userRoleRepo.create({ userId: id, roleId: rid, isPrimary: false }),
          );
        }
      }
    }

    // Update atasan relations (atasanIds takes priority over atasanId)
    if (dto.atasanIds !== undefined || dto.atasanId !== undefined) {
      await this.userRelationRepo
        .createQueryBuilder()
        .delete()
        .from(UserRelation)
        .where('"user_id" = :userId', { userId: id })
        .execute();
      const atasanIdList = dto.atasanIds?.length ? dto.atasanIds : (dto.atasanId ? [dto.atasanId] : []);
      console.log(`[users.service] update user ${id}: saving atasanIds=${JSON.stringify(atasanIdList)}`);
      for (const pid of atasanIdList) {
        await this.userRelationRepo
          .createQueryBuilder()
          .insert()
          .into(UserRelation)
          .values({ userId: id, parentId: pid })
          .orIgnore()
          .execute();
      }
    }

    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.usersRepository.delete(id);
  }

  private mapUserDto(user: User): any {
    const primaryRole = user.userRoles?.find((ur) => ur.isPrimary) ?? user.userRoles?.[0];
    return {
      id: user.id,
      nip: user.nip,
      nama: user.nama,
      email: user.email,
      jenis: user.jenis,
      role: primaryRole?.role?.name ?? '',
      roleId: primaryRole?.roleId ?? null,
      roleLevel: primaryRole?.role?.level ?? null,
      unitNama: primaryRole?.role?.unitNama ?? null,
    };
  }

  async findByRole(roleId: number): Promise<any[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { roleId },
      relations: ['user', 'user.userRoles', 'user.userRoles.role'],
    });
    return userRoles
      .map((ur) => ur.user)
      .filter(Boolean)
      .map((u) => this.mapUserDto(u));
  }

  async findRelatedUsersFor(userId: number): Promise<any[]> {
    const rels = await this.userRelationRepo
      .createQueryBuilder('ur')
      .select('ur.user_id', 'userid')
      .where('ur.parent_id = :parentId', { parentId: userId })
      .getRawMany<{ userid: string }>();
    if (rels.length === 0) return [];
    const userIds = rels.map((r) => Number(r.userid));
    const users = await this.usersRepository.find({
      where: { id: In(userIds) },
      relations: ['userRoles', 'userRoles.role'],
    });
    return users.map((u) => this.mapUserDto(u));
  }

  async hasRelatedUsers(userId: number): Promise<boolean> {
    const count = await this.userRelationRepo.count({ where: { parentId: userId } });
    return count > 0;
  }

  async debugRelations(parentId: number): Promise<any[]> {
    const rels = await this.userRelationRepo.find({
      where: { parentId },
    });
    return rels.map(r => ({ id: r.id, userId: r.userId, parentId: r.parentId }));
  }

  async findAllBawahanFor(userId: number): Promise<any[]> {
    const result = new Map<number, any>();
    const queue = [userId];
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const rels = await this.userRelationRepo
        .createQueryBuilder('ur')
        .select('ur.user_id', 'userid')
        .where('ur.parent_id = :parentId', { parentId: currentId })
        .getRawMany<{ userid: string }>();
      const childIds = rels.map((r) => Number(r.userid)).filter((id) => !result.has(id) && id !== userId);
      if (childIds.length === 0) continue;
      const users = await this.usersRepository.find({
        where: { id: In(childIds) },
        relations: ['userRoles', 'userRoles.role'],
      });
      for (const u of users) {
        if (!result.has(u.id)) {
          result.set(u.id, this.mapUserDto(u));
          queue.push(u.id);
        }
      }
    }
    return [...result.values()];
  }

  async findByRoleLevel(level: number): Promise<any[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { isPrimary: true, role: { level } },
      relations: ['user', 'user.userRoles', 'user.userRoles.role', 'role'],
    });
    const seen = new Set<number>();
    const result: any[] = [];
    for (const ur of userRoles) {
      if (ur.user && !seen.has(ur.user.id)) {
        seen.add(ur.user.id);
        result.push(this.mapUserDto(ur.user));
      }
    }
    return result;
  }

  async findDosenByUnit(unitNama: string): Promise<any[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { role: { name: 'Dosen', unitNama } },
      relations: ['user', 'user.userRoles', 'user.userRoles.role', 'role'],
    });
    const seen = new Set<number>();
    const result: any[] = [];
    for (const ur of userRoles) {
      if (ur.user && !seen.has(ur.user.id)) {
        seen.add(ur.user.id);
        result.push(this.mapUserDto(ur.user));
      }
    }
    return result;
  }

  async createRole(dto: { name: string; unitNama: string; level: number }): Promise<Role> {
    const role = this.roleRepo.create({ name: dto.name, unitNama: dto.unitNama, level: dto.level });
    return this.roleRepo.save(role);
  }

  async updateRole(id: number, dto: { name?: string; unitNama?: string; level?: number }): Promise<Role | null> {
    await this.roleRepo.update(id, dto);
    return this.roleRepo.findOne({ where: { id } });
  }

  async deleteRole(id: number): Promise<{ deleted: boolean; reason?: string }> {
    const count = await this.userRoleRepo.count({ where: { roleId: id } });
    if (count > 0) return { deleted: false, reason: `Role masih digunakan oleh ${count} pengguna` };
    await this.roleViewPermRepo.delete({ viewerRoleId: id });
    await this.roleViewPermRepo.delete({ viewableRoleId: id });
    await this.roleFeaturePermRepo.delete({ roleId: id });
    await this.roleRepo.delete(id);
    return { deleted: true };
  }

  async findAllDosen(): Promise<any[]> {
    const userRoles = await this.userRoleRepo.find({
      where: { role: { name: 'Dosen' } },
      relations: ['user', 'user.userRoles', 'user.userRoles.role', 'role'],
    });
    const seen = new Set<number>();
    const result: any[] = [];
    for (const ur of userRoles) {
      if (ur.user && !seen.has(ur.user.id)) {
        seen.add(ur.user.id);
        result.push(this.mapUserDto(ur.user));
      }
    }
    return result;
  }
}
