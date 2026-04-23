import { DataSource } from 'typeorm';
import { Unit } from './src/unit/unit.entity';
import { User } from './src/users/user.entity';
import { Indikator } from './src/indikator/indikator.entity';
import { BaselineData } from './src/baseline_data/baseline_data.entity';
import { Target } from './src/target/target.entity';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'iku_pk',
  entities: [Unit, User, Indikator, BaselineData, Target],
  synchronize: false,
});

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

  const unitRepo = AppDataSource.getRepository(Unit);
  const userRepo = AppDataSource.getRepository(User);
  const indikatorRepo = AppDataSource.getRepository(Indikator);
  const baselineRepo = AppDataSource.getRepository(BaselineData);
  const targetRepo = AppDataSource.getRepository(Target);

  // 1. Seed Units (Upsert by ID)
  console.log('Seeding Units...');
  await unitRepo.save([
    { id: 1, nama: 'Fakultas Ilmu Komputer', jenis: 'Fakultas', parentId: null },
    { id: 2, nama: 'S1 Sistem Informasi', jenis: 'Prodi', parentId: 1 },
    { id: 3, nama: 'S1 Informatika', jenis: 'Prodi', parentId: 1 },
    { id: 4, nama: 'S1 Data Science', jenis: 'Prodi', parentId: 1 },
  ]);

  // 2. Seed Users (Upsert by NIP)
  console.log('Seeding Users...');
  const salt = await bcrypt.genSalt();
  const defaultPassword = await bcrypt.hash('admin123', salt);

  const userData = [
    { nip: '111', nama: 'Super Admin', email: 'admin@iku.ac.id', password: '000000', role: 'superadmin', jenis: 'Tendik', unitId: 1 },
    { nip: '222', nama: 'Admin FIK', email: 'admin.fik@iku.ac.id', password: '000000', role: 'admin', jenis: 'Tendik', unitId: 1 },
    { nip: '333', nama: 'Wadek FIK', email: 'wadek@example.com', password: '000000', role: 'pimpinan', jenis: 'Dosen', unitId: 1 },
    { nip: '444', nama: 'Kaprodi SI', email: 'kaprodi.fik@iku.ac.id', password: '000000', role: 'kaprodi', jenis: 'Dosen', unitId: 2 },
  ];

  for (const u of userData) {
    let existing = await userRepo.findOne({ where: { nip: u.nip } });
    if (existing) {
      Object.assign(existing, u);
      await userRepo.save(existing);
    } else {
      await userRepo.save(userRepo.create(u));
    }
  }

  // 3. Seed Indicators (Hierarchy from Image)
  console.log('Seeding Indicators from Image...');
  const jenis = 'IKU';

  // Level 0
  const l0 = await findOrCreateIndikator(indikatorRepo, {
    jenis, kode: '1', nama: 'Meningkatnya kualitas lulusan pendidikan tinggi', level: 0, parentId: null
  });

  // Level 1: 1.1
  const l1_1 = await findOrCreateIndikator(indikatorRepo, {
    jenis, kode: '1.1', nama: 'Mendapat pekerjaan', level: 1, parentId: l0.id
  });

  // Level 2 for 1.1
  const sub1_1 = [
    { kode: '1.1.1', nama: '- < 6 Bulan dan >1,2 UMP' },
    { kode: '1.1.2', nama: '- 7 s.d 12 Bulan dan >1,2 UMP' },
    { kode: '1.1.3', nama: '- < 6 Bulan dan < 1,2 UMP' },
    { kode: '1.1.4', nama: '- 7 s.d 12 Bulan dan <1,2 UMP' },
  ];
  for (const s of sub1_1) {
    await findOrCreateIndikator(indikatorRepo, { jenis, kode: s.kode, nama: s.nama, level: 2, parentId: l1_1.id });
  }

  // Level 1: 1.2
  const l1_2 = await findOrCreateIndikator(indikatorRepo, {
    jenis, kode: '1.2', nama: 'Melanjutkan studi', level: 1, parentId: l0.id
  });
  await findOrCreateIndikator(indikatorRepo, { jenis, kode: '1.2.1', nama: 'Melanjutkan studi', level: 2, parentId: l1_2.id });

  // Level 1: 1.3
  const l1_3 = await findOrCreateIndikator(indikatorRepo, {
    jenis, kode: '1.3', nama: 'Menjadi wiraswasta', level: 1, parentId: l0.id
  });
  const sub1_3 = [
    { kode: '1.3.1', nama: '- < 6 Bulan dan >1,2 UMP' },
    { kode: '1.3.2', nama: '- 7 s.d 12 Bulan dan >1,2 UMP' },
    { kode: '1.3.3', nama: '- < 6 Bulan dan < 1,2 UMP' },
    { kode: '1.3.4', nama: '- 7 s.d 12 Bulan dan <1,2 UMP' },
  ];
  for (const s of sub1_3) {
    await findOrCreateIndikator(indikatorRepo, { jenis, kode: s.kode, nama: s.nama, level: 2, parentId: l1_3.id });
  }

  console.log('Seeding completed successfully (No data was deleted)!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
