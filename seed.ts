import { DataSource } from 'typeorm';
import { User } from './src/users/user.entity';
import { Role } from './src/roles/role.entity';
import { UserRole } from './src/roles/user-role.entity';
import { UserRelation } from './src/users/user_relation.entity';
import { Indikator } from './src/indikator/indikator.entity';
import { BaselineData } from './src/baseline_data/baseline_data.entity';
import { TargetUniversitas } from './src/target/target.entity';
import { TargetUnit } from './src/target/target-unit.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'iku_pk',
  entities: [User, Role, UserRole, UserRelation, Indikator, BaselineData, TargetUniversitas, TargetUnit],
  synchronize: true,
});

async function upsertRole(repo: any, data: { name: string; unitNama: string; level: number }) {
  let existing = await repo.findOne({ where: { name: data.name, unitNama: data.unitNama } });
  if (existing) {
    existing.level = data.level;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function upsertUser(repo: any, data: { nip: string; nama: string; email: string; password: string; jenis: string }) {
  // Email adalah identifier utama (unique); cari by email dulu, fallback ke NIP
  let existing = await repo.findOne({ where: { email: data.email } });
  if (!existing) existing = await repo.findOne({ where: { nip: data.nip } });
  if (existing) {
    existing.nip = data.nip;
    existing.nama = data.nama;
    existing.email = data.email;
    existing.jenis = data.jenis;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function upsertUserRole(repo: any, data: { userId: number; roleId: number; isPrimary: boolean }) {
  let existing = await repo.findOne({ where: { userId: data.userId, roleId: data.roleId } });
  if (existing) {
    existing.isPrimary = data.isPrimary;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function findOrCreateIndikator(repo: any, data: { jenis: string; kode: string; nama: string; tahun: string; level: number; parentId: number | null; jenisData?: string | null; sumberData?: string; kategori?: string | null }) {
  let existing = await repo.findOne({ where: { jenis: data.jenis, kode: data.kode, tahun: data.tahun } });
  if (existing) {
    existing.nama = data.nama;
    existing.level = data.level;
    existing.parentId = data.parentId;
    existing.jenisData = data.jenisData ?? null;
    if (data.sumberData) existing.sumberData = data.sumberData;
    if (data.kategori !== undefined) existing.kategori = data.kategori;
    return await repo.save(existing);
  }
  return await repo.save(repo.create({ ...data, jenisData: data.jenisData ?? null, sumberData: data.sumberData ?? 'ikupk', kategori: data.kategori ?? null }));
}

async function seed() {
  console.log('Starting seed (schema reset mode)...');
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRoleRepo = AppDataSource.getRepository(UserRole);
  const userRelationRepo = AppDataSource.getRepository(UserRelation);
  const indikatorRepo = AppDataSource.getRepository(Indikator);
  const targetRepo = AppDataSource.getRepository(TargetUniversitas);

  async function upsertUserRelation(userId: number, parentId: number) {
    const existing = await userRelationRepo.findOne({ where: { userId, parentId } });
    if (existing) return existing;
    return userRelationRepo.save(userRelationRepo.create({ userId, parentId }));
  }

  // 1. Seed Roles
  console.log('Seeding Roles...');
  const superadminRole = await upsertRole(roleRepo, { name: 'SuperAdmin',       unitNama: 'FIK', level: 0 });
  const adminRole      = await upsertRole(roleRepo, { name: 'Admin',            unitNama: 'FIK', level: 0 });
  const dekanRole      = await upsertRole(roleRepo, { name: 'Dekan',            unitNama: 'FIK', level: 1 });
  const wd1Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 1',    unitNama: 'FIK', level: 1 });
  const wd2Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 2',    unitNama: 'FIK', level: 1 });
  const wd3Role        = await upsertRole(roleRepo, { name: 'Wakil Dekan 3',    unitNama: 'FIK', level: 1 });
  const kabagRole      = await upsertRole(roleRepo, { name: 'Kepala Bagian',    unitNama: 'FIK', level: 1 });
  const kajurSIRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Sistem Informasi', level: 2 });
  const kajurIFRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Informatika', level: 2 });
  const kajurDSRole    = await upsertRole(roleRepo, { name: 'Kepala Jurusan',   unitNama: 'S1 Data Science', level: 2 });
  const kaprodiSIRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Sistem Informasi', level: 3 });
  const kaprodiIFRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Informatika', level: 3 });
  const kaprodiDSRole    = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'S1 Data Science',     level: 3 });
  const kaprodiD3SIRole  = await upsertRole(roleRepo, { name: 'Koordinator Prodi', unitNama: 'D3 Sistem Informasi', level: 3 });
  const dosenFIKRole     = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'FIK', level: 4 });
  const dosenSIRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Sistem Informasi', level: 4 });
  const dosenIFRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Informatika', level: 4 });
  const dosenDSRole    = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'S1 Data Science', level: 4 });
  const dosenD3SIRole  = await upsertRole(roleRepo, { name: 'Dosen',            unitNama: 'D3 Sistem Informasi', level: 4 });
  const tendikRole     = await upsertRole(roleRepo, { name: 'Tendik',           unitNama: 'FIK', level: 4 });

  // 2. Seed Users
  console.log('Seeding Users...');
  // Level 0
  const superadminUser = await upsertUser(userRepo, { nip: '111', nama: 'Super Admin',     email: 'admin@iku.ac.id',        password: '000000', jenis: 'Tendik' });
  const adminUser      = await upsertUser(userRepo, { nip: '222', nama: 'Admin FIK',        email: 'admin.fik@iku.ac.id',    password: '000000', jenis: 'Tendik' });
  // Level 1 — Dekan & Wakil Dekan (juga Dosen FIK)
  const dekanUser = await upsertUser(userRepo, { nip: '301', nama: 'Prof. Dr. Ir. Supriyanto, S.T., M.Sc., IPM', email: 'supriyanto@fik.ac.id', password: '000000', jenis: 'Dosen' });
  const wd1User        = await upsertUser(userRepo, { nip: '302', nama: 'Erly Krisnanik, S.Kom., MM.', email: 'erly.krisnanik@fik.ac.id', password: '000000', jenis: 'Dosen' });
  const wd2User        = await upsertUser(userRepo, { nip: '303', nama: 'Dr. Bambang Saras Yuliastiawan, S.T., M.Kom.', email: 'bambang.saras@fik.ac.id', password: '000000', jenis: 'Dosen' });
  const wd3User        = await upsertUser(userRepo, { nip: '304', nama: 'Ati Zaidiah, S.Kom., MTI.',                    email: 'ati.zaidiah@fik.ac.id',   password: '000000', jenis: 'Dosen' });
  // Level 2 — Kajur SI (juga Dosen SI)
  const kajurSIUser    = await upsertUser(userRepo, { nip: '401', nama: 'Kajur SI',         email: 'kajur.si@fik.ac.id',     password: '000000', jenis: 'Dosen'  });
  const kajurIFUser    = await upsertUser(userRepo, { nip: '402', nama: 'Kajur Informatika', email: 'kajur.if@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  // Level 3 — Kaprodi (juga Dosen)
  const kaprodiUser    = await upsertUser(userRepo, { nip: '605', nama: 'Anita Muliati, S.Kom., MTI.', email: 'anita.muliati@fik.ac.id', password: '000000', jenis: 'Dosen' });
  const kaprodiIFUser    = await upsertUser(userRepo, { nip: '707', nama: "Dr. Ridwan Raafi'udin, S.Kom., M.Kom.", email: 'ridwan.raafiudin@fik.ac.id', password: '000000', jenis: 'Dosen' });
  const kaprodiDSUser    = await upsertUser(userRepo, { nip: '802', nama: 'Novi Trisman Hadi, S.Pd., M.Kom.',     email: 'novi.trisman@fik.ac.id',    password: '000000', jenis: 'Dosen' });
  const kaprodiD3SIUser  = await upsertUser(userRepo, { nip: '614', nama: 'Andhika Octa Indarso, M.MSI',          email: 'andhika.octa@fik.ac.id',    password: '000000', jenis: 'Dosen' });
  // Level 4 — Dosen & Tendik
  const dosen1User     = await upsertUser(userRepo, { nip: '601', nama: 'Dosen SI 1',       email: 'dosen1.si@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const dosen2User     = await upsertUser(userRepo, { nip: '602', nama: 'Dosen SI 2',       email: 'dosen2.si@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const dosen3User     = await upsertUser(userRepo, { nip: '603', nama: 'Dosen IF 1',       email: 'dosen1.if@fik.ac.id',    password: '000000', jenis: 'Dosen'  });
  const tendikUser          = await upsertUser(userRepo, { nip: '504', nama: 'Tendik FIK',                          email: 'tendik@fik.ac.id',              password: '000000', jenis: 'Tendik' });
  const saiminUser          = await upsertUser(userRepo, { nip: '501', nama: 'Saimin, S.Kom',                        email: 'saimin@fik.ac.id',              password: '000000', jenis: 'Tendik' });
  const fitriadiUser        = await upsertUser(userRepo, { nip: '502', nama: 'Fitriadi, S.Kom',                      email: 'fitriadi@fik.ac.id',            password: '000000', jenis: 'Tendik' });
  const suryadiUser         = await upsertUser(userRepo, { nip: '503', nama: 'Suryadi, A.Md',                        email: 'suryadi@fik.ac.id',             password: '000000', jenis: 'Tendik' });
  const fitriyahNingsihUser = await upsertUser(userRepo, { nip: '505', nama: 'Fitriyah Ningsih, S.Kom',              email: 'fitriyah.ningsih@fik.ac.id',    password: '000000', jenis: 'Tendik' });
  const sugiyantoUser       = await upsertUser(userRepo, { nip: '506', nama: 'Sugiyanto',                            email: 'sugiyanto@fik.ac.id',           password: '000000', jenis: 'Tendik' });
  const zainudinUser        = await upsertUser(userRepo, { nip: '507', nama: 'Zainudin',                             email: 'zainudin@fik.ac.id',            password: '000000', jenis: 'Tendik' });
  const roekanUser          = await upsertUser(userRepo, { nip: '508', nama: 'Roekan',                               email: 'roekan@fik.ac.id',              password: '000000', jenis: 'Tendik' });
  const astriantoAfandiUser = await upsertUser(userRepo, { nip: '509', nama: 'Astrianto Afandi, A.Md.Kom',           email: 'astrianto.afandi@fik.ac.id',    password: '000000', jenis: 'Tendik' });
  const mochammadFarizUser  = await upsertUser(userRepo, { nip: '510', nama: 'Mochammad Fariz Satyawan, S.Kom',      email: 'mochammad.fariz@fik.ac.id',     password: '000000', jenis: 'Tendik' });
  const ikaMarbelaUser      = await upsertUser(userRepo, { nip: '511', nama: 'Ika Marbela Sari, S.Kom',              email: 'ika.marbela@fik.ac.id',         password: '000000', jenis: 'Tendik' });
  const diditSuryaUser      = await upsertUser(userRepo, { nip: '512', nama: 'Didit Surya Hartono, S.Kom',           email: 'didit.surya@fik.ac.id',         password: '000000', jenis: 'Tendik' });
  const diyahRetnowatiUser  = await upsertUser(userRepo, { nip: '513', nama: 'Diyah Retnowati, S.Kom',               email: 'diyah.retnowati@fik.ac.id',     password: '000000', jenis: 'Tendik' });
  const rayhanAthayaUser    = await upsertUser(userRepo, { nip: '514', nama: 'Rayhan Athaya Noor Hidayat, S.Kom',    email: 'rayhan.athaya@fik.ac.id',       password: '000000', jenis: 'Tendik' });
  const ariefWidyantoUser   = await upsertUser(userRepo, { nip: '515', nama: 'Arief Widyanto, S.Kom',                email: 'arief.widyanto@fik.ac.id',      password: '000000', jenis: 'Tendik' });
  const yuliaUser           = await upsertUser(userRepo, { nip: '516', nama: 'Yulia Chaerunnisa, S.Ikom',            email: 'yulia.chaerunnisa@fik.ac.id',   password: '000000', jenis: 'Tendik' });
  const rohaniUser          = await upsertUser(userRepo, { nip: '517', nama: 'Rohani Situmorang, A.Md.Kom.',         email: 'rohani.situmorang@fik.ac.id',   password: '000000', jenis: 'Tendik' });
  const hendraMuswaraUser   = await upsertUser(userRepo, { nip: '518', nama: 'Hendra Muswara, A.Md.Kom.',            email: 'hendra.muswara@fik.ac.id',      password: '000000', jenis: 'Tendik' });
  const ichsanMaldiniUser   = await upsertUser(userRepo, { nip: '519', nama: 'Ichsan Maldini Hamid, S.Kom.',         email: 'ichsan.maldini@fik.ac.id',      password: '000000', jenis: 'Tendik' });
  // Level 4 — Dosen SI
  const susantoUser           = await upsertUser(userRepo, { nip: '604', nama: 'Dr. Susanto, M.Kom.',                               email: 'susanto@fik.ac.id',             password: '000000', jenis: 'Dosen' });
  const rioWirawanUser        = await upsertUser(userRepo, { nip: '606', nama: 'Rio Wirawan, S.Kom., MMSI.',                        email: 'rio.wirawan@fik.ac.id',         password: '000000', jenis: 'Dosen' });
  const tjajantoUser          = await upsertUser(userRepo, { nip: '607', nama: 'Dr. Tjajanto, S.Kom., MM.',                         email: 'tjajanto@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  const bambangTriUser        = await upsertUser(userRepo, { nip: '611', nama: 'Bambang Tri Wahyono, S.Kom., M.Si.',               email: 'bambang.tri@fik.ac.id',         password: '000000', jenis: 'Dosen' });
  const iWayanUser            = await upsertUser(userRepo, { nip: '612', nama: 'I Wayan Widi Pradnyana, M.TI',                     email: 'iwayan@fik.ac.id',              password: '000000', jenis: 'Dosen' });
  const kraugusteelianaUser   = await upsertUser(userRepo, { nip: '613', nama: 'Kraugusteeliana, S.Kom., M.Kom., MM.',             email: 'kraugusteeliana@fik.ac.id',     password: '000000', jenis: 'Dosen' });
  const caturUser             = await upsertUser(userRepo, { nip: '615', nama: 'Catur Nugrahaeni Puspita Dewi, S.Kom., M.Kom.',    email: 'catur.nugrahaeni@fik.ac.id',    password: '000000', jenis: 'Dosen' });
  const riaUser               = await upsertUser(userRepo, { nip: '616', nama: 'Ria Astriratma, S.Kom., M.Cs.',                    email: 'ria.astriratma@fik.ac.id',      password: '000000', jenis: 'Dosen' });
  const ruthUser              = await upsertUser(userRepo, { nip: '617', nama: 'Ruth Mariana Bunga Wadu, S.Kom., MMSI',            email: 'ruth.wadu@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const sarikaUser            = await upsertUser(userRepo, { nip: '618', nama: 'Sarika, M.Kom.',                                   email: 'sarika@fik.ac.id',              password: '000000', jenis: 'Dosen' });
  const artikaUser            = await upsertUser(userRepo, { nip: '619', nama: 'Artika Arista, S.Kom., MMSI',                      email: 'artika.arista@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const ikaUser               = await upsertUser(userRepo, { nip: '620', nama: 'Ika Nurlaili, S.Kom., M.Sc.',                      email: 'ika.nurlaili@fik.ac.id',        password: '000000', jenis: 'Dosen' });
  const zatinUser             = await upsertUser(userRepo, { nip: '621', nama: 'Zatin Niqotaini, S.Tr.Kom., M.Kom.',              email: 'zatin@fik.ac.id',               password: '000000', jenis: 'Dosen' });
  const rifkaUser             = await upsertUser(userRepo, { nip: '622', nama: 'Rifka Dwi Amalia, S.Pd., M.Kom.',                  email: 'rifka.amalia@fik.ac.id',        password: '000000', jenis: 'Dosen' });
  const adeUser               = await upsertUser(userRepo, { nip: '623', nama: 'Ade Hikma Tiana, S.Kom., M.Kom.',                  email: 'ade.hikma@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const mardiahUser           = await upsertUser(userRepo, { nip: '624', nama: 'Mardiah, S.Si., M.Kom.',                           email: 'mardiah@fik.ac.id',             password: '000000', jenis: 'Dosen' });
 // Level 4 — Dosen IF
  const widyaCholilUser         = await upsertUser(userRepo, { nip: '701', nama: 'Dr. Widya Cholil, M.I.T',                            email: 'widya.cholil@fik.ac.id',          password: '000000', jenis: 'Dosen' });
  const radinalUser             = await upsertUser(userRepo, { nip: '702', nama: 'Radinal Setyadinsa, S.Pd., M.T.I',                  email: 'radinal.setyadinsa@fik.ac.id',    password: '000000', jenis: 'Dosen' });
  const diditWidiyantoUser      = await upsertUser(userRepo, { nip: '703', nama: 'Dr. Didit Widiyanto, S.Kom., M.Si.',                email: 'didit.widiyanto@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const jayantaUser             = await upsertUser(userRepo, { nip: '704', nama: 'Jayanta, S.Kom., M.Si',                             email: 'jayanta@fik.ac.id',               password: '000000', jenis: 'Dosen' });
  const henkiBayuUser           = await upsertUser(userRepo, { nip: '705', nama: 'Henki Bayu Seta, S.Kom., MTI.',                     email: 'henki.bayu@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  const indraPermanaUser        = await upsertUser(userRepo, { nip: '706', nama: 'Dr. Indra Permana Solihin, S.Kom., M.Kom.',        email: 'indra.permana@fik.ac.id',         password: '000000', jenis: 'Dosen' });
  const noorFalihUser           = await upsertUser(userRepo, { nip: '708', nama: 'Noor Falih, S.Kom., M.T.',                          email: 'noor.falih@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  const ichsanMardaniUser       = await upsertUser(userRepo, { nip: '709', nama: 'Ichsan Mardani, S.Kom., M.Sc.',                    email: 'ichsan.mardani@fik.ac.id',        password: '000000', jenis: 'Dosen' });
  const destaSandyaUser         = await upsertUser(userRepo, { nip: '710', nama: 'Desta Sandya Prasvita, S.Komp., M.Kom.',           email: 'desta.sandya@fik.ac.id',          password: '000000', jenis: 'Dosen' });
  const mayandaUser             = await upsertUser(userRepo, { nip: '711', nama: 'Mayanda Mega Santoni, S.Komp., M.Kom.',            email: 'mayanda.santoni@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const nurulChamidahUser       = await upsertUser(userRepo, { nip: '712', nama: 'Nurul Chamidah, S.Kom., M.Kom.',                   email: 'nurul.chamidah@fik.ac.id',        password: '000000', jenis: 'Dosen' });
  const bayuHanantoUser         = await upsertUser(userRepo, { nip: '713', nama: 'Bayu Hananto, S.Kom., M.Kom.',                     email: 'bayu.hananto@fik.ac.id',          password: '000000', jenis: 'Dosen' });
  const hamonanganUser          = await upsertUser(userRepo, { nip: '714', nama: 'Hamonangan Kinantan Prabu, M.T.',                  email: 'hamonangan.prabu@fik.ac.id',      password: '000000', jenis: 'Dosen' });
  const nenyRosmawarniUser      = await upsertUser(userRepo, { nip: '715', nama: 'Neny Rosmawarni, M.Kom.',                          email: 'neny.rosmawarni@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const iWayanRanggaUser        = await upsertUser(userRepo, { nip: '716', nama: 'I Wayan Rangga Pinastawa, M.Kom.',                email: 'iwayan.rangga@fik.ac.id',         password: '000000', jenis: 'Dosen' });
  const kharismaUser            = await upsertUser(userRepo, { nip: '717', nama: 'Kharisma Wiati Gusti, M.T.',                       email: 'kharisma.wiati@fik.ac.id',        password: '000000', jenis: 'Dosen' });
  const nurhudaUser             = await upsertUser(userRepo, { nip: '718', nama: 'Nurhuda Maulana, S.T., M.T.',                      email: 'nurhuda.maulana@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const nurulAfifahUser         = await upsertUser(userRepo, { nip: '719', nama: 'Nurul Afifah Arifuddin, S.Pd., M.T.',             email: 'nurul.afifah@fik.ac.id',          password: '000000', jenis: 'Dosen' });
  const sanggiBayuUser          = await upsertUser(userRepo, { nip: '720', nama: 'Sanggi Bayu Ardika, S.Kom., M.Kom.',              email: 'sanggi.bayu@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const anisFitriUser           = await upsertUser(userRepo, { nip: '721', nama: 'Anis Fitri Nur Masruiyah, S.Kom., M.Kom.',        email: 'anis.fitri@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  const wildanAlrasyidUser      = await upsertUser(userRepo, { nip: '722', nama: 'Wildan Alrasyid, M.Si.',                           email: 'wildan.alrasyid@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  // Level 4 — Dosen Data Science
  const hengkiTamandoUser       = await upsertUser(userRepo, { nip: '801', nama: 'Dr. Hengki Tamando Sihotang, S.Kom., M.Kom.',      email: 'hengki.tamando@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const musthofaGalihUser       = await upsertUser(userRepo, { nip: '803', nama: 'Musthofa Galih Pradana, M.Kom.',                   email: 'musthofa.galih@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const muhammadAdrezoUser      = await upsertUser(userRepo, { nip: '804', nama: 'Muhammad Adrezo, S.Kom., M.Sc.',                   email: 'muhammad.adrezo@fik.ac.id',      password: '000000', jenis: 'Dosen' });
  const nindyIrzavikaUser       = await upsertUser(userRepo, { nip: '805', nama: 'Nindy Irzavika, S.Si., M.T.',                      email: 'nindy.irzavika@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const muhammadPanjiUser       = await upsertUser(userRepo, { nip: '806', nama: 'Muhammad Panji Muslim, S.Pd., M.Kom.',            email: 'muhammad.panji@fik.ac.id',       password: '000000', jenis: 'Dosen' });
  const oktavianoUser           = await upsertUser(userRepo, { nip: '807', nama: 'M. Oktaviano, S.Kom., M.Kom.',                     email: 'oktaviano@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  // Level 4 — Dosen D3 Sistem Informasi
  const rizkyTitoUser           = await upsertUser(userRepo, { nip: '901', nama: 'Rizky Tito Prasetyo, S.Si., M.T.I.',                  email: 'rizky.tito@fik.ac.id',              password: '000000', jenis: 'Dosen' });
  const bobbySuryoUser          = await upsertUser(userRepo, { nip: '902', nama: 'Bobby Suryo Prakoso, S.T., M.Kom.',                  email: 'bobby.suryo@fik.ac.id',             password: '000000', jenis: 'Dosen' });
  const budiArifUser            = await upsertUser(userRepo, { nip: '903', nama: 'Budi Arif Dermawan, M.Kom.',                         email: 'budi.arif@fik.ac.id',               password: '000000', jenis: 'Dosen' });
  const galihPrakosoUser        = await upsertUser(userRepo, { nip: '904', nama: 'Galih Prakoso Rizky A, S.Kom., MMSI.',              email: 'galih.prakoso@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const rasendaUser             = await upsertUser(userRepo, { nip: '905', nama: 'Rasenda, A.Md., S.Kom., M.Kom.',                     email: 'rasenda@fik.ac.id',                 password: '000000', jenis: 'Dosen' });
  const octantyUser             = await upsertUser(userRepo, { nip: '906', nama: 'Rr Octanty Mulianingtyas, S.Kom., M.Sc.',           email: 'octanty.mulianingtyas@fik.ac.id',   password: '000000', jenis: 'Dosen' });
  const intanHestiUser          = await upsertUser(userRepo, { nip: '907', nama: 'Dra. Intan Hesti Indriana, MM.',                    email: 'intan.hesti@fik.ac.id',             password: '000000', jenis: 'Dosen' });
  const iinErnawatiUser         = await upsertUser(userRepo, { nip: '908', nama: 'Iin Ernawati, S.Kom., M.Si.',                       email: 'iin.ernawati@fik.ac.id',            password: '000000', jenis: 'Dosen' });
  const theresiaWatiUser        = await upsertUser(userRepo, { nip: '909', nama: 'Theresia Wati, S.Kom., MTI.',                       email: 'theresia.wati@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const triRahayuUser           = await upsertUser(userRepo, { nip: '910', nama: 'Tri Rahayu, S.Kom., MM.',                           email: 'tri.rahayu@fik.ac.id',              password: '000000', jenis: 'Dosen' });
  const nurHafifahUser          = await upsertUser(userRepo, { nip: '911', nama: 'Nur Hafifah Matondang, S.Kom., MM.',               email: 'nur.hafifah@fik.ac.id',             password: '000000', jenis: 'Dosen' });
  const bayuWibisonoUser        = await upsertUser(userRepo, { nip: '912', nama: 'M. Bayu Wibisono, S.Kom.',                          email: 'bayu.wibisono@fik.ac.id',           password: '000000', jenis: 'Dosen' });
  const helenaNurramdhaniUser   = await upsertUser(userRepo, { nip: '913', nama: 'Helena Nurramdhani Irmanda, S.Pd., M.Kom.',        email: 'helena.nurramdhani@fik.ac.id',      password: '000000', jenis: 'Dosen' });

  // 3. Seed UserRoles
  console.log('Seeding UserRoles...');
  // Level 0
  await upsertUserRole(userRoleRepo, { userId: superadminUser.id, roleId: superadminRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: adminUser.id,      roleId: adminRole.id,      isPrimary: true });
  // Level 1 — primary structural + extra Dosen FIK
  await upsertUserRole(userRoleRepo, { userId: dekanUser.id, roleId: dekanRole.id,    isPrimary: true  });
await upsertUserRole(userRoleRepo, { userId: dekanUser.id, roleId: dosenFIKRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd1User.id,     roleId: wd1Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd1User.id,     roleId: dosenSIRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd2User.id,     roleId: wd2Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd2User.id,     roleId: dosenSIRole.id, isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: wd3User.id,     roleId: wd3Role.id,     isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: wd3User.id,     roleId: dosenSIRole.id, isPrimary: false });
  // Level 2 — primary Kajur + extra Dosen
  await upsertUserRole(userRoleRepo, { userId: kajurSIUser.id,  roleId: kajurSIRole.id,  isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kajurSIUser.id,  roleId: dosenSIRole.id,  isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kajurIFUser.id,  roleId: kajurIFRole.id,  isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kajurIFUser.id,  roleId: dosenIFRole.id,  isPrimary: false });
  // Level 3 — primary Kaprodi + extra Dosen
  await upsertUserRole(userRoleRepo, { userId: kaprodiUser.id,   roleId: kaprodiSIRole.id, isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiUser.id,   roleId: dosenSIRole.id,   isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kaprodiIFUser.id, roleId: kaprodiIFRole.id, isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiIFUser.id, roleId: dosenIFRole.id,   isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kaprodiDSUser.id,   roleId: kaprodiDSRole.id,   isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiDSUser.id,   roleId: dosenDSRole.id,     isPrimary: false });
  await upsertUserRole(userRoleRepo, { userId: kaprodiD3SIUser.id, roleId: kaprodiD3SIRole.id, isPrimary: true  });
  await upsertUserRole(userRoleRepo, { userId: kaprodiD3SIUser.id, roleId: dosenD3SIRole.id,   isPrimary: false });
  // Level 4 — Dosen & Tendik
  await upsertUserRole(userRoleRepo, { userId: dosen1User.id, roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: dosen2User.id, roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: dosen3User.id, roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: tendikUser.id,          roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: saiminUser.id,          roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: fitriadiUser.id,        roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: suryadiUser.id,         roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: fitriyahNingsihUser.id, roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: sugiyantoUser.id,       roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: zainudinUser.id,        roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: roekanUser.id,          roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: astriantoAfandiUser.id, roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: mochammadFarizUser.id,  roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ikaMarbelaUser.id,      roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: diditSuryaUser.id,      roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: diyahRetnowatiUser.id,  roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rayhanAthayaUser.id,    roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ariefWidyantoUser.id,   roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: yuliaUser.id,           roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rohaniUser.id,          roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: hendraMuswaraUser.id,   roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ichsanMaldiniUser.id,   roleId: tendikRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: susantoUser.id,         roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rioWirawanUser.id,      roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: tjajantoUser.id,        roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: bambangTriUser.id,      roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: iWayanUser.id,          roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: kraugusteelianaUser.id, roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: caturUser.id,           roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: riaUser.id,             roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ruthUser.id,            roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: sarikaUser.id,          roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: artikaUser.id,          roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ikaUser.id,             roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: zatinUser.id,           roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rifkaUser.id,           roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: adeUser.id,             roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: mardiahUser.id,         roleId: dosenSIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: widyaCholilUser.id,     roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: radinalUser.id,         roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: diditWidiyantoUser.id,  roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: jayantaUser.id,         roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: henkiBayuUser.id,       roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: indraPermanaUser.id,    roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: noorFalihUser.id,       roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: ichsanMardaniUser.id,   roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: destaSandyaUser.id,     roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: mayandaUser.id,         roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nurulChamidahUser.id,   roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: bayuHanantoUser.id,     roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: hamonanganUser.id,      roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nenyRosmawarniUser.id,  roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: iWayanRanggaUser.id,    roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: kharismaUser.id,        roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nurhudaUser.id,         roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nurulAfifahUser.id,     roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: sanggiBayuUser.id,      roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: anisFitriUser.id,       roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: wildanAlrasyidUser.id,  roleId: dosenIFRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: hengkiTamandoUser.id,   roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: musthofaGalihUser.id,   roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: muhammadAdrezoUser.id,  roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nindyIrzavikaUser.id,   roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: muhammadPanjiUser.id,   roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: oktavianoUser.id,       roleId: dosenDSRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rizkyTitoUser.id,         roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: bobbySuryoUser.id,        roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: budiArifUser.id,          roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: galihPrakosoUser.id,      roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: rasendaUser.id,           roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: octantyUser.id,           roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: intanHestiUser.id,        roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: iinErnawatiUser.id,       roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: theresiaWatiUser.id,      roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: triRahayuUser.id,         roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: nurHafifahUser.id,        roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: bayuWibisonoUser.id,      roleId: dosenD3SIRole.id, isPrimary: true });
  await upsertUserRole(userRoleRepo, { userId: helenaNurramdhaniUser.id, roleId: dosenD3SIRole.id, isPrimary: true });
 
  // 4. Seed UserRelations (hierarki disposisi)
  console.log('Seeding UserRelations...');
  // Wd1 → Dekan (Dekan adalah atasan WD)
  await upsertUserRelation(wd1User.id, dekanUser.id);
  await upsertUserRelation(wd2User.id, dekanUser.id);
  await upsertUserRelation(wd3User.id, dekanUser.id);
  // Kajur → WD1 (WD1 bertanggung jawab atas jurusan)
  await upsertUserRelation(kajurSIUser.id, wd1User.id);
  await upsertUserRelation(kajurIFUser.id, wd1User.id);
  // Kaprodi → Kajur
  await upsertUserRelation(kaprodiUser.id,   kajurSIUser.id);
  await upsertUserRelation(kaprodiIFUser.id, kajurIFUser.id);
  // Dosen → Kaprodi
  await upsertUserRelation(dosen1User.id, kaprodiUser.id);
  await upsertUserRelation(dosen2User.id, kaprodiUser.id);
  await upsertUserRelation(dosen3User.id, kaprodiIFUser.id);
  await upsertUserRelation(susantoUser.id, kaprodiUser.id);
  await upsertUserRelation(rioWirawanUser.id, kaprodiUser.id);
  await upsertUserRelation(tjajantoUser.id, kaprodiUser.id);
  await upsertUserRelation(bambangTriUser.id, kaprodiUser.id);
  await upsertUserRelation(iWayanUser.id, kaprodiUser.id);
  await upsertUserRelation(kraugusteelianaUser.id, kaprodiUser.id);
  await upsertUserRelation(caturUser.id, kaprodiUser.id);
  await upsertUserRelation(riaUser.id, kaprodiUser.id);
  await upsertUserRelation(ruthUser.id, kaprodiUser.id);
  await upsertUserRelation(sarikaUser.id, kaprodiUser.id);
  await upsertUserRelation(artikaUser.id, kaprodiUser.id);
  await upsertUserRelation(ikaUser.id, kaprodiUser.id);
  await upsertUserRelation(zatinUser.id, kaprodiUser.id);
  await upsertUserRelation(rifkaUser.id, kaprodiUser.id);
  await upsertUserRelation(adeUser.id, kaprodiUser.id);
  await upsertUserRelation(mardiahUser.id, kaprodiUser.id);
  await upsertUserRelation(widyaCholilUser.id, kaprodiIFUser.id);
  await upsertUserRelation(radinalUser.id, kaprodiIFUser.id);
  await upsertUserRelation(diditWidiyantoUser.id, kaprodiIFUser.id);
  await upsertUserRelation(jayantaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(henkiBayuUser.id, kaprodiIFUser.id);
  await upsertUserRelation(indraPermanaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(noorFalihUser.id, kaprodiIFUser.id);
  await upsertUserRelation(ichsanMardaniUser.id, kaprodiIFUser.id);
  await upsertUserRelation(destaSandyaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(mayandaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(nurulChamidahUser.id, kaprodiIFUser.id);
  await upsertUserRelation(bayuHanantoUser.id, kaprodiIFUser.id);
  await upsertUserRelation(hamonanganUser.id, kaprodiIFUser.id);
  await upsertUserRelation(nenyRosmawarniUser.id, kaprodiIFUser.id);
  await upsertUserRelation(iWayanRanggaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(kharismaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(nurhudaUser.id, kaprodiIFUser.id);
  await upsertUserRelation(nurulAfifahUser.id, kaprodiIFUser.id);
  await upsertUserRelation(sanggiBayuUser.id, kaprodiIFUser.id);
  await upsertUserRelation(anisFitriUser.id, kaprodiIFUser.id);
  await upsertUserRelation(wildanAlrasyidUser.id, kaprodiIFUser.id);
  await upsertUserRelation(hengkiTamandoUser.id,  kaprodiDSUser.id);
  await upsertUserRelation(musthofaGalihUser.id,  kaprodiDSUser.id);
  await upsertUserRelation(muhammadAdrezoUser.id, kaprodiDSUser.id);
  await upsertUserRelation(nindyIrzavikaUser.id,  kaprodiDSUser.id);
  await upsertUserRelation(muhammadPanjiUser.id,  kaprodiDSUser.id);
  await upsertUserRelation(oktavianoUser.id,      kaprodiDSUser.id);
  await upsertUserRelation(rizkyTitoUser.id,         kaprodiD3SIUser.id);
  await upsertUserRelation(bobbySuryoUser.id,        kaprodiD3SIUser.id);
  await upsertUserRelation(budiArifUser.id,          kaprodiD3SIUser.id);
  await upsertUserRelation(galihPrakosoUser.id,      kaprodiD3SIUser.id);
  await upsertUserRelation(rasendaUser.id,           kaprodiD3SIUser.id);
  await upsertUserRelation(octantyUser.id,           kaprodiD3SIUser.id);
  await upsertUserRelation(intanHestiUser.id,        kaprodiD3SIUser.id);
  await upsertUserRelation(iinErnawatiUser.id,       kaprodiD3SIUser.id);
  await upsertUserRelation(theresiaWatiUser.id,      kaprodiD3SIUser.id);
  await upsertUserRelation(triRahayuUser.id,         kaprodiD3SIUser.id);
  await upsertUserRelation(nurHafifahUser.id,        kaprodiD3SIUser.id);
  await upsertUserRelation(bayuWibisonoUser.id,      kaprodiD3SIUser.id);
  await upsertUserRelation(helenaNurramdhaniUser.id, kaprodiD3SIUser.id);
  // Tendik → Kabag (tidak ada kabag user di seed ini, skip)

  // 5. Seed Indikator IKU & PK
  console.log('Seeding Indikator...');
  const TAHUN = '2026';
  const ind = (data: Omit<Parameters<typeof findOrCreateIndikator>[1], 'tahun'>) =>
    findOrCreateIndikator(indikatorRepo, { ...data, tahun: TAHUN });

  // ─── IKU ──────────────────────────────────────────────────────────────────
  const ikuSS1 = await ind({ jenis: 'IKU', kode: '1', nama: 'Talenta', level: 0, parentId: null, kategori: 'Wajib' });

const iku1_1 = await ind({ jenis: 'IKU', kode: '1.1', nama: 'Angka Efisiensi Edukasi Perguruan Tinggi (AEE PT)', level: 1, parentId: ikuSS1.id });
const iku1_2 = await ind({ jenis: 'IKU', kode: '1.2', nama: 'Persentase mahasiswa pascasarjana terhadap total mahasiswa', level: 1, parentId: ikuSS1.id });
const iku1_3 = await ind({ jenis: 'IKU', kode: '1.3', nama: 'Persentase mahasiswa internasional', level: 1, parentId: ikuSS1.id });

const iku1_1_1 = await ind({ jenis: 'IKU', kode: '1.1.1', nama: 'D3', level: 2, parentId: iku1_1.id });
const iku1_1_2 = await ind({ jenis: 'IKU', kode: '1.1.2', nama: 'S1', level: 2, parentId: iku1_1.id });
const iku1_1_3 = await ind({ jenis: 'IKU', kode: '1.1.3', nama: 'S2', level: 2, parentId: iku1_1.id });

const iku1_2_1 = await ind({ jenis: 'IKU', kode: '1.2.1', nama: 'Mahasiswa magister', level: 2, parentId: iku1_2.id });
const iku1_2_2 = await ind({ jenis: 'IKU', kode: '1.2.2', nama: 'Mahasiswa doktor', level: 2, parentId: iku1_2.id });

const iku1_3_1 = await ind({ jenis: 'IKU', kode: '1.3.1', nama: 'Persentase mahasiswa internasional', level: 2, parentId: iku1_3.id });

const ikuSS2 = await ind({ jenis: 'IKU', kode: '2', nama: 'Talenta', level: 0, parentId: null, kategori: 'Wajib' });

const iku2_1 = await ind({ jenis: 'IKU', kode: '2.1', nama: 'Persentase lulusan pendidikan tinggi akademik dan vokasi yang langsung bekerja/melanjutkan jenjang pendidikan berikutnya/berwirausaha dalam jangka waktu 1 tahun setelah kelulusan', level: 1, parentId: ikuSS2.id });

const iku2_1_1 = await ind({ jenis: 'IKU', kode: '2.1.1', nama: 'Persentase lulusan pendidikan tinggi akademik dan vokasi yang langsung bekerja/melanjutkan jenjang pendidikan berikutnya/berwirausaha dalam jangka waktu 1 tahun setelah kelulusan', level: 2, parentId: iku2_1.id });

const ikuSS3 = await ind({ jenis: 'IKU', kode: '3', nama: 'Talenta', level: 0, parentId: null, kategori: 'Wajib' });

const iku3_1 = await ind({ jenis: 'IKU', kode: '3.1', nama: 'Persentase mahasiswa S1 dan D4/D3/D2/D1 berkegiatan/meraih prestasi di luar program studi', level: 1, parentId: ikuSS3.id });

const iku3_1_1 = await ind({ jenis: 'IKU', kode: '3.1.1', nama: 'Persentase mahasiswa S1 dan D4/D3/D2/D1 berkegiatan/meraih prestasi di luar program studi', level: 2, parentId: iku3_1.id });

const ikuSS4 = await ind({ jenis: 'IKU', kode: '4', nama: 'Talenta', level: 0, parentId: null, kategori: 'Pilihan' });

const iku4_1 = await ind({ jenis: 'IKU', kode: '4.1', nama: 'Persentase dosen PT yang mendapatkan rekognisi internasional', level: 1, parentId: ikuSS4.id });
const iku4_2 = await ind({ jenis: 'IKU', kode: '4.2', nama: 'Persentase dosen berpendidikan S3', level: 1, parentId: ikuSS4.id });

const iku4_1_1 = await ind({ jenis: 'IKU', kode: '4.1.1', nama: 'Persentase dosen PT yang mendapatkan rekognisi internasional', level: 2, parentId: iku4_1.id });
const iku4_2_1 = await ind({ jenis: 'IKU', kode: '4.2.1', nama: 'Persentase dosen berpendidikan S3', level: 2, parentId: iku4_2.id });

const ikuSS5 = await ind({ jenis: 'IKU', kode: '5', nama: 'Inovasi', level: 0, parentId: null, kategori: 'Wajib' });
const iku5_1 = await ind({ jenis: 'IKU', kode: '5.1', nama: 'Jumlah luaran penelitian dan pengabdian kepada masyarakat yang berhasil mendapat rekognisi internasional atau diterapkan oleh masyarakat per jumlah dosen', level: 1, parentId: ikuSS5.id });
const iku5_1_1 = await ind({ jenis: 'IKU', kode: '5.1.1', nama: 'Jumlah luaran penelitian dan pengabdian kepada masyarakat', level: 2, parentId: iku5_1.id });

const ikuSS6 = await ind({ jenis: 'IKU', kode: '6', nama: 'Inovasi', level: 0, parentId: null, kategori: 'Pilihan' });
const iku6_1 = await ind({ jenis: 'IKU', kode: '6.1', nama: 'Publikasi bereputasi internasional (Scopus/WoS)', level: 1, parentId: ikuSS6.id });
const iku6_1_1 = await ind({ jenis: 'IKU', kode: '6.1.1', nama: 'Artikel Scopus/WoS', level: 2, parentId: iku6_1.id });
const iku6_1_2 = await ind({ jenis: 'IKU', kode: '6.1.2', nama: 'Buku', level: 2, parentId: iku6_1.id });
const iku6_1_3 = await ind({ jenis: 'IKU', kode: '6.1.3', nama: 'Prosiding Internasional', level: 2, parentId: iku6_1.id });
const iku6_1_4 = await ind({ jenis: 'IKU', kode: '6.1.4', nama: 'HKI/Paten', level: 2, parentId: iku6_1.id });

const ikuSS7 = await ind({ jenis: 'IKU', kode: '7', nama: 'Inovasi', level: 0, parentId: null, kategori: 'Wajib' });
const iku7_1 = await ind({ jenis: 'IKU', kode: '7.1', nama: 'Persentase kegiatan penelitian dan pengabdian kepada masyarakat yang melibatkan mahasiswa', level: 1, parentId: ikuSS7.id });
const iku7_1_1 = await ind({ jenis: 'IKU', kode: '7.1.1', nama: 'Buku', level: 2, parentId: iku7_1.id });
const iku7_1_2 = await ind({ jenis: 'IKU', kode: '7.1.2', nama: 'Mata Kuliah', level: 2, parentId: iku7_1.id });
const iku7_1_3 = await ind({ jenis: 'IKU', kode: '7.1.3', nama: 'Judul Penelitian', level: 2, parentId: iku7_1.id });
const iku7_1_4 = await ind({ jenis: 'IKU', kode: '7.1.4', nama: 'Judul Pengabdian', level: 2, parentId: iku7_1.id });

const ikuSS8 = await ind({ jenis: 'IKU', kode: '8', nama: 'Kontribusi pada Masyarakat', level: 0, parentId: null, kategori: 'Pilihan' });
const iku8_1 = await ind({ jenis: 'IKU', kode: '8.1', nama: 'Persentase SDM PT (dosen dan peneliti) yang terlibat langsung dalam penyusunan kebijakan (nasional/daerah/industri)', level: 1, parentId: ikuSS8.id });
const iku8_1_1 = await ind({ jenis: 'IKU', kode: '8.1.1', nama: 'Persentase SDM PT (dosen dan peneliti) yang terlibat langsung dalam penyusunan kebijakan (nasional/daerah/industri)', level: 2, parentId: iku8_1.id });

const ikuSS10 = await ind({ jenis: 'IKU', kode: '10', nama: 'Tata Kelola berintegritas', level: 0, parentId: null, kategori: 'Pilihan' });
const iku10_1 = await ind({ jenis: 'IKU', kode: '10.1', nama: 'Jumlah usulan Zona Integritas - WBK/WBBM', level: 1, parentId: ikuSS10.id });
const iku10_1_1 = await ind({ jenis: 'IKU', kode: '10.1.1', nama: 'Jumlah usulan Zona Integritas - WBK/WBBM', level: 2, parentId: iku10_1.id });


  // ─── Target ───────────────────────────────────────────────────────────────
  console.log('Seeding Target...');

  async function upsertTargetUniv(indId: number, persentase: number, satuan: string | null = null) {
    const ex = await targetRepo.findOne({ where: { indikatorId: indId, tahun: TAHUN } });
    if (ex) { ex.persentase = persentase; ex.satuan = satuan; return targetRepo.save(ex); }
    return targetRepo.save(targetRepo.create({ indikatorId: indId, tahun: TAHUN, persentase, satuan }));
  }

  // ── Target Universitas per IKU (level 0) ─────────────────────────────────
  // upsertTargetUnit membutuhkan roleId — set via web interface
  await upsertTargetUniv(ikuSS1.id,  229, 'Lulusan');   // IKU 1: AEE PT
  await upsertTargetUniv(ikuSS2.id,  256, 'Lulusan');   // IKU 2: Lulusan bekerja/studi lanjut
  await upsertTargetUniv(ikuSS3.id,  605, 'Mahasiswa'); // IKU 3: Mhs MBKM
  await upsertTargetUniv(ikuSS4.id,   17, 'Dosen');     // IKU 4: Dosen rekognisi internasional
  await upsertTargetUniv(ikuSS5.id,   11, 'Luaran/IA'); // IKU 5: Luaran penelitian
  await upsertTargetUniv(ikuSS6.id,    5, 'Artikel');   // IKU 6: Publikasi internasional
  await upsertTargetUniv(ikuSS7.id,   27, 'Kegiatan');  // IKU 7: Kegiatan penelitian/pengabdian
  await upsertTargetUniv(ikuSS8.id,   18, 'Dosen');     // IKU 8: SDM terlibat kebijakan
  await upsertTargetUniv(ikuSS10.id,   1, 'Unit Kerja');// IKU 10: Zona Integritas

  // Referensi variabel level-2 (digunakan saat buat TargetUnit via web/manual):
  void iku1_1_1; void iku1_1_2; void iku1_1_3;
  void iku1_2_1; void iku1_2_2; void iku1_3_1;
  void iku2_1_1; void iku3_1_1;
  void iku4_1_1; void iku4_2_1;
  void iku5_1_1;
  void iku6_1_1; void iku6_1_2; void iku6_1_3; void iku6_1_4;
  void iku7_1_1; void iku7_1_2; void iku7_1_3; void iku7_1_4;
  void iku8_1_1; void iku10_1_1;

  // ─── PK ──────────────────────────────────────────────────────────────────
  console.log('Seeding Indikator PK...');
  const pkSS1 = await ind({ jenis: 'PK', kode: '1', nama: 'Meningkatnya tata kelola satuan kerja di lingkungan UPN Veteran Jakarta', level: 0, parentId: null });

const pk1_1 = await ind({ jenis: 'PK', kode: '1.1', nama: 'Peningkatan Tata Kelola Akademik', level: 1, parentId: pkSS1.id });
const pk1_2 = await ind({ jenis: 'PK', kode: '1.2', nama: 'Peningkatan Tata Kelola Non Akademik', level: 1, parentId: pkSS1.id });

const pk1_1_1 = await ind({ jenis: 'PK', kode: '1.1.1', nama: 'Ketersediaan Rencana Strategis Bisnis (RSB)', level: 2, parentId: pk1_1.id });
const pk1_1_2 = await ind({ jenis: 'PK', kode: '1.1.2', nama: 'Pemutakhiran Pedoman Akademik TA. 2026/2027', level: 2, parentId: pk1_1.id });
const pk1_1_3 = await ind({ jenis: 'PK', kode: '1.1.3', nama: 'Strategi pencapaian PK dan risk register 2026', level: 2, parentId: pk1_1.id });
const pk1_1_4 = await ind({ jenis: 'PK', kode: '1.1.4', nama: 'Kalender Kegiatan Operasional Fakultas (KKOF) tahun 2026 tercetak dan terdistribusi pada tiap sub unit kerja Fakultas', level: 2, parentId: pk1_1.id });
const pk1_1_5 = await ind({ jenis: 'PK', kode: '1.1.5', nama: 'Pemberitaan kegiatan melalui web Fakultas', level: 2, parentId: pk1_1.id });
const pk1_1_6 = await ind({ jenis: 'PK', kode: '1.1.6', nama: 'Pelaporan PDDIKTI', level: 2, parentId: pk1_1.id });
const pk1_1_7 = await ind({ jenis: 'PK', kode: '1.1.7', nama: 'Laporan Pemutakhiran Mahasiswa Tidak Aktif sesuai Angkatan', level: 2, parentId: pk1_1.id });
const pk1_1_8 = await ind({ jenis: 'PK', kode: '1.1.8', nama: 'Pelaporan Akademik', level: 2, parentId: pk1_1.id });
const pk1_1_9 = await ind({ jenis: 'PK', kode: '1.1.9', nama: 'Laporan Rapat Tinjauan Manajemen (RTM)', level: 2, parentId: pk1_1.id });
const pk1_1_10 = await ind({ jenis: 'PK', kode: '1.1.10', nama: 'SKP Tendik dan Dosen', level: 2, parentId: pk1_1.id });
const pk1_1_11 = await ind({ jenis: 'PK', kode: '1.1.11', nama: 'Penyusunan LKPS dan LED sesuai Format BAN-PT/LAM', level: 2, parentId: pk1_1.id });
const pk1_1_12 = await ind({ jenis: 'PK', kode: '1.1.12', nama: 'Pelaksanaan Audit Mutu Internal (AMI) di tingkat program studi', level: 2, parentId: pk1_1.id });
const pk1_1_13 = await ind({ jenis: 'PK', kode: '1.1.13', nama: 'Tingkat Penyelesaian Temuan Audit Mutu Internal (AMI) Tahun Sebelumnya', level: 2, parentId: pk1_1.id });
const pk1_1_14 = await ind({ jenis: 'PK', kode: '1.1.14', nama: 'Program Studi Memenuhi dan Melampaui Standar AMI', level: 2, parentId: pk1_1.id });
const pk1_1_15 = await ind({ jenis: 'PK', kode: '1.1.15', nama: 'Pelaksanaan Monev Persiapan Pembelajaran', level: 2, parentId: pk1_1.id });
const pk1_1_16 = await ind({ jenis: 'PK', kode: '1.1.16', nama: 'Pelaksanaan Monev Proses Pembelajaran', level: 2, parentId: pk1_1.id });
const pk1_1_17 = await ind({ jenis: 'PK', kode: '1.1.17', nama: 'Pelaksanaan Monev Laboratorium', level: 2, parentId: pk1_1.id });
const pk1_1_18 = await ind({ jenis: 'PK', kode: '1.1.18', nama: 'Pelaksanaan Monev Penelitian dan PkM', level: 2, parentId: pk1_1.id });
const pk1_1_19 = await ind({ jenis: 'PK', kode: '1.1.19', nama: 'Laporan Risk Register TA. 2025/2026', level: 2, parentId: pk1_1.id });
const pk1_1_20 = await ind({ jenis: 'PK', kode: '1.1.20', nama: 'Reakreditasi Program Studi', level: 2, parentId: pk1_1.id });
const pk1_1_21 = await ind({ jenis: 'PK', kode: '1.1.21', nama: 'Ketersediaan dokumen laporan evaluasi dan tindak lanjut hasil pelaksanaan survey kepuasan Indeks Kepuasan Standar Layanan Minimal (SPM) dalam 8 aspek', level: 2, parentId: pk1_1.id });
const pk1_1_22 = await ind({ jenis: 'PK', kode: '1.1.22', nama: 'Publikasi hasil evaluasi survey kepuasan Indeks Kepuasan Standar Layanan Minimal (SPM) dalam 8 aspek', level: 2, parentId: pk1_1.id });
const pk1_1_23 = await ind({ jenis: 'PK', kode: '1.1.23', nama: 'Inovasi layanan pendidikan', level: 2, parentId: pk1_1.id });
const pk1_1_24 = await ind({ jenis: 'PK', kode: '1.1.24', nama: 'Pemutakhiran Data SINTA Dosen', level: 2, parentId: pk1_1.id });

await ind({ jenis: 'PK', kode: '1.1.1.1', nama: 'Penyusunan revisi RSB Fakultas', level: 3, parentId: pk1_1_1.id });
await ind({ jenis: 'PK', kode: '1.1.1.2', nama: 'Program kerja dan Kalender Kegiatan Operasional Prodi (KKOP) 2026', level: 3, parentId: pk1_1_1.id });

await ind({ jenis: 'PK', kode: '1.1.2.1', nama: 'Pemutakhiran Pedoman Akademik TA. 2026/2027', level: 3, parentId: pk1_1_2.id });
await ind({ jenis: 'PK', kode: '1.1.3.1', nama: 'Strategi pencapaian PK dan risk register 2026', level: 3, parentId: pk1_1_3.id });
await ind({ jenis: 'PK', kode: '1.1.4.1', nama: 'Kalender Kegiatan Operasional Fakultas (KKOF) tahun 2026 tercetak dan terdistribusi pada tiap sub unit kerja Fakultas', level: 3, parentId: pk1_1_4.id });
await ind({ jenis: 'PK', kode: '1.1.5.1', nama: 'Pemberitaan kegiatan melalui web Fakultas', level: 3, parentId: pk1_1_5.id });
await ind({ jenis: 'PK', kode: '1.1.6.1', nama: 'Semester Genap TA 2025/2026', level: 3, parentId: pk1_1_6.id });
await ind({ jenis: 'PK', kode: '1.1.6.2', nama: 'Semester Ganjil TA. 2026/2027', level: 3, parentId: pk1_1_6.id });
await ind({ jenis: 'PK', kode: '1.1.7.1', nama: 'Laporan Pemutakhiran Mahasiswa Tidak Aktif sesuai Angkatan', level: 3, parentId: pk1_1_7.id });
await ind({ jenis: 'PK', kode: '1.1.8.1', nama: 'Semester Genap TA 2025/2026', level: 3, parentId: pk1_1_8.id });
await ind({ jenis: 'PK', kode: '1.1.8.2', nama: 'Semester Ganjil TA. 2026/2027', level: 3, parentId: pk1_1_8.id });
await ind({ jenis: 'PK', kode: '1.1.9.1', nama: 'Laporan Rapat Tinjauan Manajemen (RTM)', level: 3, parentId: pk1_1_9.id });
await ind({ jenis: 'PK', kode: '1.1.10.1', nama: 'Rencana SKP tendik dan dosen Tahun 2026', level: 3, parentId: pk1_1_10.id });
await ind({ jenis: 'PK', kode: '1.1.10.2', nama: 'Penilaian SKP tendik dan dosen Tahun 2025', level: 3, parentId: pk1_1_10.id });

await ind({ jenis: 'PK', kode: '1.1.11.1', nama: 'Penyusunan LKPS dan LED sesuai Format BAN-PT/LAM', level: 3, parentId: pk1_1_11.id });
await ind({ jenis: 'PK', kode: '1.1.12.1', nama: 'Pelaksanaan Audit Mutu Internal (AMI) di tingkat program studi', level: 3, parentId: pk1_1_12.id });
await ind({ jenis: 'PK', kode: '1.1.13.1', nama: 'Tingkat Penyelesaian Temuan Audit Mutu Internal (AMI) Tahun Sebelumnya', level: 3, parentId: pk1_1_13.id });
await ind({ jenis: 'PK', kode: '1.1.14.1', nama: 'Program Studi Memenuhi dan Melampaui Standar AMI', level: 3, parentId: pk1_1_14.id });
await ind({ jenis: 'PK', kode: '1.1.15.1', nama: 'Pelaksanaan Monev Persiapan Pembelajaran', level: 3, parentId: pk1_1_15.id });
await ind({ jenis: 'PK', kode: '1.1.16.1', nama: 'Pelaksanaan Monev Proses Pembelajaran', level: 3, parentId: pk1_1_16.id });
await ind({ jenis: 'PK', kode: '1.1.17.1', nama: 'Pelaksanaan Monev Laboratorium', level: 3, parentId: pk1_1_17.id });
await ind({ jenis: 'PK', kode: '1.1.18.1', nama: 'Pelaksanaan Monev Penelitian dan PkM', level: 3, parentId: pk1_1_18.id });
await ind({ jenis: 'PK', kode: '1.1.19.1', nama: 'Laporan Risk Register TA. 2025/2026', level: 3, parentId: pk1_1_19.id });
await ind({ jenis: 'PK', kode: '1.1.20.1', nama: 'Reakreditasi Program Studi', level: 3, parentId: pk1_1_20.id });
await ind({ jenis: 'PK', kode: '1.1.21.1', nama: 'Ketersediaan dokumen laporan evaluasi dan tindak lanjut hasil pelaksanaan survey kepuasan Indeks Kepuasan Standar Layanan Minimal (SPM) dalam 8 aspek', level: 3, parentId: pk1_1_21.id });
await ind({ jenis: 'PK', kode: '1.1.22.1', nama: 'Publikasi hasil evaluasi survey kepuasan Indeks Kepuasan Standar Layanan Minimal (SPM) dalam 8 aspek', level: 3, parentId: pk1_1_22.id });
await ind({ jenis: 'PK', kode: '1.1.23.1', nama: 'Inovasi layanan pendidikan', level: 3, parentId: pk1_1_23.id });
await ind({ jenis: 'PK', kode: '1.1.24.1', nama: 'Pemutakhiran Data SINTA Dosen', level: 3, parentId: pk1_1_24.id });

const pk1_2_1 = await ind({ jenis: 'PK', kode: '1.2.1', nama: 'Persentase Penurunan Nilai Piutang UKT dan/atau SPI', level: 2, parentId: pk1_2.id });
const pk1_2_2 = await ind({ jenis: 'PK', kode: '1.2.2', nama: 'Persentase Pendapatan dari optimalisasi aset', level: 2, parentId: pk1_2.id });
const pk1_2_3 = await ind({ jenis: 'PK', kode: '1.2.3', nama: 'Persentase kesesuaian LPJ dengan RPD Internal', level: 2, parentId: pk1_2.id });
const pk1_2_4 = await ind({ jenis: 'PK', kode: '1.2.4', nama: 'Jumlah revisi POK', level: 2, parentId: pk1_2.id });
const pk1_2_5 = await ind({ jenis: 'PK', kode: '1.2.5', nama: 'Laporan Kinerja Sub Satker Tahun 2026', level: 2, parentId: pk1_2.id });
const pk1_2_6 = await ind({ jenis: 'PK', kode: '1.2.6', nama: 'Jumlah surveyor pada pemeringkatan Internasional QS', level: 2, parentId: pk1_2.id });

await ind({ jenis: 'PK', kode: '1.2.1.1', nama: 'Persentase Penurunan Nilai Piutang UKT dan/atau SPI', level: 3, parentId: pk1_2_1.id });
await ind({ jenis: 'PK', kode: '1.2.2.1', nama: 'Persentase Pendapatan dari optimalisasi aset', level: 3, parentId: pk1_2_2.id });
await ind({ jenis: 'PK', kode: '1.2.3.1', nama: 'Persentase kesesuaian LPJ dengan RPD Internal', level: 3, parentId: pk1_2_3.id });
await ind({ jenis: 'PK', kode: '1.2.4.1', nama: 'Jumlah revisi POK', level: 3, parentId: pk1_2_4.id });
await ind({ jenis: 'PK', kode: '1.2.5.1', nama: 'Laporan Kinerja Sub Satker Tahun 2026', level: 3, parentId: pk1_2_5.id });

await ind({ jenis: 'PK', kode: '1.2.6.1', nama: 'Pemenuhan surveyor pemeringkatan QS akademik dalam negeri', level: 3, parentId: pk1_2_6.id });
await ind({ jenis: 'PK', kode: '1.2.6.2', nama: 'Pemenuhan surveyor pemeringkatan QS akademik luar negeri', level: 3, parentId: pk1_2_6.id });
await ind({ jenis: 'PK', kode: '1.2.6.3', nama: 'Pemenuhan surveyor pemeringkatan QS employer dalam negeri dan luar negeri', level: 3, parentId: pk1_2_6.id });

const pkSS2 = await ind({ jenis: 'PK', kode: '2', nama: 'Meningkatnya kualitas lulusan pendidikan tinggi', level: 0, parentId: null });

const pk2_1 = await ind({ jenis: 'PK', kode: '2.1', nama: 'Pengelolaan bimbingan konseling', level: 1, parentId: pkSS2.id });

const pk2_1_1 = await ind({ jenis: 'PK', kode: '2.1.1', nama: 'Pengelolaan bimbingan konseling', level: 2, parentId: pk2_1.id });

await ind({ jenis: 'PK', kode: '2.1.1.1', nama: 'Pengelolaan bimbingan konseling', level: 3, parentId: pk2_1_1.id });

const pkSS3 = await ind({ jenis: 'PK', kode: '3', nama: 'Meningkatkan kualitas kurikulum dan pembelajaran', level: 0, parentId: null });

const pk3_1 = await ind({ jenis: 'PK', kode: '3.1', nama: 'Peningkatan Kualitas Kurikulum dan Pembelajaran', level: 1, parentId: pkSS3.id });
const pk3_2 = await ind({ jenis: 'PK', kode: '3.2', nama: 'Peningkatan Kualitas Mahasiswa', level: 1, parentId: pkSS3.id });
const pk3_3 = await ind({ jenis: 'PK', kode: '3.3', nama: 'Peningkatan Kualitas Kerjasama Dalam Negeri di Bidang Akademik', level: 1, parentId: pkSS3.id });
const pk3_4 = await ind({ jenis: 'PK', kode: '3.4', nama: 'Peningkatan Kualitas Kerjasama Luar Negeri di Bidang Akademik', level: 1, parentId: pkSS3.id });

const pk3_1_1 = await ind({ jenis: 'PK', kode: '3.1.1', nama: 'Persentase kegiatan/judul penelitian yang terintegrasi dengan mata kuliah', level: 2, parentId: pk3_1.id });
const pk3_1_2 = await ind({ jenis: 'PK', kode: '3.1.2', nama: 'Persentase kegiatan/judul pengabdian kepada masyarakat yang terintegrasi dengan mata kuliah', level: 2, parentId: pk3_1.id });
const pk3_1_3 = await ind({ jenis: 'PK', kode: '3.1.3', nama: 'Suasana akademik selain perkuliahan', level: 2, parentId: pk3_1.id });

await ind({ jenis: 'PK', kode: '3.1.1.1', nama: 'Persentase kegiatan/judul penelitian yang terintegrasi dengan mata kuliah', level: 3, parentId: pk3_1_1.id });
await ind({ jenis: 'PK', kode: '3.1.2.1', nama: 'Persentase kegiatan/judul pengabdian kepada masyarakat yang terintegrasi dengan mata kuliah', level: 3, parentId: pk3_1_2.id });

await ind({ jenis: 'PK', kode: '3.1.3.1', nama: 'Kuliah umum dengan pembicara/narasumber academic leader/tokoh/pimpinan nasional', level: 3, parentId: pk3_1_3.id });
await ind({ jenis: 'PK', kode: '3.1.3.2', nama: 'Bedah buku berstatus best seller nasional/internasional/buku hasil riset berskala nasional/internasional atau buku yang ditulis oleh dosen di Fakultas terkait yang terbit secara nasional/internasional', level: 3, parentId: pk3_1_3.id });
await ind({ jenis: 'PK', kode: '3.1.3.3', nama: 'Diskusi ilmiah tingkat jurusan/pelatihan metodologi atau bidang akademik lainnya', level: 3, parentId: pk3_1_3.id });

const pk3_2_1 = await ind({ jenis: 'PK', kode: '3.2.1', nama: 'Persentase mahasiswa memiliki sertifikat kompetensi nasional', level: 2, parentId: pk3_2.id });
const pk3_2_2 = await ind({ jenis: 'PK', kode: '3.2.2', nama: 'Persentase mahasiswa memiliki sertifikat kompetensi internasional', level: 2, parentId: pk3_2.id });
const pk3_2_3 = await ind({ jenis: 'PK', kode: '3.2.3', nama: 'Persentase mahasiswa yang dilibatkan dalam penelitian dosen', level: 2, parentId: pk3_2.id });
const pk3_2_4 = await ind({ jenis: 'PK', kode: '3.2.4', nama: 'Persentase mahasiswa yang dilibatkan dalam pengabdian kepada masyarakat dosen', level: 2, parentId: pk3_2.id });

await ind({ jenis: 'PK', kode: '3.2.1.1', nama: 'Persentase mahasiswa memiliki sertifikat kompetensi nasional', level: 3, parentId: pk3_2_1.id });
await ind({ jenis: 'PK', kode: '3.2.2.1', nama: 'Persentase mahasiswa memiliki sertifikat kompetensi internasional', level: 3, parentId: pk3_2_2.id });
await ind({ jenis: 'PK', kode: '3.2.3.1', nama: 'Persentase mahasiswa yang dilibatkan dalam penelitian dosen', level: 3, parentId: pk3_2_3.id });
await ind({ jenis: 'PK', kode: '3.2.4.1', nama: 'Persentase mahasiswa yang dilibatkan dalam pengabdian kepada masyarakat dosen', level: 3, parentId: pk3_2_4.id });

const pk3_3_1 = await ind({ jenis: 'PK', kode: '3.3.1', nama: 'Jumlah dokumen kerjasama baru (MoA) dengan perguruan tinggi/industri/lembaga pemerintah/swasta', level: 2, parentId: pk3_3.id });
const pk3_3_2 = await ind({ jenis: 'PK', kode: '3.3.2', nama: 'Jumlah kegiatan sebagai implementasi kerjasama (IA) dengan perguruan tinggi/industri/lembaga pemerintah/swasta', level: 2, parentId: pk3_3.id });
const pk3_3_3 = await ind({ jenis: 'PK', kode: '3.3.3', nama: 'Jumlah dana yang diperoleh dari hasil kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta dalam negeri', level: 2, parentId: pk3_3.id });

await ind({ jenis: 'PK', kode: '3.3.1.1', nama: 'Jumlah dokumen kerjasama baru (MoA) dengan perguruan tinggi/industri/lembaga pemerintah/swasta', level: 3, parentId: pk3_3_1.id });
await ind({ jenis: 'PK', kode: '3.3.2.1', nama: 'Jumlah kegiatan sebagai implementasi kerjasama (IA) dengan perguruan tinggi/industri/lembaga pemerintah/swasta', level: 3, parentId: pk3_3_2.id });
await ind({ jenis: 'PK', kode: '3.3.3.1', nama: 'Jumlah dana yang diperoleh dari hasil kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta dalam negeri', level: 3, parentId: pk3_3_3.id });

const pk3_4_1 = await ind({ jenis: 'PK', kode: '3.4.1', nama: 'Jumlah kegiatan sebagai implementasi kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta di luar negeri', level: 2, parentId: pk3_4.id });
const pk3_4_2 = await ind({ jenis: 'PK', kode: '3.4.2', nama: 'Jumlah dana yang diterima dari kegiatan sebagai implementasi kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta di luar negeri', level: 2, parentId: pk3_4.id });

await ind({ jenis: 'PK', kode: '3.4.1.1', nama: 'Jumlah kegiatan sebagai implementasi kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta di luar negeri', level: 3, parentId: pk3_4_1.id });
await ind({ jenis: 'PK', kode: '3.4.2.1', nama: 'Jumlah dana yang diterima dari kegiatan sebagai implementasi kerjasama dengan perguruan tinggi/industri/lembaga pemerintah/swasta di luar negeri', level: 3, parentId: pk3_4_2.id });

const pkSS4 = await ind({ jenis: 'PK', kode: '4', nama: 'Meningkatnya kualitas dosen pendidikan tinggi', level: 0, parentId: null });

const pk4_1 = await ind({ jenis: 'PK', kode: '4.1', nama: 'Peningkatan Kualitas Penelitian', level: 1, parentId: pkSS4.id });
const pk4_2 = await ind({ jenis: 'PK', kode: '4.2', nama: 'Peningkatan Kualitas Pengabdian kepada Masyarakat', level: 1, parentId: pkSS4.id });
const pk4_3 = await ind({ jenis: 'PK', kode: '4.3', nama: 'Peningkatan Kualitas Luaran Penelitian', level: 1, parentId: pkSS4.id });

const pk4_1_1 = await ind({ jenis: 'PK', kode: '4.1.1', nama: 'Jumlah proposal penelitian dosen yang diajukan ke sumber pendanaan eksternal', level: 2, parentId: pk4_1.id });
const pk4_1_2 = await ind({ jenis: 'PK', kode: '4.1.2', nama: 'Jumlah proposal penelitian dosen yang lolos pendanaan eksternal', level: 2, parentId: pk4_1.id });
const pk4_1_3 = await ind({ jenis: 'PK', kode: '4.1.3', nama: 'Jumlah penelitian dosen sumber dana internal', level: 2, parentId: pk4_1.id });
const pk4_1_4 = await ind({ jenis: 'PK', kode: '4.1.4', nama: 'Persentase penelitian sesuai roadmap', level: 2, parentId: pk4_1.id });

await ind({ jenis: 'PK', kode: '4.1.1.1', nama: 'Jumlah proposal penelitian dosen yang diajukan ke sumber pendanaan eksternal', level: 3, parentId: pk4_1_1.id });
await ind({ jenis: 'PK', kode: '4.1.2.1', nama: 'Jumlah proposal penelitian dosen yang lolos pendanaan eksternal', level: 3, parentId: pk4_1_2.id });
await ind({ jenis: 'PK', kode: '4.1.3.1', nama: 'Jumlah penelitian dosen sumber dana internal', level: 3, parentId: pk4_1_3.id });
await ind({ jenis: 'PK', kode: '4.1.4.1', nama: 'Persentase penelitian sesuai roadmap', level: 3, parentId: pk4_1_4.id });

const pk4_2_1 = await ind({ jenis: 'PK', kode: '4.2.1', nama: 'Jumlah proposal pengabdian kepada masyarakat dosen yang diajukan ke sumber pendanaan eksternal', level: 2, parentId: pk4_2.id });
const pk4_2_2 = await ind({ jenis: 'PK', kode: '4.2.2', nama: 'Jumlah proposal pengabdian kepada masyarakat dosen yang lolos pendanaan eksternal', level: 2, parentId: pk4_2.id });
const pk4_2_3 = await ind({ jenis: 'PK', kode: '4.2.3', nama: 'Jumlah pengabdian kepada masyarakat sumber dana internal', level: 2, parentId: pk4_2.id });

await ind({ jenis: 'PK', kode: '4.2.1.1', nama: 'Jumlah proposal pengabdian kepada masyarakat dosen yang diajukan ke sumber pendanaan eksternal', level: 3, parentId: pk4_2_1.id });
await ind({ jenis: 'PK', kode: '4.2.2.1', nama: 'Jumlah proposal pengabdian kepada masyarakat dosen yang lolos pendanaan eksternal', level: 3, parentId: pk4_2_2.id });
await ind({ jenis: 'PK', kode: '4.2.3.1', nama: 'Jumlah pengabdian kepada masyarakat sumber dana internal', level: 3, parentId: pk4_2_3.id });

const pk4_3_1 = await ind({ jenis: 'PK', kode: '4.3.1', nama: 'Jumlah HKI/Paten/Hak Cipta', level: 2, parentId: pk4_3.id });
const pk4_3_2 = await ind({ jenis: 'PK', kode: '4.3.2', nama: 'Jumlah publikasi jurnal nasional terakreditasi', level: 2, parentId: pk4_3.id });
const pk4_3_3 = await ind({ jenis: 'PK', kode: '4.3.3', nama: 'Jumlah publikasi jurnal internasional bereputasi', level: 2, parentId: pk4_3.id });
const pk4_3_4 = await ind({ jenis: 'PK', kode: '4.3.4', nama: 'Jumlah sitasi publikasi', level: 2, parentId: pk4_3.id });
const pk4_3_5 = await ind({ jenis: 'PK', kode: '4.3.5', nama: 'Jumlah dosen sebagai keynote speaker/narasumber nasional/internasional', level: 2, parentId: pk4_3.id });
const pk4_3_6 = await ind({ jenis: 'PK', kode: '4.3.6', nama: 'Jumlah dosen terlibat dalam manuskrip buku', level: 2, parentId: pk4_3.id });

await ind({ jenis: 'PK', kode: '4.3.1.1', nama: 'Jumlah HKI/Paten/Hak Cipta', level: 3, parentId: pk4_3_1.id });
await ind({ jenis: 'PK', kode: '4.3.2.1', nama: 'Jumlah publikasi jurnal nasional terakreditasi', level: 3, parentId: pk4_3_2.id });
await ind({ jenis: 'PK', kode: '4.3.3.1', nama: 'Jumlah publikasi jurnal internasional bereputasi', level: 3, parentId: pk4_3_3.id });
await ind({ jenis: 'PK', kode: '4.3.4.1', nama: 'Jumlah sitasi publikasi', level: 3, parentId: pk4_3_4.id });
await ind({ jenis: 'PK', kode: '4.3.5.1', nama: 'Jumlah dosen sebagai keynote speaker/narasumber nasional/internasional', level: 3, parentId: pk4_3_5.id });

await ind({ jenis: 'PK', kode: '4.3.6.1', nama: 'Buku referensi baru', level: 3, parentId: pk4_3_6.id });
await ind({ jenis: 'PK', kode: '4.3.6.2', nama: 'Book chapter baru', level: 3, parentId: pk4_3_6.id });
await ind({ jenis: 'PK', kode: '4.3.6.3', nama: 'Buku ajar baru', level: 3, parentId: pk4_3_6.id });

const pkSS5 = await ind({ jenis: 'PK', kode: '5', nama: 'Meningkatnya kualitas kemahasiswaan pendidikan tinggi', level: 0, parentId: null });

const pk5_1 = await ind({ jenis: 'PK', kode: '5.1', nama: 'Peningkatan Prestasi Mahasiswa', level: 1, parentId: pkSS5.id });
const pk5_2 = await ind({ jenis: 'PK', kode: '5.2', nama: 'Peningkatan Kualitas Organisasi Kemahasiswaan', level: 1, parentId: pkSS5.id });
const pk5_3 = await ind({ jenis: 'PK', kode: '5.3', nama: 'Peningkatan Kualitas Alumni dan Tracer Study', level: 1, parentId: pkSS5.id });

const pk5_1_1 = await ind({ jenis: 'PK', kode: '5.1.1', nama: 'Jumlah prestasi mahasiswa tingkat nasional', level: 2, parentId: pk5_1.id });
const pk5_1_2 = await ind({ jenis: 'PK', kode: '5.1.2', nama: 'Jumlah prestasi mahasiswa tingkat internasional', level: 2, parentId: pk5_1.id });
const pk5_1_3 = await ind({ jenis: 'PK', kode: '5.1.3', nama: 'Jumlah mahasiswa mengikuti kompetisi/lomba', level: 2, parentId: pk5_1.id });
const pk5_1_4 = await ind({ jenis: 'PK', kode: '5.1.4', nama: 'Jumlah mahasiswa penerima program MBKM/pertukaran mahasiswa', level: 2, parentId: pk5_1.id });

await ind({ jenis: 'PK', kode: '5.1.1.1', nama: 'Jumlah prestasi mahasiswa tingkat nasional', level: 3, parentId: pk5_1_1.id });
await ind({ jenis: 'PK', kode: '5.1.2.1', nama: 'Jumlah prestasi mahasiswa tingkat internasional', level: 3, parentId: pk5_1_2.id });
await ind({ jenis: 'PK', kode: '5.1.3.1', nama: 'Jumlah mahasiswa mengikuti kompetisi/lomba', level: 3, parentId: pk5_1_3.id });
await ind({ jenis: 'PK', kode: '5.1.4.1', nama: 'Jumlah mahasiswa penerima program MBKM/pertukaran mahasiswa', level: 3, parentId: pk5_1_4.id });

const pk5_2_1 = await ind({ jenis: 'PK', kode: '5.2.1', nama: 'Jumlah kegiatan organisasi kemahasiswaan', level: 2, parentId: pk5_2.id });
const pk5_2_2 = await ind({ jenis: 'PK', kode: '5.2.2', nama: 'Jumlah organisasi mahasiswa aktif', level: 2, parentId: pk5_2.id });

await ind({ jenis: 'PK', kode: '5.2.1.1', nama: 'Jumlah kegiatan organisasi kemahasiswaan', level: 3, parentId: pk5_2_1.id });
await ind({ jenis: 'PK', kode: '5.2.2.1', nama: 'Jumlah organisasi mahasiswa aktif', level: 3, parentId: pk5_2_2.id });

const pk5_3_1 = await ind({ jenis: 'PK', kode: '5.3.1', nama: 'Persentase tracer study alumni', level: 2, parentId: pk5_3.id });
const pk5_3_2 = await ind({ jenis: 'PK', kode: '5.3.2', nama: 'Persentase alumni bekerja sesuai bidang', level: 2, parentId: pk5_3.id });

await ind({ jenis: 'PK', kode: '5.3.1.1', nama: 'Persentase tracer study alumni', level: 3, parentId: pk5_3_1.id });
await ind({ jenis: 'PK', kode: '5.3.2.1', nama: 'Persentase alumni bekerja sesuai bidang', level: 3, parentId: pk5_3_2.id });

  console.log('Seeding completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
