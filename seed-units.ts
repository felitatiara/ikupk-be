import { DataSource } from 'typeorm';
import { Unit } from './src/unit/unit.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ikupk',
  entities: [Unit],
  synchronize: false,
});

async function seedUnits() {
  await AppDataSource.initialize();
  const unitRepo = AppDataSource.getRepository(Unit);

  // Clear existing data (optional, for idempotency)
  await unitRepo.clear();

  // Insert units as per the provided table

  // Insert Fakultas Ilmu Komputer
  const fakultas = unitRepo.create({
    id: 1,
    nama: 'Fakultas Ilmu Komputer',
    jenis: 'Fakultas',
    parentId: null,
  });
  await unitRepo.save(fakultas);

  // Insert Biro PKU
  const biro = unitRepo.create({
    id: 6,
    nama: 'Biro PKU',
    jenis: 'Biro',
    parentId: null,
  });
  await unitRepo.save(biro);

  // Insert Prodi (anak dari Fakultas Ilmu Komputer)
  const prodis = [
    { id: 2, nama: 'S1 Sistem Informasi' },
    { id: 3, nama: 'S1 Informatika' },
    { id: 4, nama: 'S1 Data Science' },
    { id: 5, nama: 'D3 Sistem Informasi' },
  ].map((prodi) =>
    unitRepo.create({
      id: prodi.id,
      nama: prodi.nama,
      jenis: 'Prodi',
      parentId: 1,
    })
  );
  await unitRepo.save(prodis);

  console.log('Unit seeding completed.');
  await AppDataSource.destroy();
}

seedUnits().catch((e) => {
  console.error(e);
  process.exit(1);
});
