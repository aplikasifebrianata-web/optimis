import * as XLSX from 'xlsx';
import { KodeSipdItem, OPD } from '../types/oppkpke';

// Data awal Kode SIPD di-0-kan (kosong) sampai pengguna melampirkan / mengunggah CSV baru
const SIPD_CSV_URLS: string[] = [];

const LEGACY_SIPD_KEYS = [
  'e_oppkpke_blora_sipd_uploaded_master_v1',
  'e_oppkpke_blora_sipd_uploaded_meta_v1',
  'e_oppkpke_blora_sipd_custom_v1',
  'e_oppkpke_blora_sipd_edited_v1',
  'e_oppkpke_blora_sipd_deleted_v1',
];

const SIPD_STORAGE_KEYS = {
  UPLOADED_MASTER: 'e_oppkpke_blora_sipd_uploaded_master_v2',
  UPLOADED_META: 'e_oppkpke_blora_sipd_uploaded_meta_v2',
  CUSTOM_ITEMS: 'e_oppkpke_blora_sipd_custom_v2',
  EDITED_MAP: 'e_oppkpke_blora_sipd_edited_v2',
  DELETED_IDS: 'e_oppkpke_blora_sipd_deleted_v2',
};

// Bersihkan cache v1 lama agar data Kode SIPD benar-benar 0
try {
  LEGACY_SIPD_KEYS.forEach((k) => localStorage.removeItem(k));
} catch {
  // ignore storage errors
}

let cachedAllCsvRows: KodeSipdItem[] | null = null;
let cachedUniqueCsvRows: KodeSipdItem[] | null = null;
let loadingPromise: Promise<{
  uniqueRows: KodeSipdItem[];
  allRows: KodeSipdItem[];
}> | null = null;

/**
 * Kamus singkatan resmi Perangkat Daerah / Instansi Kabupaten Blora ke Nama Sub Unit SIPD
 * agar pencocokan instansi 100% akurat dan tidak pernah salah kamar antar-dinas/unit.
 */
const INSTANSI_ALIAS_TO_CANONICAL: Record<string, string> = {
  DINSOS: 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINSOS P3A': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINSOS PPPA': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINAS P3A': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINAS SOSIAL': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINAS SOSIAL P3A': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  'DINAS SOSIAL PPPA': 'DINAS SOSIAL PEMBERDAYAAN PEREMPUAN DAN PERLINDUNGAN ANAK',
  DINKES: 'DINAS KESEHATAN DAERAH',
  DINKESDA: 'DINAS KESEHATAN DAERAH',
  'DINAS KESEHATAN': 'DINAS KESEHATAN DAERAH',
  DINDIK: 'DINAS PENDIDIKAN',
  DPUPR: 'DINAS PEKERJAAN UMUM DAN PENATAAN RUANG',
  DINRUMKIMHUB: 'DINAS PERUMAHAN PERMUKIMAN DAN PERHUBUNGAN',
  'SATPOL PP': 'SATUAN POLISI PAMONG PRAJA DAN PEMADAM KEBAKARAN',
  'SATPOL PP DAN DAMKAR': 'SATUAN POLISI PAMONG PRAJA DAN PEMADAM KEBAKARAN',
  SATPOLPP: 'SATUAN POLISI PAMONG PRAJA DAN PEMADAM KEBAKARAN',
  BPBD: 'BADAN PENANGGULANGAN BENCANA DAERAH',
  DP4: 'DINAS PANGAN PERTANIAN PETERNAKAN DAN PERIKANAN',
  'DP4 BLORA': 'DINAS PANGAN PERTANIAN PETERNAKAN DAN PERIKANAN',
  DLH: 'DINAS LINGKUNGAN HIDUP',
  DUKCAPIL: 'DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL',
  DISDUKCAPIL: 'DINAS KEPENDUDUKAN DAN PENCATATAN SIPIL',
  DINDAGKOP: 'DINAS PERDAGANGAN KOPERASI USAHA KECIL DAN MENENGAH',
  'DINDAGKOP UKM': 'DINAS PERDAGANGAN KOPERASI USAHA KECIL DAN MENENGAH',
  DPMPTSP: 'DINAS PENANAMAN MODAL DAN PELAYANAN TERPADU SATU PINTU',
  DINPORABUDPAR: 'DINAS KEPEMUDAAN OLAHRAGA KEBUDAYAAN DAN PARIWISATA',
  DINARPUS: 'DINAS PERPUSTAKAAN DAN KEARSIPAN',
  DINNAKERPERIN: 'DINAS PERINDUSTRIAN DAN TENAGA KERJA',
  DPMD: 'DINAS PEMBERDAYAAN MASYARAKAT DAN DESA',
  DALDUKKB: 'DINAS PENGENDALIAN PENDUDUK DAN KELUARGA BERENCANA',
  DINKOMINFO: 'DINAS KOMUNIKASI DAN INFORMATIKA',
  DISKOMINFO: 'DINAS KOMUNIKASI DAN INFORMATIKA',
  SETDA: 'SEKRETARIAT DAERAH',
  SEKDA: 'SEKRETARIAT DAERAH',
  SETWAN: 'SEKRETARIAT DPRD',
  SEKWAN: 'SEKRETARIAT DPRD',
  BAPPERIDA: 'BADAN PERENCANAAN PEMBANGUNAN RISET DAN INOVASI DAERAH',
  'ADMIN BAPPERIDA': 'BADAN PERENCANAAN PEMBANGUNAN RISET DAN INOVASI DAERAH',
  BAPPEDA: 'BADAN PERENCANAAN PEMBANGUNAN RISET DAN INOVASI DAERAH',
  BPPKAD: 'BADAN PENDAPATAN PENGELOLAAN KEUANGAN DAN ASET DAERAH',
  BKPSDM: 'BADAN KEPEGAWAIAN DAN PENGEMBANGAN SUMBER DAYA MANUSIA',
  INSPEKTORAT: 'INSPEKTORAT DAERAH',
  BAKESBANGPOL: 'BADAN KESATUAN BANGSA DAN POLITIK',
  KESBANGPOL: 'BADAN KESATUAN BANGSA DAN POLITIK',
  'RSUD BLORA': 'RSUD DR R SOETIJONO BLORA',
  'RSUD SOETIJONO': 'RSUD DR R SOETIJONO BLORA',
  'RSUD CEPU': 'RSUD DR R SOEPRAPTO CEPU',
  'RSUD SOEPRAPTO': 'RSUD DR R SOEPRAPTO CEPU',
  'RSUD RANDUBLATUNG': 'RSUD SAMIN SUROSENTIKO RANDUBLATUNG',
  'RSUD SAMIN SUROSENTIKO': 'RSUD SAMIN SUROSENTIKO RANDUBLATUNG',
};

/**
 * Normalisasi kanonik nama instansi agar setiap OPD/RSUD/Puskesmas/Kecamatan/Kelurahan
 * terpetakan 1-ke-1 ke NAMA SUB UNIT pada SIPD tanpa risiko salah kamar.
 */
export function canonicalizeInstansiName(rawName: string | null | undefined): string {
  if (!rawName) return '';
  let s = rawName.toUpperCase().trim();

  // Cek langsung pada kamus alias
  if (INSTANSI_ALIAS_TO_CANONICAL[s]) {
    return INSTANSI_ALIAS_TO_CANONICAL[s];
  }

  s = s.replace(/\bRUMAH SAKIT UMUM DAERAH\b/g, 'RSUD');
  s = s.replace(/\bUPTD\s+PUSKESMAS\b/g, 'PUSKESMAS');
  s = s.replace(/\bUPT\s+PUSKESMAS\b/g, 'PUSKESMAS');
  s = s.replace(/^PKM\.?\s+/g, 'PUSKESMAS ');
  s = s.replace(/^KEC\.?\s+/g, 'KECAMATAN ');
  s = s.replace(/^KEL\.?\s+/g, 'KELURAHAN ');
  s = s.replace(/\bKABUPATEN\s+BLORA\b/g, '');
  s = s.replace(/\bKAB\.\s*BLORA\b/g, '');
  s = s.replace(/\bKAB\s+BLORA\b/g, '');
  s = s.replace(/\bOLAH\s+RAGA\b/g, 'OLAHRAGA');
  s = s.replace(/[.,/\-()_]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  if (INSTANSI_ALIAS_TO_CANONICAL[s]) {
    return INSTANSI_ALIAS_TO_CANONICAL[s];
  }

  return s;
}

/**
 * Parser CSV dengan delimiter titik koma (;), koma (,), atau tab (\t) yang mendukung kutipan multiline (RFC-4180)
 */
export function parseDelimitedCsv(text: string, delimiter = ';'): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        row.push(field.replace(/\s+/g, ' ').trim());
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field.replace(/\s+/g, ' ').trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.replace(/\s+/g, ' ').trim());
        if (row.some(Boolean)) rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field || row.length > 0) {
    row.push(field.replace(/\s+/g, ' ').trim());
    if (row.some(Boolean)) rows.push(row);
  }

  return rows;
}

function getUploadedMasterItems(): KodeSipdItem[] | null {
  try {
    const raw = localStorage.getItem(SIPD_STORAGE_KEYS.UPLOADED_MASTER);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KodeSipdItem[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function saveUploadedMasterItems(
  items: KodeSipdItem[],
  meta: { fileName: string; totalRawRows: number; uniqueCount: number; uploadedAt: string }
): void {
  try {
    localStorage.setItem(SIPD_STORAGE_KEYS.UPLOADED_MASTER, JSON.stringify(items));
    localStorage.setItem(SIPD_STORAGE_KEYS.UPLOADED_META, JSON.stringify(meta));
  } catch (e) {
    console.error('Gagal menyimpan master CSV SIPD ke storage:', e);
  }
}

export function getUploadedSipdMeta(): {
  fileName: string;
  totalRawRows: number;
  uniqueCount: number;
  uploadedAt: string;
} | null {
  try {
    const raw = localStorage.getItem(SIPD_STORAGE_KEYS.UPLOADED_META);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function getCustomSipdItems(): KodeSipdItem[] {
  try {
    const raw = localStorage.getItem(SIPD_STORAGE_KEYS.CUSTOM_ITEMS);
    if (!raw) return [];
    return JSON.parse(raw) as KodeSipdItem[];
  } catch {
    return [];
  }
}

function saveCustomSipdItems(items: KodeSipdItem[]): void {
  try {
    localStorage.setItem(SIPD_STORAGE_KEYS.CUSTOM_ITEMS, JSON.stringify(items));
  } catch (e) {
    console.error('Gagal menyimpan custom SIPD:', e);
  }
}

function getEditedSipdMap(): Record<string, KodeSipdItem> {
  try {
    const raw = localStorage.getItem(SIPD_STORAGE_KEYS.EDITED_MAP);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, KodeSipdItem>;
  } catch {
    return {};
  }
}

function saveEditedSipdMap(map: Record<string, KodeSipdItem>): void {
  try {
    localStorage.setItem(SIPD_STORAGE_KEYS.EDITED_MAP, JSON.stringify(map));
  } catch (e) {
    console.error('Gagal menyimpan edited SIPD:', e);
  }
}

function getDeletedSipdIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SIPD_STORAGE_KEYS.DELETED_IDS);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveDeletedSipdIds(ids: Set<string>): void {
  try {
    localStorage.setItem(SIPD_STORAGE_KEYS.DELETED_IDS, JSON.stringify(Array.from(ids)));
  } catch (e) {
    console.error('Gagal menyimpan deleted SIPD IDs:', e);
  }
}

function applyLocalOverrides(baseRows: KodeSipdItem[]): KodeSipdItem[] {
  const customItems = getCustomSipdItems();
  const editedMap = getEditedSipdMap();
  const deletedIds = getDeletedSipdIds();

  const mergedBase = baseRows
    .filter((item) => !deletedIds.has(item.sipd_id))
    .map((item) => (editedMap[item.sipd_id] ? { ...editedMap[item.sipd_id] } : item));

  const validCustom = customItems.filter((item) => !deletedIds.has(item.sipd_id));
  return [...validCustom, ...mergedBase];
}

function parse2DRowsIntoSipdDataset(
  rawRows: string[][],
  idPrefix = 'sipd'
): { allParsed: KodeSipdItem[]; uniqueParsed: KodeSipdItem[] } {
  const allParsed: KodeSipdItem[] = [];
  const uniqueMap = new Map<string, KodeSipdItem>();

  if (rawRows.length <= 1) {
    return { allParsed, uniqueParsed: [] };
  }

  const header = rawRows[0].map((h) => h.toUpperCase().trim());
  const findCol = (keywords: string[], fallbackIdx: number) => {
    const foundIdx = header.findIndex((h) => keywords.every((kw) => h.includes(kw)));
    return foundIdx >= 0 ? foundIdx : fallbackIdx;
  };

  const isStandard13Col = rawRows[0].length >= 13;

  const idxUrusan = isStandard13Col ? 0 : findCol(['URUSAN'], 0);
  const idxKodeSkpd = isStandard13Col ? 1 : findCol(['KODE', 'SKPD'], 1);
  const idxNamaSkpd = isStandard13Col ? 2 : findCol(['NAMA', 'SKPD'], 2);
  const idxKodeSubUnit = isStandard13Col ? 3 : findCol(['KODE', 'SUB', 'UNIT'], idxKodeSkpd);
  const idxNamaSubUnit = isStandard13Col ? 4 : findCol(['NAMA', 'SUB', 'UNIT'], idxNamaSkpd);
  const idxKodeBidang = isStandard13Col ? 5 : findCol(['KODE', 'BIDANG'], 5);
  const idxNamaBidang = isStandard13Col ? 6 : findCol(['NAMA', 'BIDANG'], 6);
  const idxKodeProg = isStandard13Col ? 7 : findCol(['KODE', 'PROGRAM'], 7);
  const idxNamaProg = isStandard13Col ? 8 : findCol(['NAMA', 'PROGRAM'], 8);
  const idxKodeKeg = isStandard13Col ? 9 : findCol(['KODE', 'KEGIATAN'], 9);
  const idxNamaKeg = isStandard13Col ? 10 : findCol(['NAMA', 'KEGIATAN'], 10);
  const idxKodeSubKeg = isStandard13Col ? 11 : findCol(['KODE', 'SUB', 'KEGIATAN'], 11);
  const idxNamaSubKeg = isStandard13Col ? 12 : findCol(['NAMA', 'SUB', 'KEGIATAN'], 12);

  for (let i = 1; i < rawRows.length; i++) {
    const cols = rawRows[i];
    if (!cols || cols.length < 4) continue;

    const nama_urusan = (cols[idxUrusan] || '').trim();
    const kode_skpd = (cols[idxKodeSkpd] || '').trim();
    const nama_skpd = (cols[idxNamaSkpd] || '').trim();
    const kode_sub_unit = (cols[idxKodeSubUnit] || kode_skpd || '').trim();
    const nama_sub_unit = (cols[idxNamaSubUnit] || nama_skpd || '').trim();
    const kode_bidang_urusan = (cols[idxKodeBidang] || '').trim();
    const nama_bidang_urusan = (cols[idxNamaBidang] || '').trim();
    const kode_program = (cols[idxKodeProg] || '').trim();
    const nama_program = (cols[idxNamaProg] || '').trim();
    const kode_kegiatan = (cols[idxKodeKeg] || '').trim();
    const nama_kegiatan = (cols[idxNamaKeg] || '').trim();
    const kode_sub_kegiatan = (cols[idxKodeSubKeg] || '').trim();
    const nama_sub_kegiatan = (cols[idxNamaSubKeg] || '').trim();

    if (!kode_sub_kegiatan && !nama_sub_kegiatan) continue;

    const unitCanonical = canonicalizeInstansiName(nama_sub_unit || nama_skpd);
    const uniqueKey = `${unitCanonical}|${kode_program}|${kode_kegiatan}|${kode_sub_kegiatan}|${nama_sub_kegiatan}`;
    const uniqueSipdId = `${idPrefix}-u-${kode_sub_unit.replace(/[^a-zA-Z0-9]/g, '')}-${kode_sub_kegiatan.replace(/[^a-zA-Z0-9]/g, '')}`;

    const rowItem: KodeSipdItem = {
      sipd_id: `${idPrefix}-row-${i}`,
      nama_urusan,
      kode_skpd,
      nama_skpd,
      kode_sub_unit,
      nama_sub_unit,
      kode_bidang_urusan,
      nama_bidang_urusan,
      kode_program,
      nama_program,
      kode_kegiatan,
      nama_kegiatan,
      kode_sub_kegiatan,
      nama_sub_kegiatan,
    };

    allParsed.push(rowItem);

    if (!uniqueMap.has(uniqueKey)) {
      uniqueMap.set(uniqueKey, {
        ...rowItem,
        sipd_id: `${uniqueSipdId}-${uniqueMap.size + 1}`,
      });
    }
  }

  return {
    allParsed,
    uniqueParsed: Array.from(uniqueMap.values()),
  };
}

export class SipdService {
  /**
   * Memuat data Kode SIPD dari file CSV yang diunggah user atau CSV bawaan Kabupaten Blora
   */
  static async loadSipdDataset(): Promise<{
    uniqueRows: KodeSipdItem[];
    allRows: KodeSipdItem[];
  }> {
    const uploadedMaster = getUploadedMasterItems();
    if (uploadedMaster) {
      const merged = applyLocalOverrides(uploadedMaster);
      return {
        uniqueRows: merged,
        allRows: cachedAllCsvRows ? applyLocalOverrides(cachedAllCsvRows) : merged,
      };
    }

    if (cachedUniqueCsvRows && cachedAllCsvRows) {
      return {
        uniqueRows: applyLocalOverrides(cachedUniqueCsvRows),
        allRows: applyLocalOverrides(cachedAllCsvRows),
      };
    }

    if (loadingPromise) {
      return loadingPromise;
    }

    loadingPromise = (async () => {
      let csvText = '';
      for (const url of SIPD_CSV_URLS) {
        try {
          const res = await fetch(url);
          if (res.ok) {
            csvText = await res.text();
            if (csvText.trim().length > 100) break;
          }
        } catch {
          // try next fallback URL
        }
      }

      if (!csvText) {
        cachedAllCsvRows = [];
        cachedUniqueCsvRows = [];
        return {
          uniqueRows: applyLocalOverrides([]),
          allRows: applyLocalOverrides([]),
        };
      }

      const rawRows = parseDelimitedCsv(csvText, ';');
      const { allParsed, uniqueParsed } = parse2DRowsIntoSipdDataset(rawRows, 'sipd');

      cachedAllCsvRows = allParsed;
      cachedUniqueCsvRows = uniqueParsed;

      return {
        uniqueRows: applyLocalOverrides(cachedUniqueCsvRows),
        allRows: applyLocalOverrides(cachedAllCsvRows),
      };
    })();

    try {
      return await loadingPromise;
    } finally {
      loadingPromise = null;
    }
  }

  /**
   * Tambah atau Edit item Kode SIPD
   */
  static saveSipdItem(
    item: Omit<KodeSipdItem, 'sipd_id'> & { sipd_id?: string | null }
  ): KodeSipdItem {
    const cleanItem: KodeSipdItem = {
      sipd_id:
        item.sipd_id ||
        `sipd-custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      nama_urusan:
        item.nama_urusan.trim() ||
        'URUSAN PEMERINTAHAN WAJIB YANG BERKAITAN DENGAN PELAYANAN DASAR',
      kode_skpd: item.kode_skpd.trim() || '1.00.0.00.0.00.01.0000',
      nama_skpd: item.nama_skpd.trim().toUpperCase(),
      kode_sub_unit:
        item.kode_sub_unit.trim() ||
        item.kode_skpd.trim() ||
        '1.00.0.00.0.00.01.0000',
      nama_sub_unit: (item.nama_sub_unit.trim() || item.nama_skpd.trim()).toUpperCase(),
      kode_bidang_urusan:
        item.kode_bidang_urusan.trim() ||
        item.kode_program.trim().slice(0, 4) ||
        '1.01',
      nama_bidang_urusan:
        item.nama_bidang_urusan.trim().toUpperCase() || 'URUSAN PEMERINTAHAN DAERAH',
      kode_program:
        item.kode_program.trim() || item.kode_sub_kegiatan.trim().slice(0, 7),
      nama_program: item.nama_program.trim(),
      kode_kegiatan:
        item.kode_kegiatan.trim() || item.kode_sub_kegiatan.trim().slice(0, 12),
      nama_kegiatan: item.nama_kegiatan.trim(),
      kode_sub_kegiatan: item.kode_sub_kegiatan.trim(),
      nama_sub_kegiatan: item.nama_sub_kegiatan.trim(),
      is_custom: true,
    };

    const customList = getCustomSipdItems();
    const existingCustomIdx = customList.findIndex(
      (c) => c.sipd_id === cleanItem.sipd_id
    );

    if (existingCustomIdx >= 0) {
      customList[existingCustomIdx] = cleanItem;
      saveCustomSipdItems(customList);
    } else if (item.sipd_id && !item.sipd_id.startsWith('sipd-custom-')) {
      const editedMap = getEditedSipdMap();
      editedMap[item.sipd_id] = cleanItem;
      saveEditedSipdMap(editedMap);
    } else {
      saveCustomSipdItems([cleanItem, ...customList]);
    }

    return cleanItem;
  }

  /**
   * Hapus item Kode SIPD
   */
  static deleteSipdItem(sipdId: string): void {
    const customList = getCustomSipdItems();
    const filteredCustom = customList.filter((c) => c.sipd_id !== sipdId);
    if (filteredCustom.length !== customList.length) {
      saveCustomSipdItems(filteredCustom);
    }
    const deletedIds = getDeletedSipdIds();
    deletedIds.add(sipdId);
    saveDeletedSipdIds(deletedIds);
  }

  /**
   * Reset seluruh perubahan kustom ke data asli CSV kode_sipd_ok
   */
  static resetCustomChanges(): void {
    localStorage.removeItem(SIPD_STORAGE_KEYS.UPLOADED_MASTER);
    localStorage.removeItem(SIPD_STORAGE_KEYS.UPLOADED_META);
    localStorage.removeItem(SIPD_STORAGE_KEYS.CUSTOM_ITEMS);
    localStorage.removeItem(SIPD_STORAGE_KEYS.EDITED_MAP);
    localStorage.removeItem(SIPD_STORAGE_KEYS.DELETED_IDS);
    cachedAllCsvRows = null;
    cachedUniqueCsvRows = null;
  }

  /**
   * Import baris Kode SIPD dari file CSV atau Excel (.csv, .xlsx, .xls)
   * Mendukung mode 'replace' (ganti master CSV) maupun 'append' (tambahkan ke daftar)
   */
  static async importFromFile(
    file: File,
    mode: 'replace' | 'append' = 'replace'
  ): Promise<{ importedCount: number; totalRawRows: number; instansiCount: number }> {
    const fileName = file.name.toLowerCase();
    let rows2D: string[][] = [];

    if (fileName.endsWith('.csv')) {
      const text = await file.text();
      const firstLine = text.split(/\r?\n/)[0] || '';
      const semiCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;
      const delimiter =
        semiCount >= commaCount && semiCount >= tabCount
          ? ';'
          : tabCount > commaCount
          ? '\t'
          : ',';
      rows2D = parseDelimitedCsv(text, delimiter);
    } else {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheet = wb.Sheets[wb.SheetNames[0]];
      const rawJson = XLSX.utils.sheet_to_json<(string | number)[]>(firstSheet, {
        header: 1,
        defval: '',
      });
      rows2D = rawJson.map((r) => r.map((cell) => String(cell ?? '').trim()));
    }

    if (rows2D.length <= 1) {
      return { importedCount: 0, totalRawRows: 0, instansiCount: 0 };
    }

    const { allParsed, uniqueParsed } = parse2DRowsIntoSipdDataset(
      rows2D,
      `sipd-upl-${Date.now().toString(36)}`
    );

    if (uniqueParsed.length === 0) {
      return { importedCount: 0, totalRawRows: 0, instansiCount: 0 };
    }

    const unitSet = new Set(
      uniqueParsed.map((r) => canonicalizeInstansiName(r.nama_sub_unit || r.nama_skpd))
    );

    if (mode === 'replace') {
      cachedAllCsvRows = allParsed;
      cachedUniqueCsvRows = uniqueParsed;
      localStorage.removeItem(SIPD_STORAGE_KEYS.CUSTOM_ITEMS);
      localStorage.removeItem(SIPD_STORAGE_KEYS.EDITED_MAP);
      localStorage.removeItem(SIPD_STORAGE_KEYS.DELETED_IDS);
      saveUploadedMasterItems(uniqueParsed, {
        fileName: file.name,
        totalRawRows: allParsed.length,
        uniqueCount: uniqueParsed.length,
        uploadedAt: new Date().toISOString(),
      });
    } else {
      const customList = getCustomSipdItems();
      const markedCustom = uniqueParsed.map((item) => ({ ...item, is_custom: true }));
      saveCustomSipdItems([...markedCustom, ...customList]);
    }

    return {
      importedCount: uniqueParsed.length,
      totalRawRows: allParsed.length,
      instansiCount: unitSet.size,
    };
  }

  /**
   * Export daftar Kode SIPD yang sedang difilter ke Excel (.xlsx)
   */
  static exportToExcel(rows: KodeSipdItem[], filenameSuffix = 'Kab_Blora'): void {
    const sheetData = rows.map((r, idx) => ({
      NO: idx + 1,
      'NAMA URUSAN': r.nama_urusan,
      'KODE SKPD': r.kode_skpd,
      'NAMA SKPD': r.nama_skpd,
      'KODE SUB UNIT': r.kode_sub_unit,
      'NAMA SUB UNIT': r.nama_sub_unit,
      'KODE BIDANG URUSAN': r.kode_bidang_urusan,
      'NAMA BIDANG URUSAN': r.nama_bidang_urusan,
      'KODE PROGRAM': r.kode_program,
      'NAMA PROGRAM': r.nama_program,
      'KODE KEGIATAN': r.kode_kegiatan,
      'NAMA KEGIATAN': r.nama_kegiatan,
      'KODE SUB KEGIATAN': r.kode_sub_kegiatan,
      'NAMA SUB KEGIATAN': r.nama_sub_kegiatan,
    }));

    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws['!cols'] = [
      { wch: 6 },
      { wch: 38 },
      { wch: 24 },
      { wch: 36 },
      { wch: 24 },
      { wch: 36 },
      { wch: 16 },
      { wch: 34 },
      { wch: 14 },
      { wch: 42 },
      { wch: 16 },
      { wch: 44 },
      { wch: 20 },
      { wch: 52 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kode_SIPD');
    XLSX.writeFile(wb, `Referensi_Kode_SIPD_${filenameSuffix}.xlsx`);
  }

  /**
   * Export daftar Kode SIPD ke format CSV titik-koma (;) sesuai format SIPD
   */
  static exportToCsv(rows: KodeSipdItem[], filenameSuffix = 'Kab_Blora'): void {
    const header = [
      'NAMA URUSAN',
      'KODE SKPD',
      'NAMA SKPD',
      'KODE SUB UNIT',
      'NAMA SUB UNIT',
      'KODE BIDANG URUSAN',
      'NAMA BIDANG URUSAN',
      'KODE PROGRAM',
      'NAMA PROGRAM',
      'KODE KEGIATAN',
      'NAMA KEGIATAN',
      'KODE SUB KEGIATAN',
      'NAMA SUB KEGIATAN',
    ].join(';');

    const escapeCsv = (val: string) => {
      const clean = (val || '').replace(/"/g, '""');
      return clean.includes(';') || clean.includes('\n') ? `"${clean}"` : clean;
    };

    const lines = rows.map((r) =>
      [
        r.nama_urusan,
        r.kode_skpd,
        r.nama_skpd,
        r.kode_sub_unit,
        r.nama_sub_unit,
        r.kode_bidang_urusan,
        r.nama_bidang_urusan,
        r.kode_program,
        r.nama_program,
        r.kode_kegiatan,
        r.nama_kegiatan,
        r.kode_sub_kegiatan,
        r.nama_sub_kegiatan,
      ]
        .map(escapeCsv)
        .join(';')
    );

    const blob = new Blob([[header, ...lines].join('\r\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kode_SIPD_${filenameSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * Mencocokkan baris Kode SIPD dengan OPD di sistem OPTIMIS secara ketat (anti salah kamar)
   */
  static findMatchingOpdId(sipd: KodeSipdItem, allOpds: OPD[]): string | null {
    const sipdUnitCanon = canonicalizeInstansiName(sipd.nama_sub_unit || sipd.nama_skpd);
    if (!sipdUnitCanon) return null;

    const exactMatch = allOpds.find(
      (o) =>
        canonicalizeInstansiName(o.nama_opd) === sipdUnitCanon ||
        canonicalizeInstansiName(o.singkatan) === sipdUnitCanon
    );
    return exactMatch ? exactMatch.opd_id : null;
  }

  /**
   * Mengecek apakah baris SIPD dimiliki oleh OPD yang sedang aktif secara ketat (100% anti salah kamar).
   * Pencocokan dilakukan HANYA terhadap NAMA SUB UNIT (atau NAMA SKPD bila NAMA SUB UNIT kosong)
   * menggunakan nama kanonik sehingga kegiatan Dinsos PPPA tidak mungkin masuk ke dinas lain,
   * kegiatan Puskesmas/RSUD tidak bercampur dengan Dinkesda, dan Kelurahan tidak bercampur dengan Kecamatan.
   */
  static matchesActiveOpd(sipd: KodeSipdItem, activeOpd: OPD): boolean {
    const sipdUnitCanon = canonicalizeInstansiName(sipd.nama_sub_unit || sipd.nama_skpd);
    const opdNameCanon = canonicalizeInstansiName(activeOpd.nama_opd);
    const opdSingkatanCanon = canonicalizeInstansiName(activeOpd.singkatan);

    if (!sipdUnitCanon) return false;
    if (sipdUnitCanon === opdNameCanon) return true;
    if (opdSingkatanCanon && sipdUnitCanon === opdSingkatanCanon) return true;

    return false;
  }

  /**
   * Mengambil seluruh baris Kode SIPD khusus untuk 1 OPD/Instansi tertentu
   */
  static getSipdRowsForOpd(allRows: KodeSipdItem[], targetOpd: OPD): KodeSipdItem[] {
    return allRows.filter((row) => this.matchesActiveOpd(row, targetOpd));
  }
}
