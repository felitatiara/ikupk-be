import { DataSource } from 'typeorm';
import { User } from './src/users/user.entity';
import { Role } from './src/roles/role.entity';
import { UserRole } from './src/roles/user-role.entity';
import { UserRelation } from './src/users/user_relation.entity';
import { Indikator } from './src/indikator/indikator.entity';
import { BaselineData } from './src/baseline_data/baseline_data.entity';
import { TargetUniversitas } from './src/target/target.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'iku_pk',
  entities: [User, Role, UserRole, UserRelation, Indikator, BaselineData, TargetUniversitas],
  synchronize: true,
});

async function upsertRole(repo: any, data: { name: string; unitNama: string; level: number }) {
  let existing = await repo.findOne({ where: { name: data.name, unitNama: data.unitNama } });
  if (existing) {
    existing.level = data.level;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function upsertUser(repo: any, data: { nip: string; nama: string; email: string; password: string; jenis: string }) {
  let existing = await repo.findOne({ where: { nip: data.nip } });
  if (existing) {
    existing.nama = data.nama;
    existing.email = data.email;
    existing.jenis = data.jenis;
    // Jangan timpa password jika sudah ada (agar tidak reset hash)
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function upsertUserRole(repo: any, data: { userId: number; roleId: number; isPrimary: boolean }) {
  let existing = await repo.findOne({ where: { userId: data.userId, roleId: data.roleId } });
  if (existing) {
    existing.isPrimary = data.isPrimary;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function findOrCreateIndikator(repo: any, data: { jenis: string; kode: string; nama: string; level: number; parentId: number | null; jenisData?: string | null }) {
  let existing = await repo.findOne({ where: { jenis: data.jenis, kode: data.kode } });
  if (existing) {
    existing.nama = data.nama;
    existing.level = data.level;
    existing.parentId = data.parentId;
    existing.jenisData = data.jenisData || null;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function seed() {
  console.log('Starting seed (schema reset mode)...');
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRoleRepo = AppDataSource.getRepository(UserRole);
  const userRelationRepo = AppDataSource.getRepository(UserRelation);
  const indikatorRepo = AppDataSource.getRepository(Indikator);
  const baselineRepo = AppDataSource.getRepository(BaselineData);
  const targetRepo = AppDataSource.getRepository(TargetUniversitas);

  async function upsertUserRelation(userId: number, parentId: number) {
    const existing = await userRelationRepo.findOne({ where: { userId, parentId } });
    if (existing) return existing;
    return userRelationRepo.save(userRelationRepo.create({ userId, parentId }));
  }

  // 1. Seed Roles
  console.log('Seeding Roles...');
  const superadminRole = await upsertRole(roleRepo, { name: 'SuperAdmin',       unitNama: 'FIK', level: 0 });
  const adminRole      = await upsertRole(roleRepo, { name: 'Admin',            unitNama: 'FIK', level: 0 });
  const dekanRole      = await upsertRole(roleRepo, { name: 'Dekan',            unitNama: 'FIK', level: 1 });
  const wd1Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 1',    unitNama: 'FIK', level: 1 });
  const wd2Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 2',    unitNama: 'FIK', level: 1 });
  const wd3Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 3',    unitNama: 'FIK', level: 1 });
  const kabagRole      = await upsertRole(roleRepo, { name: 'Kepala Bagian',    unitNama: 'FIK', level: 1 });
  const kajurSIRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Sistem Informasi', level: 2 });
  const kajurIFRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Informatika', level: 2 });
  const kajurDSRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Data Science', level: 2 });
  const kaprodiSIRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Sistem Informasi', level: 3 });
  const kaprodiIFRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Informatika', level: 3 });
  const kaprodiDSRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Data Science', level: 3 });
  const dosenFIKRole   = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'FIK', level: 4 });
  const dosenSIRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Sistem Informasi', level: 4 });
  const dosenIFRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Informatika', level: 4 });
  const dosenDSRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Data Science', level: 4 });
  const tendikRole     = await upsertRole(roleRepo, { name: 'Tendik',           unitNama: 'FIK', level: 4 });

  // 2. Seed Users
  console.log('Seeding Users...');
  // Level 0
  const superadminUser = await upsertUser(userRepo, { nip: '111', nama: 'Super Admin',     email: 'admin@iku.ac.id',        password: '000000', jenis: 'Tendik' });
  const adminUser      = await upsertUser(userRepo, { nip: '222', nama: 'Admin FIK',        email: 'admin.fik@iku.ac.id',    password: '000000', jenis: 'Tendik' });
  // Level 1 — Dekan & Wakil Dekan (juga Dosen FIK)
  const dekanUser      = await upsertUser(userRepo, { nip: '301', nama: 'Dekan FIK',        email: 'dekan@fik.ac.id',        password: '000000', jenis: 'Dosen'  });
  const wd1User        = await upsertUser(userRepo, { nip: '302', nama: 'Wakil Dekan 1',    email: 'wd1@fik.ac.id',          password: '000000', jenis: 'Dosen'  });
  const wd2User        = await upsertUser(userRepo, { nip: '303', nama: 'Wakil Dekan 2',    email: 'wd2@fik.ac.id',          password: '000000', jenis: 'Dosen'  });
  const wd3User        = await upsertUser(userRepo, { nip: '304', nama: 'Wakil Dekan 3',    email: 'wd3@fik.ac.id',          password: '000000', jenis: 'Dosen'  });
  // Level 2 — Kajur SI (juga Dosen SI)
  const kajurSIUser    = await upsertUser(userRepo, { nip: '401', nama: 'Kajur SI',         email: 'kajur.si@fik.ac.id',     password: '000000', jenis: 'Dosen'  });
  const kajurIFUser    = await upsertUser(userRepo, { nip: '402', nama: 'Kajur Informatika', email: 'kajur.if@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  // Level 3 — Kaprodi (juga Dosen)
  const kaprodiUser    = await upsertUser(userRepo, { nip: '444', nama: 'Kaprodi SI',       email: 'kaprodi.fik@iku.ac.id',  password: '000000', jenis: 'Dosen'  });
  const kaprodiIFUser  = await upsertUser(userRepo, { nip: '501', nama: 'Kaprodi Informatika', email: 'kaprodi.if@fik.ac.id', password: '000000', jenis: 'Dosen' });
  // Level 4 — Dosen & Tendik
  const dosen1User     = await upsertUser(userRepo, { nip: '601', nama: 'Dosen SI 1',       email: 'dosen1.si@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const dosen2User     = await upsertUser(userRepo, { nip: '602', nama: 'Dosen SI 2',       email: 'dosen2.si@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const dosen3User     = await upsertUser(userRepo, { nip: '603', nama: 'Dosen IF 1',       email: 'dosen1.if@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const tendikUser     = await upsertUser(userRepo, { nip: '701', nama: 'Tendik FIK',       email: 'tendik@fik.ac.id',       password: '000000', jenis: 'Tendik' });

  // 3. Seed UserRoles
  console.log('Seeding UserRoles...');
  // Level 0
  await upsertUserRole(userRoleRepo, { userId: superadminUser.id, roleId: superadminRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: adminUser.id,      roleId: adminRole.id,      isPrimary: true });
  // Level 1 — primary structural + extra Dosen FIK
  await upsertUserRole(userRoleRepo, { userId: dekanUser.id,   roleId: dekanRole.id,   isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: dekanUser.id,   roleId: dosenSIRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd1User.id,     roleId: wd1Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd1User.id,     roleId: dosenSIRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd2User.id,     roleId: wd2Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd2User.id,     roleId: dosenSIRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd3User.id,     roleId: wd3Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd3User.id,     roleId: dosenSIRole.id, isPrimary: false });
  // Level 2 — primary Kajur + extra Dosen
  await upsertUserRole(userRoleRepo, { userId: kajurSIUser.id,  roleId: kajurSIRole.id,  isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kajurSIUser.id,  roleId: dosenSIRole.id,  isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kajurIFUser.id,  roleId: kajurIFRole.id,  isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kajurIFUser.id,  roleId: dosenIFRole.id,  isPrimary: false });
  // Level 3 — primary Kaprodi + extra Dosen
  await upsertUserRole(userRoleRepo, { userId: kaprodiUser.id,   roleId: kaprodiSIRole.id, isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiUser.id,   roleId: dosenSIRole.id,   isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kaprodiIFUser.id, roleId: kaprodiIFRole.id, isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiIFUser.id, roleId: dosenIFRole.id,   isPrimary: false });
  // Level 4 — Dosen & Tendik
  await upsertUserRole(userRoleRepo, { userId: dosen1User.id, roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: dosen2User.id, roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: dosen3User.id, roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: tendikUser.id, roleId: tendikRole.id,  isPrimary: true });

  // 4. Seed UserRelations (hierarki disposisi)
  console.log('Seeding UserRelations...');
  // Wd1 → Dekan (Dekan adalah atasan WD)
  await upsertUserRelation(wd1User.id, dekanUser.id);
  await upsertUserRelation(wd2User.id, dekanUser.id);
  await upsertUserRelation(wd3User.id, dekanUser.id);
  // Kajur → WD1 (WD1 bertanggung jawab atas jurusan)
  await upsertUserRelation(kajurSIUser.id, wd1User.id);
  await upsertUserRelation(kajurIFUser.id, wd1User.id);
  // Kaprodi → Kajur
  await upsertUserRelation(kaprodiUser.id,   kajurSIUser.id);
  await upsertUserRelation(kaprodiIFUser.id, kajurIFUser.id);
  // Dosen → Kaprodi
  await upsertUserRelation(dosen1User.id, kaprodiUser.id);
  await upsertUserRelation(dosen2User.id, kaprodiUser.id);
  await upsertUserRelation(dosen3User.id, kaprodiIFUser.id);
  // Tendik → Kabag (tidak ada kabag user di seed ini, skip)

  console.log('Seeding completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
