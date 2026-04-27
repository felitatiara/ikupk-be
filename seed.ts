import { DataSource } from 'typeorm';
import { User } from './src/users/user.entity';
import { Role } from './src/roles/role.entity';
import { UserRole } from './src/roles/user-role.entity';
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
  entities: [User, Role, UserRole, Indikator, BaselineData, TargetUniversitas],
  synchronize: false,
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
  console.log('Starting safe seeding (Upsert mode)...');
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRoleRepo = AppDataSource.getRepository(UserRole);
  const indikatorRepo = AppDataSource.getRepository(Indikator);
  const baselineRepo = AppDataSource.getRepository(BaselineData);
  const targetRepo = AppDataSource.getRepository(TargetUniversitas);

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

  // alias untuk kompatibilitas seed user lama
  const pimpinanRole   = dekanRole;
  const kaprodiRole    = kaprodiSIRole;
  const dosenRole      = dosenFIKRole;

  // 2. Seed Users (password disimpan plain, login pakai plain comparison)
  console.log('Seeding Users...');
  const superadminUser = await upsertUser(userRepo, { nip: '111', nama: 'Super Admin',  email: 'admin@iku.ac.id',       password: '000000', jenis: 'Tendik' });
  const adminUser      = await upsertUser(userRepo, { nip: '222', nama: 'Admin FIK',    email: 'admin.fik@iku.ac.id',   password: '000000', jenis: 'Tendik' });
  const pimpinanUser   = await upsertUser(userRepo, { nip: '333', nama: 'Wadek FIK',    email: 'wadek@example.com',     password: '000000', jenis: 'Dosen'  });
  const kaprodiUser    = await upsertUser(userRepo, { nip: '444', nama: 'Kaprodi SI',   email: 'kaprodi.fik@iku.ac.id', password: '000000', jenis: 'Dosen'  });

  // 3. Seed UserRoles (mapping user ke role, set isPrimary = true)
  console.log('Seeding UserRoles...');
  await upsertUserRole(userRoleRepo, { userId: superadminUser.id, roleId: superadminRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: adminUser.id,      roleId: adminRole.id,      isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: pimpinanUser.id,   roleId: pimpinanRole.id,   isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: kaprodiUser.id,    roleId: kaprodiRole.id,    isPrimary: true });


  console.log('Seeding completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
