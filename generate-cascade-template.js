// generate-cascade-template.js
// Run: node generate-cascade-template.js
// Output: cascade-template.xlsx

const XLSX = require('xlsx');
const path = require('path');

// ─── DATA IKU ─────────────────────────────────────────────────────────────────
const ikuRows = [
  { kode:'1',     nama:'Talenta',                                                                                                                                              level:0, sasaran:'1. Talenta',   kategori:'Wajib'   },
  { kode:'1.1',   nama:'Angka Efisiensi Edukasi Perguruan Tinggi (AEE PT)',                                                                                                   level:1, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.1.1', nama:'D3',                                                                                                                                                  level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.1.2', nama:'S1',                                                                                                                                                  level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.1.3', nama:'S2',                                                                                                                                                  level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.2',   nama:'Persentase mahasiswa pascasarjana terhadap total mahasiswa',                                                                                          level:1, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.2.1', nama:'Mahasiswa magister',                                                                                                                                  level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.2.2', nama:'Mahasiswa doktor',                                                                                                                                    level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.3',   nama:'Persentase mahasiswa internasional',                                                                                                                  level:1, sasaran:'1. Talenta',   kategori:''        },
  { kode:'1.3.1', nama:'Persentase mahasiswa internasional',                                                                                                                  level:2, sasaran:'1. Talenta',   kategori:''        },
  { kode:'2',     nama:'Talenta',                                                                                                                                              level:0, sasaran:'2. Talenta',   kategori:'Wajib'   },
  { kode:'2.1',   nama:'Persentase lulusan PT akademik & vokasi yang langsung bekerja/lanjut/wirausaha dalam 1 tahun',                                                        level:1, sasaran:'2. Talenta',   kategori:''        },
  { kode:'2.1.1', nama:'Persentase lulusan PT akademik & vokasi yang langsung bekerja/lanjut/wirausaha dalam 1 tahun',                                                        level:2, sasaran:'2. Talenta',   kategori:''        },
  { kode:'3',     nama:'Talenta',                                                                                                                                              level:0, sasaran:'3. Talenta',   kategori:'Wajib'   },
  { kode:'3.1',   nama:'Persentase mahasiswa S1 & D4/D3/D2/D1 berkegiatan/meraih prestasi di luar program studi',                                                            level:1, sasaran:'3. Talenta',   kategori:''        },
  { kode:'3.1.1', nama:'Persentase mahasiswa S1 & D4/D3/D2/D1 berkegiatan/meraih prestasi di luar program studi',                                                            level:2, sasaran:'3. Talenta',   kategori:''        },
  { kode:'4',     nama:'Talenta',                                                                                                                                              level:0, sasaran:'4. Talenta',   kategori:'Pilihan' },
  { kode:'4.1',   nama:'Persentase dosen PT yang mendapatkan rekognisi internasional',                                                                                        level:1, sasaran:'4. Talenta',   kategori:''        },
  { kode:'4.1.1', nama:'Persentase dosen PT yang mendapatkan rekognisi internasional',                                                                                        level:2, sasaran:'4. Talenta',   kategori:''        },
  { kode:'4.2',   nama:'Persentase dosen berpendidikan S3',                                                                                                                   level:1, sasaran:'4. Talenta',   kategori:''        },
  { kode:'4.2.1', nama:'Persentase dosen berpendidikan S3',                                                                                                                   level:2, sasaran:'4. Talenta',   kategori:''        },
  { kode:'5',     nama:'Inovasi',                                                                                                                                              level:0, sasaran:'5. Inovasi',   kategori:'Wajib'   },
  { kode:'5.1',   nama:'Jumlah luaran penelitian & PkM yang berhasil mendapat rekognisi internasional atau diterapkan masyarakat per jumlah dosen',                           level:1, sasaran:'5. Inovasi',   kategori:''        },
  { kode:'5.1.1', nama:'Jumlah luaran penelitian dan pengabdian kepada masyarakat',                                                                                           level:2, sasaran:'5. Inovasi',   kategori:''        },
  { kode:'6',     nama:'Inovasi',                                                                                                                                              level:0, sasaran:'6. Inovasi',   kategori:'Pilihan' },
  { kode:'6.1',   nama:'Publikasi bereputasi internasional (Scopus/WoS)',                                                                                                     level:1, sasaran:'6. Inovasi',   kategori:''        },
  { kode:'6.1.1', nama:'Artikel Scopus/WoS',                                                                                                                                  level:2, sasaran:'6. Inovasi',   kategori:''        },
  { kode:'6.1.2', nama:'Buku',                                                                                                                                                 level:2, sasaran:'6. Inovasi',   kategori:''        },
  { kode:'6.1.3', nama:'Prosiding Internasional',                                                                                                                              level:2, sasaran:'6. Inovasi',   kategori:''        },
  { kode:'6.1.4', nama:'HKI/Paten',                                                                                                                                            level:2, sasaran:'6. Inovasi',   kategori:''        },
  { kode:'7',     nama:'Inovasi',                                                                                                                                              level:0, sasaran:'7. Inovasi',   kategori:'Wajib'   },
  { kode:'7.1',   nama:'Persentase kegiatan penelitian dan PkM yang melibatkan mahasiswa',                                                                                    level:1, sasaran:'7. Inovasi',   kategori:''        },
  { kode:'7.1.1', nama:'Buku',                                                                                                                                                 level:2, sasaran:'7. Inovasi',   kategori:''        },
  { kode:'7.1.2', nama:'Mata Kuliah',                                                                                                                                          level:2, sasaran:'7. Inovasi',   kategori:''        },
  { kode:'7.1.3', nama:'Judul Penelitian',                                                                                                                                     level:2, sasaran:'7. Inovasi',   kategori:''        },
  { kode:'7.1.4', nama:'Judul Pengabdian',                                                                                                                                     level:2, sasaran:'7. Inovasi',   kategori:''        },
  { kode:'8',     nama:'Kontribusi pada Masyarakat',                                                                                                                           level:0, sasaran:'8. Kontribusi',kategori:'Pilihan' },
  { kode:'8.1',   nama:'Persentase SDM PT (dosen & peneliti) yang terlibat langsung dalam penyusunan kebijakan (nasional/daerah/industri)',                                   level:1, sasaran:'8. Kontribusi',kategori:''        },
  { kode:'8.1.1', nama:'Persentase SDM PT (dosen & peneliti) yang terlibat langsung dalam penyusunan kebijakan (nasional/daerah/industri)',                                   level:2, sasaran:'8. Kontribusi',kategori:''        },
  { kode:'10',    nama:'Tata Kelola berintegritas',                                                                                                                            level:0, sasaran:'10. Tata Kelola',kategori:'Pilihan'},
  { kode:'10.1',  nama:'Jumlah usulan Zona Integritas - WBK/WBBM',                                                                                                            level:1, sasaran:'10. Tata Kelola',kategori:''       },
  { kode:'10.1.1',nama:'Jumlah usulan Zona Integritas - WBK/WBBM',                                                                                                            level:2, sasaran:'10. Tata Kelola',kategori:''       },
];

// ─── DATA PK ─────────────────────────────────────────────────────────────────
const pkRows = [
  { kode:'1',        nama:'Meningkatnya tata kelola satuan kerja di lingkungan UPN Veteran Jakarta',level:0,sasaran:'1. Tata Kelola' },
  { kode:'1.1',      nama:'Peningkatan Tata Kelola Akademik',                                        level:1,sasaran:'1. Tata Kelola' },
  { kode:'1.1.1',    nama:'Ketersediaan Rencana Strategis Bisnis (RSB)',                              level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.1.1',  nama:'Penyusunan revisi RSB Fakultas',                                          level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.1.2',  nama:'Program kerja dan KKOP 2026',                                             level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.2',    nama:'Pemutakhiran Pedoman Akademik TA. 2026/2027',                              level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.2.1',  nama:'Pemutakhiran Pedoman Akademik TA. 2026/2027',                              level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.3',    nama:'Strategi pencapaian PK dan risk register 2026',                            level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.3.1',  nama:'Strategi pencapaian PK dan risk register 2026',                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.4',    nama:'Kalender Kegiatan Operasional Fakultas (KKOF) tahun 2026',                 level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.4.1',  nama:'KKOF tahun 2026 tercetak dan terdistribusi',                               level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.5',    nama:'Pemberitaan kegiatan melalui web Fakultas',                                level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.5.1',  nama:'Pemberitaan kegiatan melalui web Fakultas',                                level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.6',    nama:'Pelaporan PDDIKTI',                                                        level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.6.1',  nama:'Semester Genap TA 2025/2026',                                              level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.6.2',  nama:'Semester Ganjil TA. 2026/2027',                                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.7',    nama:'Laporan Pemutakhiran Mahasiswa Tidak Aktif sesuai Angkatan',               level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.7.1',  nama:'Laporan Pemutakhiran Mahasiswa Tidak Aktif sesuai Angkatan',               level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.8',    nama:'Pelaporan Akademik',                                                        level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.8.1',  nama:'Semester Genap TA 2025/2026',                                              level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.8.2',  nama:'Semester Ganjil TA. 2026/2027',                                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.9',    nama:'Laporan Rapat Tinjauan Manajemen (RTM)',                                   level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.9.1',  nama:'Laporan Rapat Tinjauan Manajemen (RTM)',                                   level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.10',   nama:'SKP Tendik dan Dosen',                                                     level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.10.1', nama:'Rencana SKP tendik dan dosen Tahun 2026',                                  level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.10.2', nama:'Penilaian SKP tendik dan dosen Tahun 2025',                                level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.11',   nama:'Penyusunan LKPS dan LED sesuai Format BAN-PT/LAM',                        level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.11.1', nama:'Penyusunan LKPS dan LED sesuai Format BAN-PT/LAM',                        level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.12',   nama:'Pelaksanaan Audit Mutu Internal (AMI) di tingkat program studi',           level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.12.1', nama:'Pelaksanaan AMI di tingkat program studi',                                 level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.13',   nama:'Tingkat Penyelesaian Temuan AMI Tahun Sebelumnya',                         level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.13.1', nama:'Tingkat Penyelesaian Temuan AMI Tahun Sebelumnya',                         level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.14',   nama:'Program Studi Memenuhi dan Melampaui Standar AMI',                         level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.14.1', nama:'Program Studi Memenuhi dan Melampaui Standar AMI',                         level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.15',   nama:'Pelaksanaan Monev Persiapan Pembelajaran',                                 level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.15.1', nama:'Pelaksanaan Monev Persiapan Pembelajaran',                                 level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.16',   nama:'Pelaksanaan Monev Proses Pembelajaran',                                    level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.16.1', nama:'Pelaksanaan Monev Proses Pembelajaran',                                    level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.17',   nama:'Pelaksanaan Monev Laboratorium',                                            level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.17.1', nama:'Pelaksanaan Monev Laboratorium',                                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.18',   nama:'Pelaksanaan Monev Penelitian dan PkM',                                     level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.18.1', nama:'Pelaksanaan Monev Penelitian dan PkM',                                     level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.19',   nama:'Laporan Risk Register TA. 2025/2026',                                      level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.19.1', nama:'Laporan Risk Register TA. 2025/2026',                                      level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.20',   nama:'Reakreditasi Program Studi',                                               level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.20.1', nama:'Reakreditasi Program Studi',                                               level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.21',   nama:'Ketersediaan dokumen laporan evaluasi survey kepuasan SPM (8 aspek)',       level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.21.1', nama:'Ketersediaan dokumen laporan evaluasi survey kepuasan SPM (8 aspek)',       level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.22',   nama:'Publikasi hasil evaluasi survey kepuasan SPM (8 aspek)',                    level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.22.1', nama:'Publikasi hasil evaluasi survey kepuasan SPM (8 aspek)',                    level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.23',   nama:'Inovasi layanan pendidikan',                                               level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.23.1', nama:'Inovasi layanan pendidikan',                                               level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.1.24',   nama:'Pemutakhiran Data SINTA Dosen',                                            level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.1.24.1', nama:'Pemutakhiran Data SINTA Dosen',                                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2',      nama:'Peningkatan Tata Kelola Non Akademik',                                     level:1,sasaran:'1. Tata Kelola' },
  { kode:'1.2.1',    nama:'Persentase Penurunan Nilai Piutang UKT dan/atau SPI',                      level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.1.1',  nama:'Persentase Penurunan Nilai Piutang UKT dan/atau SPI',                      level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.2',    nama:'Persentase Pendapatan dari optimalisasi aset',                              level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.2.1',  nama:'Persentase Pendapatan dari optimalisasi aset',                              level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.3',    nama:'Persentase kesesuaian LPJ dengan RPD Internal',                            level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.3.1',  nama:'Persentase kesesuaian LPJ dengan RPD Internal',                            level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.4',    nama:'Jumlah revisi POK',                                                        level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.4.1',  nama:'Jumlah revisi POK',                                                        level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.5',    nama:'Laporan Kinerja Sub Satker Tahun 2026',                                    level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.5.1',  nama:'Laporan Kinerja Sub Satker Tahun 2026',                                    level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.6',    nama:'Jumlah surveyor pada pemeringkatan Internasional QS',                      level:2,sasaran:'1. Tata Kelola' },
  { kode:'1.2.6.1',  nama:'Pemenuhan surveyor QS akademik dalam negeri',                              level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.6.2',  nama:'Pemenuhan surveyor QS akademik luar negeri',                               level:3,sasaran:'1. Tata Kelola' },
  { kode:'1.2.6.3',  nama:'Pemenuhan surveyor QS employer dalam negeri dan luar negeri',              level:3,sasaran:'1. Tata Kelola' },
  { kode:'2',        nama:'Meningkatnya kualitas lulusan pendidikan tinggi',                           level:0,sasaran:'2. Kualitas Lulusan' },
  { kode:'2.1',      nama:'Pengelolaan bimbingan konseling',                                           level:1,sasaran:'2. Kualitas Lulusan' },
  { kode:'2.1.1',    nama:'Pengelolaan bimbingan konseling',                                           level:2,sasaran:'2. Kualitas Lulusan' },
  { kode:'2.1.1.1',  nama:'Pengelolaan bimbingan konseling',                                           level:3,sasaran:'2. Kualitas Lulusan' },
  { kode:'3',        nama:'Meningkatkan kualitas kurikulum dan pembelajaran',                          level:0,sasaran:'3. Kurikulum' },
  { kode:'3.1',      nama:'Peningkatan Kualitas Kurikulum dan Pembelajaran',                           level:1,sasaran:'3. Kurikulum' },
  { kode:'3.1.1',    nama:'% kegiatan/judul penelitian yang terintegrasi dengan mata kuliah',          level:2,sasaran:'3. Kurikulum' },
  { kode:'3.1.1.1',  nama:'% kegiatan/judul penelitian yang terintegrasi dengan mata kuliah',          level:3,sasaran:'3. Kurikulum' },
  { kode:'3.1.2',    nama:'% kegiatan/judul PkM yang terintegrasi dengan mata kuliah',                level:2,sasaran:'3. Kurikulum' },
  { kode:'3.1.2.1',  nama:'% kegiatan/judul PkM yang terintegrasi dengan mata kuliah',                level:3,sasaran:'3. Kurikulum' },
  { kode:'3.1.3',    nama:'Suasana akademik selain perkuliahan',                                       level:2,sasaran:'3. Kurikulum' },
  { kode:'3.1.3.1',  nama:'Kuliah umum dengan pembicara academic leader/tokoh/pimpinan nasional',     level:3,sasaran:'3. Kurikulum' },
  { kode:'3.1.3.2',  nama:'Bedah buku best seller nasional/internasional',                            level:3,sasaran:'3. Kurikulum' },
  { kode:'3.1.3.3',  nama:'Diskusi ilmiah tingkat jurusan/pelatihan metodologi',                      level:3,sasaran:'3. Kurikulum' },
  { kode:'3.2',      nama:'Peningkatan Kualitas Mahasiswa',                                            level:1,sasaran:'3. Kurikulum' },
  { kode:'3.2.1',    nama:'% mahasiswa memiliki sertifikat kompetensi nasional',                       level:2,sasaran:'3. Kurikulum' },
  { kode:'3.2.1.1',  nama:'% mahasiswa memiliki sertifikat kompetensi nasional',                       level:3,sasaran:'3. Kurikulum' },
  { kode:'3.2.2',    nama:'% mahasiswa memiliki sertifikat kompetensi internasional',                  level:2,sasaran:'3. Kurikulum' },
  { kode:'3.2.2.1',  nama:'% mahasiswa memiliki sertifikat kompetensi internasional',                  level:3,sasaran:'3. Kurikulum' },
  { kode:'3.2.3',    nama:'% mahasiswa yang dilibatkan dalam penelitian dosen',                        level:2,sasaran:'3. Kurikulum' },
  { kode:'3.2.3.1',  nama:'% mahasiswa yang dilibatkan dalam penelitian dosen',                        level:3,sasaran:'3. Kurikulum' },
  { kode:'3.2.4',    nama:'% mahasiswa yang dilibatkan dalam PkM dosen',                               level:2,sasaran:'3. Kurikulum' },
  { kode:'3.2.4.1',  nama:'% mahasiswa yang dilibatkan dalam PkM dosen',                               level:3,sasaran:'3. Kurikulum' },
  { kode:'3.3',      nama:'Peningkatan Kualitas Kerjasama Dalam Negeri di Bidang Akademik',            level:1,sasaran:'3. Kurikulum' },
  { kode:'3.3.1',    nama:'Jumlah dokumen kerjasama baru (MoA)',                                       level:2,sasaran:'3. Kurikulum' },
  { kode:'3.3.1.1',  nama:'Jumlah dokumen kerjasama baru (MoA)',                                       level:3,sasaran:'3. Kurikulum' },
  { kode:'3.3.2',    nama:'Jumlah kegiatan implementasi kerjasama (IA)',                               level:2,sasaran:'3. Kurikulum' },
  { kode:'3.3.2.1',  nama:'Jumlah kegiatan implementasi kerjasama (IA)',                               level:3,sasaran:'3. Kurikulum' },
  { kode:'3.3.3',    nama:'Jumlah dana dari kerjasama dalam negeri',                                   level:2,sasaran:'3. Kurikulum' },
  { kode:'3.3.3.1',  nama:'Jumlah dana dari kerjasama dalam negeri',                                   level:3,sasaran:'3. Kurikulum' },
  { kode:'3.4',      nama:'Peningkatan Kualitas Kerjasama Luar Negeri di Bidang Akademik',             level:1,sasaran:'3. Kurikulum' },
  { kode:'3.4.1',    nama:'Jumlah kegiatan implementasi kerjasama luar negeri',                        level:2,sasaran:'3. Kurikulum' },
  { kode:'3.4.1.1',  nama:'Jumlah kegiatan implementasi kerjasama luar negeri',                        level:3,sasaran:'3. Kurikulum' },
  { kode:'3.4.2',    nama:'Jumlah dana dari kerjasama luar negeri',                                    level:2,sasaran:'3. Kurikulum' },
  { kode:'3.4.2.1',  nama:'Jumlah dana dari kerjasama luar negeri',                                    level:3,sasaran:'3. Kurikulum' },
  { kode:'4',        nama:'Meningkatnya kualitas dosen pendidikan tinggi',                             level:0,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1',      nama:'Peningkatan Kualitas Penelitian',                                           level:1,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.1',    nama:'Jumlah proposal penelitian dosen yang diajukan ke pendanaan eksternal',     level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.1.1',  nama:'Jumlah proposal penelitian dosen yang diajukan ke pendanaan eksternal',     level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.2',    nama:'Jumlah proposal penelitian dosen yang lolos pendanaan eksternal',           level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.2.1',  nama:'Jumlah proposal penelitian dosen yang lolos pendanaan eksternal',           level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.3',    nama:'Jumlah penelitian dosen sumber dana internal',                              level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.3.1',  nama:'Jumlah penelitian dosen sumber dana internal',                              level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.4',    nama:'Persentase penelitian sesuai roadmap',                                      level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.1.4.1',  nama:'Persentase penelitian sesuai roadmap',                                      level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2',      nama:'Peningkatan Kualitas Pengabdian kepada Masyarakat',                         level:1,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.1',    nama:'Jumlah proposal PkM dosen yang diajukan ke pendanaan eksternal',            level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.1.1',  nama:'Jumlah proposal PkM dosen yang diajukan ke pendanaan eksternal',            level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.2',    nama:'Jumlah proposal PkM dosen yang lolos pendanaan eksternal',                  level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.2.1',  nama:'Jumlah proposal PkM dosen yang lolos pendanaan eksternal',                  level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.3',    nama:'Jumlah PkM dosen sumber dana internal',                                    level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.2.3.1',  nama:'Jumlah PkM dosen sumber dana internal',                                    level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3',      nama:'Peningkatan Kualitas Luaran Penelitian',                                    level:1,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.1',    nama:'Jumlah HKI/Paten/Hak Cipta',                                               level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.1.1',  nama:'Jumlah HKI/Paten/Hak Cipta',                                               level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.2',    nama:'Jumlah publikasi jurnal nasional terakreditasi',                            level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.2.1',  nama:'Jumlah publikasi jurnal nasional terakreditasi',                            level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.3',    nama:'Jumlah publikasi jurnal internasional bereputasi',                          level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.3.1',  nama:'Jumlah publikasi jurnal internasional bereputasi',                          level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.4',    nama:'Jumlah sitasi publikasi',                                                  level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.4.1',  nama:'Jumlah sitasi publikasi',                                                  level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.5',    nama:'Jumlah dosen sebagai keynote speaker/narasumber nasional/internasional',    level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.5.1',  nama:'Jumlah dosen sebagai keynote speaker/narasumber nasional/internasional',    level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.6',    nama:'Jumlah dosen terlibat dalam manuskrip buku',                               level:2,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.6.1',  nama:'Buku referensi baru',                                                      level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.6.2',  nama:'Book chapter baru',                                                        level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'4.3.6.3',  nama:'Buku ajar baru',                                                           level:3,sasaran:'4. Kualitas Dosen' },
  { kode:'5',        nama:'Meningkatnya kualitas kemahasiswaan pendidikan tinggi',                     level:0,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1',      nama:'Peningkatan Prestasi Mahasiswa',                                            level:1,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.1',    nama:'Jumlah prestasi mahasiswa tingkat nasional',                                level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.1.1',  nama:'Jumlah prestasi mahasiswa tingkat nasional',                               level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.2',    nama:'Jumlah prestasi mahasiswa tingkat internasional',                           level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.2.1',  nama:'Jumlah prestasi mahasiswa tingkat internasional',                           level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.3',    nama:'Jumlah mahasiswa mengikuti kompetisi/lomba',                               level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.3.1',  nama:'Jumlah mahasiswa mengikuti kompetisi/lomba',                               level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.4',    nama:'Jumlah mahasiswa penerima program MBKM/pertukaran mahasiswa',               level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.1.4.1',  nama:'Jumlah mahasiswa penerima program MBKM/pertukaran mahasiswa',               level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.2',      nama:'Peningkatan Kualitas Organisasi Kemahasiswaan',                             level:1,sasaran:'5. Kemahasiswaan' },
  { kode:'5.2.1',    nama:'Jumlah kegiatan organisasi kemahasiswaan',                                 level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.2.1.1',  nama:'Jumlah kegiatan organisasi kemahasiswaan',                                 level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.2.2',    nama:'Jumlah organisasi mahasiswa aktif',                                        level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.2.2.1',  nama:'Jumlah organisasi mahasiswa aktif',                                        level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.3',      nama:'Peningkatan Kualitas Alumni dan Tracer Study',                              level:1,sasaran:'5. Kemahasiswaan' },
  { kode:'5.3.1',    nama:'Persentase tracer study alumni',                                            level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.3.1.1',  nama:'Persentase tracer study alumni',                                            level:3,sasaran:'5. Kemahasiswaan' },
  { kode:'5.3.2',    nama:'Persentase alumni bekerja sesuai bidang',                                   level:2,sasaran:'5. Kemahasiswaan' },
  { kode:'5.3.2.1',  nama:'Persentase alumni bekerja sesuai bidang',                                   level:3,sasaran:'5. Kemahasiswaan' },
];

// ─── DATA PENGGUNA PER UNIT ───────────────────────────────────────────────────
const UNITS = {
  'S1 SI FIXED': {
    unit: 'S1 Sistem Informasi',
    cascade: [
      { langkah: 1, role: 'Wakil Dekan 1 + Wakil Dekan 2 + Wakil Dekan 3', level: 'Level 1 (FIK)', keterangan: 'Satu langkah bersamaan (multi-role)' },
      { langkah: 2, role: 'Kepala Jurusan (S1 Sistem Informasi)',            level: 'Level 2',       keterangan: '' },
      { langkah: 3, role: 'Koordinator Prodi (S1 Sistem Informasi)',         level: 'Level 3',       keterangan: '' },
      { langkah: 4, role: 'Dosen (S1 Sistem Informasi)',                     level: 'Level 4',       keterangan: 'Penerima akhir' },
    ],
    users: [
      { levelRole:'Level 1', role:'Wakil Dekan 1',          nip:'302', nama:'Erly Krisnanik, S.Kom., MM.',                    email:'erly.krisnanik@fik.ac.id'    },
      { levelRole:'Level 1', role:'Wakil Dekan 2',          nip:'303', nama:'Dr. Bambang Saras Yuliastiawan, S.T., M.Kom.',   email:'bambang.saras@fik.ac.id'     },
      { levelRole:'Level 1', role:'Wakil Dekan 3',          nip:'304', nama:'Ati Zaidiah, S.Kom., MTI.',                      email:'ati.zaidiah@fik.ac.id'       },
      { levelRole:'Level 2', role:'Kepala Jurusan SI',      nip:'401', nama:'Kajur SI',                                        email:'kajur.si@fik.ac.id'          },
      { levelRole:'Level 3', role:'Koordinator Prodi SI',   nip:'605', nama:'Anita Muliati, S.Kom., MTI.',                    email:'anita.muliati@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'601', nama:'Dosen SI 1',                                     email:'dosen1.si@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'602', nama:'Dosen SI 2',                                     email:'dosen2.si@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'604', nama:'Dr. Susanto, M.Kom.',                             email:'susanto@fik.ac.id'           },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'606', nama:'Rio Wirawan, S.Kom., MMSI.',                     email:'rio.wirawan@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'607', nama:'Dr. Tjajanto, S.Kom., MM.',                      email:'tjajanto@fik.ac.id'          },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'611', nama:'Bambang Tri Wahyono, S.Kom., M.Si.',             email:'bambang.tri@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'612', nama:'I Wayan Widi Pradnyana, M.TI',                   email:'iwayan@fik.ac.id'            },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'613', nama:'Kraugusteeliana, S.Kom., M.Kom., MM.',           email:'kraugusteeliana@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'615', nama:'Catur Nugrahaeni Puspita Dewi, S.Kom., M.Kom.', email:'catur.nugrahaeni@fik.ac.id'  },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'616', nama:'Ria Astriratma, S.Kom., M.Cs.',                  email:'ria.astriratma@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'617', nama:'Ruth Mariana Bunga Wadu, S.Kom., MMSI',          email:'ruth.wadu@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'618', nama:'Sarika, M.Kom.',                                  email:'sarika@fik.ac.id'            },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'619', nama:'Artika Arista, S.Kom., MMSI',                    email:'artika.arista@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'620', nama:'Ika Nurlaili, S.Kom., M.Sc.',                    email:'ika.nurlaili@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'621', nama:'Zatin Niqotaini, S.Tr.Kom., M.Kom.',             email:'zatin@fik.ac.id'             },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'622', nama:'Rifka Dwi Amalia, S.Pd., M.Kom.',                email:'rifka.amalia@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'623', nama:'Ade Hikma Tiana, S.Kom., M.Kom.',                email:'ade.hikma@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen SI',               nip:'624', nama:'Mardiah, S.Si., M.Kom.',                         email:'mardiah@fik.ac.id'           },
    ],
  },
  'S1 IF FIXED': {
    unit: 'S1 Informatika',
    cascade: [
      { langkah: 1, role: 'Wakil Dekan 1 + Wakil Dekan 2 + Wakil Dekan 3', level: 'Level 1 (FIK)', keterangan: 'Satu langkah bersamaan (multi-role)' },
      { langkah: 2, role: 'Kepala Jurusan (S1 Informatika)',                 level: 'Level 2',       keterangan: '' },
      { langkah: 3, role: 'Koordinator Prodi (S1 Informatika)',              level: 'Level 3',       keterangan: '' },
      { langkah: 4, role: 'Dosen (S1 Informatika)',                          level: 'Level 4',       keterangan: 'Penerima akhir' },
    ],
    users: [
      { levelRole:'Level 1', role:'Wakil Dekan 1',          nip:'302', nama:'Erly Krisnanik, S.Kom., MM.',                    email:'erly.krisnanik@fik.ac.id'    },
      { levelRole:'Level 1', role:'Wakil Dekan 2',          nip:'303', nama:'Dr. Bambang Saras Yuliastiawan, S.T., M.Kom.',   email:'bambang.saras@fik.ac.id'     },
      { levelRole:'Level 1', role:'Wakil Dekan 3',          nip:'304', nama:'Ati Zaidiah, S.Kom., MTI.',                      email:'ati.zaidiah@fik.ac.id'       },
      { levelRole:'Level 2', role:'Kepala Jurusan IF',      nip:'402', nama:'Kajur Informatika',                               email:'kajur.if@fik.ac.id'          },
      { levelRole:'Level 3', role:'Koordinator Prodi IF',   nip:'707', nama:"Dr. Ridwan Raafi'udin, S.Kom., M.Kom.",          email:'ridwan.raafiudin@fik.ac.id'  },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'603', nama:'Dosen IF 1',                                     email:'dosen1.if@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'701', nama:'Dr. Widya Cholil, M.I.T',                        email:'widya.cholil@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'702', nama:'Radinal Setyadinsa, S.Pd., M.T.I',               email:'radinal.setyadinsa@fik.ac.id'},
      { levelRole:'Level 4', role:'Dosen IF',               nip:'703', nama:'Dr. Didit Widiyanto, S.Kom., M.Si.',             email:'didit.widiyanto@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'704', nama:'Jayanta, S.Kom., M.Si',                          email:'jayanta@fik.ac.id'           },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'705', nama:'Henki Bayu Seta, S.Kom., MTI.',                  email:'henki.bayu@fik.ac.id'        },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'706', nama:'Dr. Indra Permana Solihin, S.Kom., M.Kom.',     email:'indra.permana@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'708', nama:'Noor Falih, S.Kom., M.T.',                       email:'noor.falih@fik.ac.id'        },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'709', nama:'Ichsan Mardani, S.Kom., M.Sc.',                  email:'ichsan.mardani@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'710', nama:'Desta Sandya Prasvita, S.Komp., M.Kom.',         email:'desta.sandya@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'711', nama:'Mayanda Mega Santoni, S.Komp., M.Kom.',          email:'mayanda.santoni@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'712', nama:'Nurul Chamidah, S.Kom., M.Kom.',                 email:'nurul.chamidah@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'713', nama:'Bayu Hananto, S.Kom., M.Kom.',                   email:'bayu.hananto@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'714', nama:'Hamonangan Kinantan Prabu, M.T.',                email:'hamonangan.prabu@fik.ac.id'  },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'715', nama:'Neny Rosmawarni, M.Kom.',                        email:'neny.rosmawarni@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'716', nama:'I Wayan Rangga Pinastawa, M.Kom.',               email:'iwayan.rangga@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'717', nama:'Kharisma Wiati Gusti, M.T.',                     email:'kharisma.wiati@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'718', nama:'Nurhuda Maulana, S.T., M.T.',                    email:'nurhuda.maulana@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'719', nama:'Nurul Afifah Arifuddin, S.Pd., M.T.',            email:'nurul.afifah@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'720', nama:'Sanggi Bayu Ardika, S.Kom., M.Kom.',             email:'sanggi.bayu@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'721', nama:'Anis Fitri Nur Masruiyah, S.Kom., M.Kom.',       email:'anis.fitri@fik.ac.id'        },
      { levelRole:'Level 4', role:'Dosen IF',               nip:'722', nama:'Wildan Alrasyid, M.Si.',                         email:'wildan.alrasyid@fik.ac.id'   },
    ],
  },
  'D3 SI FIXED': {
    unit: 'D3 Sistem Informasi',
    cascade: [
      { langkah: 1, role: 'Wakil Dekan 1 + Wakil Dekan 2 + Wakil Dekan 3', level: 'Level 1 (FIK)', keterangan: 'Satu langkah bersamaan (multi-role)' },
      { langkah: 2, role: 'Koordinator Prodi (D3 Sistem Informasi)',         level: 'Level 3',       keterangan: '(Tidak ada Kajur untuk D3)' },
      { langkah: 3, role: 'Dosen (D3 Sistem Informasi)',                     level: 'Level 4',       keterangan: 'Penerima akhir' },
    ],
    users: [
      { levelRole:'Level 1', role:'Wakil Dekan 1',          nip:'302', nama:'Erly Krisnanik, S.Kom., MM.',                    email:'erly.krisnanik@fik.ac.id'    },
      { levelRole:'Level 1', role:'Wakil Dekan 2',          nip:'303', nama:'Dr. Bambang Saras Yuliastiawan, S.T., M.Kom.',   email:'bambang.saras@fik.ac.id'     },
      { levelRole:'Level 1', role:'Wakil Dekan 3',          nip:'304', nama:'Ati Zaidiah, S.Kom., MTI.',                      email:'ati.zaidiah@fik.ac.id'       },
      { levelRole:'Level 3', role:'Koordinator Prodi D3 SI',nip:'614', nama:'Andhika Octa Indarso, M.MSI',                    email:'andhika.octa@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'901', nama:'Rizky Tito Prasetyo, S.Si., M.T.I.',             email:'rizky.tito@fik.ac.id'        },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'902', nama:'Bobby Suryo Prakoso, S.T., M.Kom.',              email:'bobby.suryo@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'903', nama:'Budi Arif Dermawan, M.Kom.',                     email:'budi.arif@fik.ac.id'         },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'904', nama:'Galih Prakoso Rizky A, S.Kom., MMSI.',           email:'galih.prakoso@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'905', nama:'Rasenda, A.Md., S.Kom., M.Kom.',                 email:'rasenda@fik.ac.id'           },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'906', nama:'Rr Octanty Mulianingtyas, S.Kom., M.Sc.',        email:'octanty.mulianingtyas@fik.ac.id'},
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'907', nama:'Dra. Intan Hesti Indriana, MM.',                 email:'intan.hesti@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'908', nama:'Iin Ernawati, S.Kom., M.Si.',                    email:'iin.ernawati@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'909', nama:'Theresia Wati, S.Kom., MTI.',                    email:'theresia.wati@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'910', nama:'Tri Rahayu, S.Kom., MM.',                        email:'tri.rahayu@fik.ac.id'        },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'911', nama:'Nur Hafifah Matondang, S.Kom., MM.',             email:'nur.hafifah@fik.ac.id'       },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'912', nama:'M. Bayu Wibisono, S.Kom.',                       email:'bayu.wibisono@fik.ac.id'     },
      { levelRole:'Level 4', role:'Dosen D3 SI',            nip:'913', nama:'Helena Nurramdhani Irmanda, S.Pd., M.Kom.',      email:'helena.nurramdhani@fik.ac.id'},
    ],
  },
  'S1 SD FIXED': {
    unit: 'S1 Data Science',
    cascade: [
      { langkah: 1, role: 'Wakil Dekan 1 + Wakil Dekan 2 + Wakil Dekan 3', level: 'Level 1 (FIK)', keterangan: 'Satu langkah bersamaan (multi-role)' },
      { langkah: 2, role: 'Koordinator Prodi (S1 Data Science)',             level: 'Level 3',       keterangan: '(Tidak ada Kajur Data Science yang aktif)' },
      { langkah: 3, role: 'Dosen (S1 Data Science)',                         level: 'Level 4',       keterangan: 'Penerima akhir' },
    ],
    users: [
      { levelRole:'Level 1', role:'Wakil Dekan 1',          nip:'302', nama:'Erly Krisnanik, S.Kom., MM.',                    email:'erly.krisnanik@fik.ac.id'    },
      { levelRole:'Level 1', role:'Wakil Dekan 2',          nip:'303', nama:'Dr. Bambang Saras Yuliastiawan, S.T., M.Kom.',   email:'bambang.saras@fik.ac.id'     },
      { levelRole:'Level 1', role:'Wakil Dekan 3',          nip:'304', nama:'Ati Zaidiah, S.Kom., MTI.',                      email:'ati.zaidiah@fik.ac.id'       },
      { levelRole:'Level 3', role:'Koordinator Prodi SD',   nip:'802', nama:'Novi Trisman Hadi, S.Pd., M.Kom.',               email:'novi.trisman@fik.ac.id'      },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'801', nama:'Dr. Hengki Tamando Sihotang, S.Kom., M.Kom.',    email:'hengki.tamando@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'803', nama:'Musthofa Galih Pradana, M.Kom.',                  email:'musthofa.galih@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'804', nama:'Muhammad Adrezo, S.Kom., M.Sc.',                  email:'muhammad.adrezo@fik.ac.id'   },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'805', nama:'Nindy Irzavika, S.Si., M.T.',                    email:'nindy.irzavika@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'806', nama:'Muhammad Panji Muslim, S.Pd., M.Kom.',            email:'muhammad.panji@fik.ac.id'    },
      { levelRole:'Level 4', role:'Dosen SD',               nip:'807', nama:'M. Oktaviano, S.Kom., M.Kom.',                   email:'oktaviano@fik.ac.id'         },
    ],
  },
};

// ─── STYLE HELPERS ────────────────────────────────────────────────────────────
function cell(v, s) { return { v, s }; }
const HEADER_STYLE = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1D4ED8' } }, alignment: { horizontal: 'center', wrapText: true }, border: { bottom: { style: 'thin' } } };
const SUBHEADER_STYLE = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '374151' } }, alignment: { horizontal: 'center', wrapText: true } };
const SECTION_STYLE  = { font: { bold: true, sz: 12 }, fill: { fgColor: { rgb: 'DBEAFE' } }, alignment: { horizontal: 'left' } };
const CASCADE_HDR    = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '7C3AED' } }, alignment: { horizontal: 'center' } };
const LEVEL_STYLE    = {
  'Level 1': { fill: { fgColor: { rgb: 'FEF3C7' } } },
  'Level 2': { fill: { fgColor: { rgb: 'DCFCE7' } } },
  'Level 3': { fill: { fgColor: { rgb: 'DBEAFE' } } },
  'Level 4': { fill: { fgColor: { rgb: 'F3F4F6' } } },
};
const INDENT = ['', '    ', '        ', '            '];

// ─── BUILD LIST IKU SHEET ─────────────────────────────────────────────────────
function buildListSheet(rows, jenis) {
  const aoa = [];
  aoa.push([`DAFTAR INDIKATOR ${jenis} — FIK UPN Veteran Jakarta Tahun 2026`]);
  aoa.push([]);
  aoa.push(['No', 'Kode', 'Nama Indikator', 'Level', 'Sasaran (L0)', ...(jenis === 'IKU' ? ['Kategori'] : [])]);

  let no = 0;
  for (const r of rows) {
    const prefix = INDENT[r.level] || '';
    const levelLabel = ['L0 — Sasaran', 'L1 — Sub-Indikator', 'L2 — Rincian', 'L3 — Detail'][r.level] || `L${r.level}`;
    if (r.level === 1) no++;
    const cols = [
      r.level === 1 ? no : '',
      r.kode,
      prefix + r.nama,
      levelLabel,
      r.sasaran,
    ];
    if (jenis === 'IKU') cols.push(r.kategori || '');
    aoa.push(cols);
  }
  return XLSX.utils.aoa_to_sheet(aoa);
}

// ─── BUILD FIXED UNIT SHEET ───────────────────────────────────────────────────
function buildFixedSheet(unitKey) {
  const { unit, cascade, users } = UNITS[unitKey];
  const aoa = [];

  // Title
  aoa.push([`TEMPLATE CASCADE — ${unitKey} — FIK UPN Veteran Jakarta`]);
  aoa.push([`Unit: ${unit}`]);
  aoa.push([]);

  // ── Section A: Cascade Chain ─────────────────────────────────────────────
  aoa.push(['=== BAGIAN A: ALUR CASCADE YANG DISARANKAN ===']);
  aoa.push(['Langkah', 'Role', 'Level Role', 'Keterangan']);
  for (const c of cascade) {
    aoa.push([`Langkah ${c.langkah}`, c.role, c.level, c.keterangan]);
  }
  aoa.push([]);

  // ── Section B: Pengguna Unit ──────────────────────────────────────────────
  aoa.push(['=== BAGIAN B: DAFTAR PENGGUNA UNIT ===']);
  aoa.push(['Level Role', 'Jabatan/Role', 'NIP', 'Nama', 'Email']);
  for (const u of users) {
    aoa.push([u.levelRole, u.role, u.nip, u.nama, u.email]);
  }
  aoa.push([]);

  // ── Section C: List Indikator IKU ────────────────────────────────────────
  aoa.push(['=== BAGIAN C: DAFTAR INDIKATOR IKU (untuk referensi cascade) ===']);
  aoa.push(['Kode', 'Nama Indikator', 'Level', 'Sasaran (L0)', 'Kategori']);
  for (const r of ikuRows) {
    const prefix = INDENT[r.level] || '';
    const levelLabel = ['L0 — Sasaran', 'L1 — Sub-Indikator', 'L2 — Rincian'][r.level] || `L${r.level}`;
    aoa.push([r.kode, prefix + r.nama, levelLabel, r.sasaran, r.kategori || '']);
  }
  aoa.push([]);

  // ── Section D: List Indikator PK ─────────────────────────────────────────
  aoa.push(['=== BAGIAN D: DAFTAR INDIKATOR PK (untuk referensi cascade) ===']);
  aoa.push(['Kode', 'Nama Indikator', 'Level', 'Sasaran (L0)']);
  for (const r of pkRows) {
    const prefix = INDENT[r.level] || '';
    const levelLabel = ['L0 — Sasaran', 'L1 — Sub-Indikator', 'L2 — Rincian', 'L3 — Detail'][r.level] || `L${r.level}`;
    aoa.push([r.kode, prefix + r.nama, levelLabel, r.sasaran]);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Set column widths
  ws['!cols'] = [
    { wch: 15 },
    { wch: 55 },
    { wch: 18 },
    { wch: 22 },
    { wch: 35 },
  ];

  return ws;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
const wb = XLSX.utils.book_new();

// Sheet 1: LIST IKU
const wsIKU = buildListSheet(ikuRows, 'IKU');
wsIKU['!cols'] = [{ wch: 5 }, { wch: 10 }, { wch: 80 }, { wch: 20 }, { wch: 18 }, { wch: 10 }];
XLSX.utils.book_append_sheet(wb, wsIKU, 'LIST IKU');

// Sheet 2: LIST PK
const wsPK = buildListSheet(pkRows, 'PK');
wsPK['!cols'] = [{ wch: 5 }, { wch: 12 }, { wch: 80 }, { wch: 20 }, { wch: 22 }];
XLSX.utils.book_append_sheet(wb, wsPK, 'LIST PK');

// Sheets 3-6: FIXED per unit
for (const unitKey of Object.keys(UNITS)) {
  const ws = buildFixedSheet(unitKey);
  XLSX.utils.book_append_sheet(wb, ws, unitKey);
}

const outPath = path.join(__dirname, 'cascade-template.xlsx');
XLSX.writeFile(wb, outPath);
console.log('✅ File generated:', outPath);
