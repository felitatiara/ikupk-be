import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'iku_pk',
  synchronize: false,
});

async function updateUnits() {
  await AppDataSource.initialize();

  console.log('Updating units 4 and 5...');
  await AppDataSource.query(`
    INSERT INTO unit (id, nama, jenis, parent_id) 
    VALUES 
      (4, 'D3 Sistem Informasi', 'Prodi', 1),
      (5, 'S1 Data Science', 'Prodi', 1) 
    ON CONFLICT (id) DO UPDATE SET 
      nama = EXCLUDED.nama, 
      jenis = EXCLUDED.jenis, 
      parent_id = EXCLUDED.parent_id
  `);

  console.log('Units 4 and 5 updated successfully.');
  await AppDataSource.destroy();
}

updateUnits().catch((e) => {
  console.error(e);
  process.exit(1);
});
