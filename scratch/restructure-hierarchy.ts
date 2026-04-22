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

async function restructure() {
  await AppDataSource.initialize();

  console.log('Upserting Widya Cholil as Kajur...');
  const widyaResult = await AppDataSource.query(`
    INSERT INTO users (nip, nama, email, password, unit_id, jenis, role) 
    VALUES ('123477', 'Widya Cholil', 'widya@gmail.com', '12345', 1, 'Dosen', 'Kajur')
    ON CONFLICT (email) DO UPDATE SET role = 'Kajur', nama = 'Widya Cholil'
    RETURNING id
  `);
  const widyaId = widyaResult[0].id;

  console.log('Updating Anita Muliawati as Kaprodi...');
  await AppDataSource.query("UPDATE users SET role = 'Kaprodi', unit_id = 1 WHERE id = 5");

  console.log('Cleaning up and rebuilding user_relations...');
  await AppDataSource.query('TRUNCATE TABLE user_relations RESTART IDENTITY CASCADE');

  // Hierarchy Flow:
  // 1. Pimpinan/Wadeks (1,2,3,4) -> Boss of Widya (Kajur)
  // 2. Widya (Kajur) -> Boss of Anita (5) (Kaprodi)
  // 3. Anita (Kaprodi) -> Boss of Bambang (3) (As Dosen)

  const relations = [
    { u: widyaId, p: 1 }, // Widya reports to Supriyanto
    { u: widyaId, p: 2 }, // Widya reports to Erly
    { u: widyaId, p: 3 }, // Widya reports to Bambang (Pimpinan)
    { u: widyaId, p: 4 }, // Widya reports to Ati
    { u: 5, p: widyaId }, // Anita (Kaprodi) reports to Widya (Kajur)
    { u: 3, p: 5 },       // Bambang (Dosen) reports to Anita (Kaprodi)
    { u: 6, p: 5 },       // Ridwan also reports to Anita
  ];

  for (const r of relations) {
    await AppDataSource.query(
      'INSERT INTO user_relations (user_id, parent_id) VALUES ($1, $2)',
      [r.u, r.p]
    );
    console.log(`Created relation: User ${r.u} reports to Parent ${r.p}`);
  }

  console.log('Restructure completed successfully.');
  await AppDataSource.destroy();
}

restructure().catch((e) => {
  console.error(e);
  process.exit(1);
});
