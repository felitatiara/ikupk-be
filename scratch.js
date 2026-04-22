const { DataSource } = require("typeorm");

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'ikupk',
});

async function run() {
  await AppDataSource.initialize();
  const res = await AppDataSource.query(`SELECT * FROM users`);
  console.log(res);
  process.exit(0);
}
run();
