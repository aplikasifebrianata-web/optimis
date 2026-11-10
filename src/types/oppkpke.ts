export type SemesterNumber = 1 | 2;

export type VerificationStatus =
  | 'Belum Diisi'
  | 'Draft'
  | 'Menunggu Verifikasi'
  | 'Terverifikasi'
  | 'Perlu Perbaikan';

export type SifatBantuan = 'Berkelanjutan' | 'Tidak Berkelanjutan' | '';

export interface PeriodePelaporan {
  periode_id: string;
  tahun: number;
  nama_periode: string;
  semester_1_buka: boolean;
  semester_2_buka: boolean;
  batas_semester_1: string;
  batas_semester_2: string;
  is_active: boolean;
  updated_at: string;
}

export type InstansiKategori =
  | 'Admin'
  | 'OPD/Dinas/Badan'
  | 'RSUD'
  | 'Puskesmas'
  | 'Kecamatan'
  | 'Kelurahan';

export interface OPD {
  opd_id: string;
  kode_opd: string;
  nama_opd: string;
  singkatan: string;
  kepala_opd: string;
  kategori?: InstansiKategori;
}

export type UserRole = 'ADMIN' | 'OPD';

export interface AuthUser {
  user_id: string;
  username: string;
  email?: string;
  password_hint: string;
  role: UserRole;
  opd_id: string | null;
  kategori?: InstansiKategori;
  display_name: string;
  instansi_label: string;
  instansi_lengkap: string;
  jabatan: string;
}

/**
 * Tabel MatrixData sesuai spesifikasi Section 7
 */
export interface MatrixData {
  matrix_id: string;
  periode_id: string;
  opd_id: string;
  strategi: string;
  kode: string;
  program: string;
  kegiatan: string;
  sub_kegiatan: string;
  aktivitas_real_langsung: string;
  aktivitas_real_tidak_langsung: string;
  aktivitas_real_penunjang: string;
  alokasi_anggaran: number;
  sumber_pembiayaan: string;
  sifat_bantuan: SifatBantuan;
  lokasi: string;
  lokasi_kecamatan?: string;
  lokasi_desa?: string;
  lokasi_spesifik?: string;
  jumlah_sasaran: number;
  satuan_sasaran?: string;
  keterangan_sasaran?: string;
  besaran_manfaat: string;
  jenis_bantuan: string;
  durasi_pemberian_bantuan: string;
  keterangan_durasi_bantuan?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Tabel RealisasiSemester sesuai spesifikasi Section 7
 * Nilai semester:
 * 1 = Januari-Juni
 * 2 = Juli-Desember
 */
export interface RealisasiSemester {
  realisasi_id: string;
  matrix_id: string;
  semester: SemesterNumber;
  realisasi: number;
  rincian_realisasi?: string;
  status_verifikasi: VerificationStatus;
  catatan_verifikator: string;
  submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;
  updated_at: string;
}

/**
 * Tabel AuditLog untuk mencatat histori perubahan setiap semester & komponen matriks
 */
export interface AuditLog {
  log_id: string;
  matrix_id: string;
  semester: SemesterNumber | null;
  opd_id: string;
  user_role: UserRole;
  user_name: string;
  aksi: string;
  detail_perubahan: string;
  nilai_sebelumnya?: string;
  nilai_baru?: string;
  created_at: string;
}

/**
 * Gabungan MatrixData beserta Realisasi Semester 1 dan Semester 2 untuk kemudahan query UI dan Export
 */
export interface EnrichedMatrixRow extends MatrixData {
  nama_opd: string;
  singkatan_opd: string;
  tahun: number;
  sem1: RealisasiSemester;
  sem2: RealisasiSemester;
  total_realisasi_tahunan: number;
  persentase_realisasi_sem1: number;
  persentase_realisasi_sem2: number;
  persentase_realisasi_tahunan: number;
  is_data_teknis_lengkap: boolean;
  completion_percentage: number;
}

/**
 * Data Referensi Kode SIPD (13 kolom standar SIPD RI)
 */
export interface KodeSipdItem {
  sipd_id: string;
  nama_urusan: string;
  kode_skpd: string;
  nama_skpd: string;
  kode_sub_unit: string;
  nama_sub_unit: string;
  kode_bidang_urusan: string;
  nama_bidang_urusan: string;
  kode_program: string;
  nama_program: string;
  kode_kegiatan: string;
  nama_kegiatan: string;
  kode_sub_kegiatan: string;
  nama_sub_kegiatan: string;
  is_custom?: boolean;
}

/**
 * Menu Navigasi Utama
 */
export type NavTab =
  | 'dashboard'
  | 'matriks'
  | 'verifikasi'
  | 'laporan-export'
  | 'kode-sipd'
  | 'manajemen-user'
  | 'pengaturan-periode'
  | 'audit-log'
  | 'struktur-db';

export type ExportType =
  | 'all_matrix'
  | 'per_opd'
  | 'semester_1'
  | 'semester_2'
  | 'rekap_tahunan'
  | 'status_verifikasi';

