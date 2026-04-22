const { Client } = require('pg');

async function checkData() {
  const client = new Client({
    connectionString: "postgresql://postgres:301004@localhost:5432/iku_pk"
  });

  try {
    await client.connect();
    console.log("Connected to DB");

    const indikators = await client.query("SELECT id, kode, nama, level, jenis FROM indikator WHERE level = 0 LIMIT 5");
    console.log("Root Indikators:", indikators.rows);

    const targets = await client.query("SELECT * FROM target LIMIT 10");
    console.log("Targets:", targets.rows);

    const users = await client.query("SELECT id, username, role, \"unitId\" FROM users LIMIT 5");
    console.log("Users:", users.rows);

  } catch (err) {
    console.error("DB Error:", err.message);
  } finally {
    await client.end();
  }
}

checkData();
