import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoleFeaturePermission } from './role-feature-permission.entity';

@Injectable()
export class RoleFeaturePermissionService {
  constructor(
    @InjectRepository(RoleFeaturePermission)
    private readonly repo: Repository<RoleFeaturePermission>,
  ) {}

  findAll(): Promise<RoleFeaturePermission[]> {
    return this.repo.find({ relations: ['role'] });
  }

  findForRole(roleId: number): Promise<RoleFeaturePermission[]> {
    return this.repo.find({ where: { roleId }, relations: ['role'] });
  }

  async getFeatureKeysForRole(roleId: number): Promise<string[]> {
    const perms = await this.repo.find({ where: { roleId } });
    return perms.map((p) => p.featureKey);
  }

  async setFeaturesForRole(roleId: number, featureKeys: string[]): Promise<RoleFeaturePermission[]> {
    await this.repo.delete({ roleId });
    if (featureKeys.length === 0) return [];
    const entities = featureKeys.map((featureKey) =>
      this.repo.create({ roleId, featureKey }),
    );
    return this.repo.save(entities);
  }
}
