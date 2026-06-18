1. Setup Backend 

Buat file .env di root folder ikupk-be:

DATABASE_HOST=localhost

DATABASE_PORT=5432

DATABASE_USERNAME=postgres

DATABASE_PASSWORD=password

DATABASE_NAME=iku_pk

DATABASE_SYNCHRONIZE=true

DATABASE_LOGGING=true

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

REPOSITORY_BE_URL=http://localhost:3005
REPOSITORY_FE_URL=http://localhost:3000
SELF_URL=http://localhost:4000
INTEGRATION_SECRET=ikupk-integration-secret-2024

2. Run Seed ikupk-be
npm run seed

3. npm run start:dev

1. Setup Frontend
.env 
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

npm run dev

