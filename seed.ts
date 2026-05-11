import { DataSource } from 'typeorm';
import { User } from './src/users/user.entity';
import { Role } from './src/roles/role.entity';
import { UserRole } from './src/roles/user-role.entity';
import { UserRelation } from './src/users/user_relation.entity';
import { Indikator } from './src/indikator/indikator.entity';
import { BaselineData } from './src/baseline_data/baseline_data.entity';
import { TargetUniversitas } from './src/target/target.entity';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  username: process.env.DATABASE_USERNAME || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'iku_pk',
  entities: [User, Role, UserRole, UserRelation, Indikator, BaselineData, TargetUniversitas],
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

async function findOrCreateIndikator(repo: any, data: { jenis: string; kode: string; nama: string; level: number; parentId: number | null; jenisData?: string | null }) {
  let existing = await repo.findOne({ where: { jenis: data.jenis, kode: data.kode } });
  if (existing) {
    existing.nama = data.nama;
    existing.level = data.level;
    existing.parentId = data.parentId;
    existing.jenisData = data.jenisData || null;
    return await repo.save(existing);
  }
  return await repo.save(repo.create(data));
}

async function seed() {
  console.log('Starting seed (schema reset mode)...');
  await AppDataSource.initialize();

  const userRepo = AppDataSource.getRepository(User);
  const roleRepo = AppDataSource.getRepository(Role);
  const userRoleRepo = AppDataSource.getRepository(UserRole);
  const userRelationRepo = AppDataSource.getRepository(UserRelation);
  const indikatorRepo = AppDataSource.getRepository(Indikator);
  const baselineRepo = AppDataSource.getRepository(BaselineData);
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
  const tendikUser     = await upsertUser(userRepo, { nip: '504', nama: 'Tendik FIK',       email: 'tendik@fik.ac.id',       password: '000000', jenis: 'Tendik' });
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
  await upsertUserRole(userRoleRepo, { userId: tendikUser.id, roleId: tendikRole.id,  isPrimary: true });
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

  console.log('Seeding completed successfully!');
  await AppDataSource.destroy();
}

seed().catch((error) => {
  console.error('Error during seeding:', error);
  process.exit(1);
});
