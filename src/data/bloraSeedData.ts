import {
  OPD,
  PeriodePelaporan,
  MatrixData,
  RealisasiSemester,
  AuditLog,
  AuthUser,
  InstansiKategori,
} from '../types/oppkpke';

export const INSTANSI_KATEGORI_LIST: InstansiKategori[] = [
  'Admin',
  'OPD/Dinas/Badan',
  'RSUD',
  'Puskesmas',
  'Kecamatan',
  'Kelurahan',
];

export const KECAMATAN_BLORA = [
  'Seluruh Kecamatan (16 Kecamatan)',
  'Kec. Blora',
  'Kec. Cepu',
  'Kec. Randublatung',
  'Kec. Kunduran',
  'Kec. Ngawen',
  'Kec. Todanan',
  'Kec. Jepon',
  'Kec. Banjarejo',
  'Kec. Jati',
  'Kec. Kradenan',
  'Kec. Kedungtuban',
  'Kec. Sambong',
  'Kec. Jiken',
  'Kec. Bogorejo',
  'Kec. Tunjungan',
  'Kec. Japah',
];

export const STRATEGI_OPPKPKE_LIST = [
  '1. Pengurangan Beban Pengeluaran Masyarakat',
  '2. Peningkatan Pendapatan Masyarakat',
  '3. Penurunan Jumlah Kantong-Kantong Kemiskinan',
];

export const SUMBER_PEMBIAYAAN_OPTIONS = [
  'APBD Kabupaten',
  'APBDP',
  'APBD Provinsi',
  'APBN',
  'Dana Desa',
  'DAK Fisik / Non-Fisik',
  'DBHCHT (Dana Bagi Hasil Cukai Hasil Tembakau)',
  'CSR / BAZNAS Kabupaten Blora',
  'Sumber Pembiayaan Lainnya',
];

export const JENIS_BANTUAN_OPTIONS = [
  'Bantuan sosial',
  'Bantuan pangan',
  'Bantuan pendidikan',
  'Bantuan kesehatan',
  'Pemberdayaan ekonomi',
  'Pelatihan keterampilan',
  'Bantuan permodalan',
  'Rehabilitasi RTLH & Sanitasi Dasar',
  'Infrastruktur dasar kantong kemiskinan',
  'Bantuan lainnya',
];

export const DURASI_BANTUAN_OPTIONS = [
  '1 kali',
  '1 kegiatan',
  '3 bulan',
  '6 bulan',
  '1 tahun',
];

export const BESARAN_MANFAAT_PRESETS = [
  'Rp300.000/orang/bulan',
  'Rp1.000.000/keluarga',
  'Rp20.000.000/unit RTLH',
  '1 paket bantuan pangan (10 kg beras)',
  '1 paket peralatan usaha produktif',
  '1 unit jamban sehat keluarga',
];

export const SEED_PERIODE: PeriodePelaporan[] = [
  {
    periode_id: 'per-2026',
    tahun: 2026,
    nama_periode: 'Tahun Anggaran 2026',
    semester_1_buka: true,
    semester_2_buka: true,
    batas_semester_1: '2026-07-15',
    batas_semester_2: '2027-01-15',
    is_active: true,
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    periode_id: 'per-2027',
    tahun: 2027,
    nama_periode: 'Tahun Anggaran 2027',
    semester_1_buka: true,
    semester_2_buka: true,
    batas_semester_1: '2027-07-15',
    batas_semester_2: '2028-01-15',
    is_active: true,
    updated_at: '2026-11-01T08:00:00Z',
  },
];

// Data OPD dikosongkan (0 OPD) sesuai instruksi
export const SEED_OPD: OPD[] = [];

// Hanya menyisakan 1 akun Admin (username: admin, password: admin)
export const SEED_USERS: AuthUser[] = [
  {
    user_id: 'usr-admin',
    username: 'admin',
    email: 'admin@oppkpke.com',
    password_hint: 'admin',
    role: 'ADMIN',
    opd_id: null,
    kategori: 'Admin',
    display_name: 'Administrator OPTIMIS',
    instansi_label: 'ADMIN BAPPERIDA',
    instansi_lengkap: 'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
    jabatan: 'Administrator & Verifikator TKPKD',
  },
];

// Data Matriks, Realisasi Semester, dan Audit Log OPD di-0-kan (kosong)
export const SEED_MATRIX_DATA: MatrixData[] = [];

export const SEED_REALISASI_SEMESTER: RealisasiSemester[] = [];

export const SEED_AUDIT_LOGS: AuditLog[] = [];

