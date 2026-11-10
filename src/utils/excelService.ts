import * as XLSX from 'xlsx';
import { EnrichedMatrixRow, ExportType, OPD } from '../types/oppkpke';

/**
 * Helper untuk mengatur lebar kolom otomatis pada worksheet SheetJS
 */
function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

/**
 * Konversi baris EnrichedMatrixRow ke format urutan kolom Matriks Excel Asli E-OPPKPKE Blora
 * Mempertahankan kolom Realisasi Semester 1 dan menambahkan kolom Realisasi Semester 2
 */
function mapRowToOriginalMatrixFormat(row: EnrichedMatrixRow, idx: number) {
  return {
    No: idx + 1,
    'Strategi OPPKPKE': row.strategi,
    'Perangkat Daerah': row.nama_opd,
    Kode: row.kode,
    Program: row.program,
    Kegiatan: row.kegiatan,
    'Sub Kegiatan': row.sub_kegiatan,
    'Aktivitas Real Langsung': row.aktivitas_real_langsung || '-',
    'Aktivitas Real Tidak Langsung': row.aktivitas_real_tidak_langsung || '-',
    'Aktivitas Real Penunjang': row.aktivitas_real_penunjang || '-',
    'Alokasi Anggaran (Rp)': row.alokasi_anggaran,
    'Sumber Pembiayaan': row.sumber_pembiayaan || '-',
    'Sifat Bantuan': row.sifat_bantuan || '-',
    Lokasi: row.lokasi || '-',
    'Jumlah Sasaran Penerima Manfaat': row.jumlah_sasaran,
    'Besaran Manfaat': row.besaran_manfaat || '-',
    'Jenis Bantuan': row.jenis_bantuan || '-',
    'Durasi Pemberian Bantuan': row.durasi_pemberian_bantuan || '-',
    'Realisasi Semester 1 (Januari-Juni)': row.sem1.realisasi,
    'Realisasi Semester 2 (Juli-Desember)': row.sem2.realisasi,
    'Total Realisasi Tahunan (Rp)': row.total_realisasi_tahunan,
    'Persentase Realisasi (%)': Number(row.persentase_realisasi_tahunan.toFixed(2)),
    'Status Verifikasi Semester 1': row.sem1.status_verifikasi,
    'Status Verifikasi Semester 2': row.sem2.status_verifikasi,
  };
}

const MATRIX_COL_WIDTHS = [
  5, 36, 40, 20, 38, 42, 46, 48, 42, 42, 22, 24, 20, 42, 18, 34, 26, 22, 26, 26, 24, 18, 24, 24,
];

/**
 * Fungsi Utama Export Excel sesuai 6 jenis laporan yang diminta
 */
export function exportMatrixToExcel(
  type: ExportType,
  rows: EnrichedMatrixRow[],
  tahun: number,
  selectedOpd?: OPD | null
): string {
  const wb = XLSX.utils.book_new();
  const timestamp = new Date().toISOString().slice(0, 10);
  let fileName = `E-OPPKPKE_Blora_${tahun}_${timestamp}.xlsx`;

  if (type === 'all_matrix') {
    const data = rows.map((r, i) => mapRowToOriginalMatrixFormat(r, i));
    const ws = XLSX.utils.json_to_sheet(data);
    setColumnWidths(ws, MATRIX_COL_WIDTHS);
    XLSX.utils.book_append_sheet(wb, ws, `Matriks OPPKPKE ${tahun}`);
    fileName = `Matriks_Lengkap_E-OPPKPKE_Blora_TA_${tahun}.xlsx`;
  } else if (type === 'per_opd') {
    if (selectedOpd) {
      const filtered = rows.filter((r) => r.opd_id === selectedOpd.opd_id);
      const data = filtered.map((r, i) => mapRowToOriginalMatrixFormat(r, i));
      const ws = XLSX.utils.json_to_sheet(data);
      setColumnWidths(ws, MATRIX_COL_WIDTHS);
      const safeSheetName = selectedOpd.singkatan.slice(0, 28);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      fileName = `Matriks_OPPKPKE_${selectedOpd.singkatan.replace(/\s+/g, '_')}_TA_${tahun}.xlsx`;
    } else {
      // Buat sheet terpisah untuk masing-masing OPD ditambah sheet gabungan
      const allData = rows.map((r, i) => mapRowToOriginalMatrixFormat(r, i));
      const wsAll = XLSX.utils.json_to_sheet(allData);
      setColumnWidths(wsAll, MATRIX_COL_WIDTHS);
      XLSX.utils.book_append_sheet(wb, wsAll, 'Semua OPD');

      const opdGroups = new Map<string, EnrichedMatrixRow[]>();
      rows.forEach((r) => {
        const list = opdGroups.get(r.singkatan_opd) || [];
        list.push(r);
        opdGroups.set(r.singkatan_opd, list);
      });

      opdGroups.forEach((opdRows, singkatan) => {
        const sheetData = opdRows.map((r, i) => mapRowToOriginalMatrixFormat(r, i));
        const wsOpd = XLSX.utils.json_to_sheet(sheetData);
        setColumnWidths(wsOpd, MATRIX_COL_WIDTHS);
        XLSX.utils.book_append_sheet(wb, wsOpd, singkatan.slice(0, 28));
      });
      fileName = `Matriks_Per_OPD_E-OPPKPKE_Blora_TA_${tahun}.xlsx`;
    }
  } else if (type === 'semester_1') {
    const data = rows.map((r, i) => ({
      No: i + 1,
      'Strategi OPPKPKE': r.strategi,
      'Perangkat Daerah': r.nama_opd,
      Kode: r.kode,
      Program: r.program,
      Kegiatan: r.kegiatan,
      'Sub Kegiatan': r.sub_kegiatan,
      'Aktivitas Real Langsung': r.aktivitas_real_langsung || '-',
      'Aktivitas Real Tidak Langsung': r.aktivitas_real_tidak_langsung || '-',
      'Aktivitas Real Penunjang': r.aktivitas_real_penunjang || '-',
      'Alokasi Anggaran (Rp)': r.alokasi_anggaran,
      'Sumber Pembiayaan': r.sumber_pembiayaan || '-',
      'Sifat Bantuan': r.sifat_bantuan || '-',
      Lokasi: r.lokasi || '-',
      'Jumlah Sasaran Penerima Manfaat': r.jumlah_sasaran,
      'Besaran Manfaat': r.besaran_manfaat || '-',
      'Jenis Bantuan': r.jenis_bantuan || '-',
      'Durasi Pemberian Bantuan': r.durasi_pemberian_bantuan || '-',
      'Realisasi Semester 1 (Januari-Juni)': r.sem1.realisasi,
      'Persentase Capaian Sem 1 (%)': Number(r.persentase_realisasi_sem1.toFixed(2)),
      'Status Verifikasi Semester 1': r.sem1.status_verifikasi,
      'Catatan Verifikator Sem 1': r.sem1.catatan_verifikator || '-',
      'Tanggal Verifikasi Sem 1': r.sem1.verified_at ? r.sem1.verified_at.slice(0, 10) : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    setColumnWidths(ws, MATRIX_COL_WIDTHS);
    XLSX.utils.book_append_sheet(wb, ws, `Realisasi Sem 1 ${tahun}`);
    fileName = `Laporan_Realisasi_Semester_1_Jan-Jun_TA_${tahun}.xlsx`;
  } else if (type === 'semester_2') {
    const data = rows.map((r, i) => ({
      No: i + 1,
      'Strategi OPPKPKE': r.strategi,
      'Perangkat Daerah': r.nama_opd,
      Kode: r.kode,
      Program: r.program,
      Kegiatan: r.kegiatan,
      'Sub Kegiatan': r.sub_kegiatan,
      'Aktivitas Real Langsung': r.aktivitas_real_langsung || '-',
      'Aktivitas Real Tidak Langsung': r.aktivitas_real_tidak_langsung || '-',
      'Aktivitas Real Penunjang': r.aktivitas_real_penunjang || '-',
      'Alokasi Anggaran (Rp)': r.alokasi_anggaran,
      'Sumber Pembiayaan': r.sumber_pembiayaan || '-',
      'Sifat Bantuan': r.sifat_bantuan || '-',
      Lokasi: r.lokasi || '-',
      'Jumlah Sasaran Penerima Manfaat': r.jumlah_sasaran,
      'Besaran Manfaat': r.besaran_manfaat || '-',
      'Jenis Bantuan': r.jenis_bantuan || '-',
      'Durasi Pemberian Bantuan': r.durasi_pemberian_bantuan || '-',
      'Realisasi Semester 1 (Januari-Juni)': r.sem1.realisasi,
      'Realisasi Semester 2 (Juli-Desember)': r.sem2.realisasi,
      'Persentase Capaian Sem 2 (%)': Number(r.persentase_realisasi_sem2.toFixed(2)),
      'Status Verifikasi Semester 2': r.sem2.status_verifikasi,
      'Catatan Verifikator Sem 2': r.sem2.catatan_verifikator || '-',
      'Tanggal Verifikasi Sem 2': r.sem2.verified_at ? r.sem2.verified_at.slice(0, 10) : '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    setColumnWidths(ws, MATRIX_COL_WIDTHS);
    XLSX.utils.book_append_sheet(wb, ws, `Realisasi Sem 2 ${tahun}`);
    fileName = `Laporan_Realisasi_Semester_2_Jul-Des_TA_${tahun}.xlsx`;
  } else if (type === 'rekap_tahunan') {
    // Sheet 1: Rekapitulasi Akumulasi Tahunan per OPD
    const opdMap = new Map<
      string,
      {
        nama_opd: string;
        singkatan: string;
        jumlah_sub_kegiatan: number;
        total_sasaran: number;
        alokasi: number;
        sem1: number;
        sem2: number;
        tahunan: number;
      }
    >();

    rows.forEach((r) => {
      const current = opdMap.get(r.opd_id) || {
        nama_opd: r.nama_opd,
        singkatan: r.singkatan_opd,
        jumlah_sub_kegiatan: 0,
        total_sasaran: 0,
        alokasi: 0,
        sem1: 0,
        sem2: 0,
        tahunan: 0,
      };
      current.jumlah_sub_kegiatan += 1;
      current.total_sasaran += r.jumlah_sasaran;
      current.alokasi += r.alokasi_anggaran;
      current.sem1 += r.sem1.realisasi;
      current.sem2 += r.sem2.realisasi;
      current.tahunan += r.total_realisasi_tahunan;
      opdMap.set(r.opd_id, current);
    });

    const rekapOpdData = Array.from(opdMap.values()).map((item, idx) => ({
      No: idx + 1,
      'Perangkat Daerah (OPD)': item.nama_opd,
      Singkatan: item.singkatan,
      'Jumlah Sub Kegiatan': item.jumlah_sub_kegiatan,
      'Total Sasaran Penerima Manfaat': item.total_sasaran,
      'Total Alokasi Anggaran (Rp)': item.alokasi,
      'Realisasi Semester 1 (Januari-Juni)': item.sem1,
      'Realisasi Semester 2 (Juli-Desember)': item.sem2,
      'Akumulasi Realisasi Tahunan (Rp)': item.tahunan,
      'Persentase Realisasi Tahunan (%)':
        item.alokasi > 0 ? Number(((item.tahunan / item.alokasi) * 100).toFixed(2)) : 0,
    }));

    const wsRekap = XLSX.utils.json_to_sheet(rekapOpdData);
    setColumnWidths(wsRekap, [5, 44, 16, 20, 26, 26, 28, 28, 28, 24]);
    XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap Tahunan Per OPD');

    // Sheet 2: Detail Matriks Tahunan
    const detailData = rows.map((r, i) => mapRowToOriginalMatrixFormat(r, i));
    const wsDetail = XLSX.utils.json_to_sheet(detailData);
    setColumnWidths(wsDetail, MATRIX_COL_WIDTHS);
    XLSX.utils.book_append_sheet(wb, wsDetail, 'Detail Matriks Tahunan');
    fileName = `Rekapitulasi_Tahunan_E-OPPKPKE_Blora_TA_${tahun}.xlsx`;
  } else if (type === 'status_verifikasi') {
    const data = rows.map((r, i) => ({
      No: i + 1,
      'Perangkat Daerah': r.nama_opd,
      Kode: r.kode,
      'Sub Kegiatan': r.sub_kegiatan,
      'Alokasi Anggaran (Rp)': r.alokasi_anggaran,
      'Kelengkapan Data Teknis': r.is_data_teknis_lengkap ? 'Lengkap' : 'Belum Lengkap',
      'Realisasi Semester 1 (Rp)': r.sem1.realisasi,
      'Status Verifikasi Semester 1': r.sem1.status_verifikasi,
      'Catatan Verifikator Sem 1': r.sem1.catatan_verifikator || '-',
      'Diverifikasi Oleh (Sem 1)': r.sem1.verified_by || '-',
      'Waktu Verifikasi Sem 1': r.sem1.verified_at || '-',
      'Realisasi Semester 2 (Rp)': r.sem2.realisasi,
      'Status Verifikasi Semester 2': r.sem2.status_verifikasi,
      'Catatan Verifikator Sem 2': r.sem2.catatan_verifikator || '-',
      'Diverifikasi Oleh (Sem 2)': r.sem2.verified_by || '-',
      'Waktu Verifikasi Sem 2': r.sem2.verified_at || '-',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    setColumnWidths(ws, [5, 38, 18, 44, 22, 22, 24, 24, 38, 26, 22, 24, 24, 38, 26, 22]);
    XLSX.utils.book_append_sheet(wb, ws, `Status Verifikasi ${tahun}`);
    fileName = `Laporan_Status_Verifikasi_Per_Semester_TA_${tahun}.xlsx`;
  }

  XLSX.writeFile(wb, fileName);
  return fileName;
}

export interface ExcelTemplateColSpec {
  no: number;
  header: string;
  wajib: boolean;
  format: string;
  contoh: string;
}

export const EXCEL_TEMPLATE_COLUMNS_SPEC: ExcelTemplateColSpec[] = [
  {
    no: 1,
    header: 'Strategi OPPKPKE',
    wajib: true,
    format: 'Teks (Pilih 1 dari 3 Strategi OPPKPKE)',
    contoh: '1. Pengurangan Beban Pengeluaran Masyarakat',
  },
  {
    no: 2,
    header: 'Perangkat Daerah',
    wajib: true,
    format: 'Nama Resmi OPD / Singkatan OPD',
    contoh: 'Dinas Sosial, Pemberdayaan Perempuan dan Perlindungan Anak',
  },
  {
    no: 3,
    header: 'Kode',
    wajib: true,
    format: 'Kode Rekening 12 Digit (_.__.__._.__.____)',
    contoh: '2.19.02.2.01.0011',
  },
  {
    no: 4,
    header: 'Program',
    wajib: true,
    format: 'Teks Nomenklatur Program',
    contoh: 'Program Perlindungan dan Jaminan Sosial',
  },
  {
    no: 5,
    header: 'Kegiatan',
    wajib: true,
    format: 'Teks Nomenklatur Kegiatan',
    contoh: 'Pengelolaan Data Fakir Miskin Cakupan Daerah Kabupaten',
  },
  {
    no: 6,
    header: 'Sub Kegiatan',
    wajib: true,
    format: 'Teks Nomenklatur Sub Kegiatan',
    contoh: 'Bantuan Pangan Non Tunai Daerah bagi Keluarga Rentan Miskin Ekstrem',
  },
  {
    no: 7,
    header: 'Alokasi Anggaran (Rp)',
    wajib: true,
    format: 'Angka Murni Tanpa Titik / Rp',
    contoh: '1250000000',
  },
];

export const EXCEL_TEMPLATE_SAMPLE_ROWS = [
  {
    'Strategi OPPKPKE': '1. Pengurangan Beban Pengeluaran Masyarakat',
    'Perangkat Daerah': 'Dinas Sosial, Pemberdayaan Perempuan dan Perlindungan Anak',
    Kode: '1.06.04.2.01.0009',
    Program: 'Program Perlindungan dan Jaminan Sosial',
    Kegiatan: 'Pengelolaan Data Fakir Miskin Cakupan Daerah Kabupaten',
    'Sub Kegiatan': 'Bantuan Pangan Non Tunai Daerah bagi Keluarga Rentan Miskin Ekstrem',
    'Alokasi Anggaran (Rp)': 1250000000,
  },
  {
    'Strategi OPPKPKE': '2. Peningkatan Pendapatan Masyarakat',
    'Perangkat Daerah': 'Dinas Pangan, Pertanian, Peternakan dan Perikanan',
    Kode: '2.09.04.2.02.0003',
    Program: 'Program Penyediaan dan Pengembangan Sarana Pertanian',
    Kegiatan: 'Pengembangan Prasarana Pertanian Rakyat',
    'Sub Kegiatan': 'Bantuan Benih Padi dan Jagung Hibrida bagi Petani Gurem Desil 1-2',
    'Alokasi Anggaran (Rp)': 980000000,
  },
  {
    'Strategi OPPKPKE': '3. Penurunan Jumlah Kantong-Kantong Kemiskinan',
    'Perangkat Daerah': 'Dinas Perumahan, Permukiman dan Perhubungan',
    Kode: '1.04.04.2.01.0004',
    Program: 'Program Perumahan dan Kawasan Permukiman Kumuh',
    Kegiatan: 'Pencegahan Perumahan dan Kawasan Permukiman Kumuh',
    'Sub Kegiatan': 'Peningkatan Jalan Lingkungan dan Drainase Permukiman Desa Lokus P3KE',
    'Alokasi Anggaran (Rp)': 2400000000,
  },
];

/**
 * Unduh Template Excel Dasar untuk Admin / OPD mengimpor data dasar program/kegiatan/subkegiatan
 */
export function downloadAdminImportTemplate() {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Utama yang Siap Diisi
  const ws = XLSX.utils.json_to_sheet(EXCEL_TEMPLATE_SAMPLE_ROWS);
  setColumnWidths(ws, [42, 48, 22, 42, 44, 52, 24]);
  XLSX.utils.book_append_sheet(wb, ws, 'Template_Import_Matriks');

  // Sheet 2: Petunjuk & Format Baku Kolom
  const guideData = EXCEL_TEMPLATE_COLUMNS_SPEC.map((col) => ({
    'Urutan Kolom': col.no,
    'Nama Header Kolom (Jangan Diubah)': col.header,
    Status: col.wajib ? 'Wajib Diisi' : 'Opsional',
    'Ketentuan Format Pengisian': col.format,
    'Contoh Pengisian yang Benar': col.contoh,
  }));
  const wsGuide = XLSX.utils.json_to_sheet(guideData);
  setColumnWidths(wsGuide, [14, 34, 16, 42, 54]);
  XLSX.utils.book_append_sheet(wb, wsGuide, 'Panduan_Format_Kolom');

  XLSX.writeFile(wb, 'Template_Standar_Import_Matriks_E-OPPKPKE_Blora.xlsx');
}

/**
 * Parse file Excel yang diunggah untuk mengambil Data Dasar Program
 */
export interface ParsedExcelBaseRow {
  strategi: string;
  perangkat_daerah: string;
  kode: string;
  program: string;
  kegiatan: string;
  sub_kegiatan: string;
  alokasi_anggaran: number;
}

export async function parseExcelImportFile(file: File): Promise<ParsedExcelBaseRow[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  const rawJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });

  const parsedRows: ParsedExcelBaseRow[] = [];

  for (const row of rawJson) {
    // Dukung pencocokan nama kolom yang fleksibel (case-insensitive)
    const getVal = (keys: string[]): string => {
      for (const k of Object.keys(row)) {
        const cleanK = k.trim().toLowerCase();
        if (keys.some((target) => cleanK.includes(target.toLowerCase()))) {
          return String(row[k] ?? '').trim();
        }
      }
      return '';
    };

    const strategi =
      getVal(['strategi oppkpke', 'strategi']) || '1. Pengurangan Beban Pengeluaran Masyarakat';
    const perangkat_daerah = getVal(['perangkat daerah', 'opd', 'nama opd', 'dinas']);
    const kode = getVal(['kode', 'kode rekening', 'kode sub']);
    const program = getVal(['program']);
    const kegiatan = getVal(['kegiatan']);
    const sub_kegiatan = getVal(['sub kegiatan', 'sub_kegiatan', 'subkegiatan']);
    const rawAnggaran = getVal(['alokasi anggaran', 'anggaran', 'pagu']);
    const alokasi_anggaran =
      typeof rawAnggaran === 'number'
        ? rawAnggaran
        : parseInt(String(rawAnggaran).replace(/[^\d]/g, ''), 10) || 0;

    if (program || kegiatan || sub_kegiatan) {
      parsedRows.push({
        strategi,
        perangkat_daerah:
          perangkat_daerah || 'Dinas Sosial, Pemberdayaan Perempuan dan Perlindungan Anak',
        kode: kode || `1.00.01.2.01.${String(parsedRows.length + 1).padStart(4, '0')}`,
        program: program || 'Program Penanggulangan Kemiskinan Daerah',
        kegiatan: kegiatan || 'Kegiatan Intervensi Kemiskinan Ekstrem',
        sub_kegiatan: sub_kegiatan || 'Sub Kegiatan Penanganan Kemiskinan',
        alokasi_anggaran,
      });
    }
  }

  return parsedRows;
}

