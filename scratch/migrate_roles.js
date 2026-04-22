const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'iku_pk',
    password: '301004',
    port: 5432,
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // 1. Update status in target table
    const resTarget = await client.query("UPDATE target SET status = 'pending_pimpinan' WHERE status = 'pending_dekan'");
    console.log(`Updated ${resTarget.rowCount} rows in target table (status pending_dekan -> pending_pimpinan)`);

    // 2. Update role in users table (just in case they are stored as 'dekan' or 'Pimpinan')
    // We should be careful with case sensitivity in DB strings.
    const resUsers = await client.query("UPDATE users SET role = 'pimpinan' WHERE LOWER(role) = 'dekan' OR LOWER(role) = 'pimpinan'");
    console.log(`Updated ${resUsers.rowCount} rows in users table (role dekan/pimpinan -> pimpinan)`);

    console.log('Migration completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

migrate();
