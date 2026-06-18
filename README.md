Setup Backend 
Buat file .env di root folder ikupk-be:
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=isi_password_postgres_kamu
DATABASE_NAME=iku_pk
DATABASE_SYNCHRONIZE=true
DATABASE_LOGGING=true

JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=24h

REPOSITORY_BE_URL=http://localhost:3005
REPOSITORY_FE_URL=http://localhost:3000
SELF_URL=http://localhost:4000
INTEGRATION_SECRET=ikupk-integration-secret-2024

Run Seed ikupk-be
npm run seed

npm run start:dev

Setup Frontend
.env 
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000

npm run dev

Set up Akun 
Set up user
Role
Unit Kerja 
Atasan
Super Admin
Super admin - FIK
-
Admin FIK
Admin - FIK
-
Dekan
Dekan - FIK
-
Wakil Dekan 1
Wakil Dekan 1 - FIK (Primary) 
Dosen - Sistem Informasi (Secondary)
Prof. Dr. Ir. Supriyanto, S.T., M.Sc., IPM  (Dekan)
Anita Muliati, S.Kom., MTI  (Kaprodi)
Dr. Widya Cholil, M.I.T  (Kajur)
Wakil Dekan 2
Wakil Dekan 2 - FIK (Primary) 
Dosen - Sistem Informasi (Secondary)
Prof. Dr. Ir. Supriyanto, S.T., M.Sc., IPM  (Dekan)
Anita Muliati, S.Kom., MTI  (Kaprodi)
Dr. Widya Cholil, M.I.T  (Kajur)
Wakil Dekan 3
Wakil Dekan 3 - FIK (Primary) 
Dosen - Sistem Informasi (Secondary)
Prof. Dr. Ir. Supriyanto, S.T., M.Sc., IPM  (Dekan)
Anita Muliati, S.Kom., MTI  (Kaprodi)
Dr. Widya Cholil, M.I.T  (Kajur)
Kepala Jurusan
Kepala Jurusan - FIK
Dosen - S1 Informatika
Prof. Dr. Ir. Supriyanto, S.T., M.Sc., IPM  (Dekan)
Erly Krisnanik, S.Kom., MM. (Wakil Dekan 1) 
Dr. Bambang Saras Yuliastiawan, S.T., M.Kom. (Wakil Dekan 2) 
Ati Zaidiah, S.Kom., MTI. (Wakil Dekan 3) 
Dr. Ridwan Raafi'udin, S.Kom., M.Kom. (Koordinator Prodi)
Kepala Bagian
Kepala Bagian - FIK
Dr. Bambang Saras Yuliastiawan, S.T., M.Kom. (Wakil Dekan 2) 


Koordinator Program Studi
Koordinator Prodi - (Program Studi 
Erly Krisnanik, S.Kom., MM. (Wakil Dekan 1) 
Dr. Bambang Saras Yuliastiawan, S.T., M.Kom. (Wakil Dekan 2) 
Ati Zaidiah, S.Kom., MTI. (Wakil Dekan 3) 
Dr. Widya Cholil, M.I.T (Kepala Jurusan) 
Tendik
Tendik - FIK
Saimin, S.Kom (Kepala Bagian) 
Dosen
Dosen - (Prodi masing masing)
Dr. Widya Cholil, M.I.T (Kepala Jurusan) 
Koordinator Prodi Masing masing

Semua akun password defaultnya 000000.

