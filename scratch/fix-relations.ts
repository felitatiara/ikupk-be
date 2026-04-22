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

async function fixRelations() {
  await AppDataSource.initialize();

  console.log('Synchronizing units...');
  // Ensure Informatika unit exists
  await AppDataSource.query(`
    INSERT INTO unit (id, nama, jenis, parent_id) 
    VALUES (3, 'S1 Informatika', 'Prodi', 1)
    ON CONFLICT (id) DO UPDATE SET nama = EXCLUDED.nama, jenis = EXCLUDED.jenis, parent_id = EXCLUDED.parent_id
  `);

  console.log('Assigning users to units...');
  // Ridwan (6) -> Unit 3 (Informatika)
  await AppDataSource.query('UPDATE users SET unit_id = 3 WHERE id = 6');
  // Anita (5) -> Unit 1 (Fakultas)
  await AppDataSource.query('UPDATE users SET unit_id = 1 WHERE id = 5');

  console.log('Cleaning up user_relations via raw query...');
  await AppDataSource.query('TRUNCATE TABLE user_relations RESTART IDENTITY CASCADE');

  const relations = [
    { u: 2, p: 1 }, // Erly reports to Supriyanto
    { u: 3, p: 1 }, // Bambang reports to Supriyanto
    { u: 4, p: 1 }, // Ati reports to Supriyanto
    { u: 5, p: 2 }, // Anita reports to Erly (Wadek 1)
    { u: 6, p: 5 }, // Ridwan reports to Anita (Kajur)
  ];

  for (const r of relations) {
    await AppDataSource.query(
      'INSERT INTO user_relations (user_id, parent_id) VALUES ($1, $2)',
      [r.u, r.p]
    );
    console.log(`Created relation: User ${r.u} reports to Parent ${r.p}`);
  }

  console.log('Data synchronization completed successfully.');
  await AppDataSource.destroy();
}

fixRelations().catch((e) => {
  console.error(e);
  process.exit(1);
});
