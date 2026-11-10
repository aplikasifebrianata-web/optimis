import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Save,
  Send,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Lock,
  History,
  MapPin,
  Wallet,
  Layers,
  FileText,
  CalendarRange,
  BookOpen,
  Search,
  ChevronDown,
  Building2,
} from 'lucide-react';
import {
  AuditLog,
  EnrichedMatrixRow,
  KodeSipdItem,
  OPD,
  PeriodePelaporan,
  SifatBantuan,
  UserRole,
} from '../types/oppkpke';
import { SipdService } from '../services/sipdService';
import {
  BESARAN_MANFAAT_PRESETS,
  DURASI_BANTUAN_OPTIONS,
  JENIS_BANTUAN_OPTIONS,
  KECAMATAN_BLORA,
  STRATEGI_OPPKPKE_LIST,
  SUMBER_PEMBIAYAAN_OPTIONS,
} from '../data/bloraSeedData';
import {
  formatDateTimeID,
  formatKodeRekening,
  formatNumber,
  formatRupiah,
  parseNumericInput,
} from '../utils/formatters';
import { StatusIndicator } from './ui/StatusIndicator';

interface MatrixInputModalProps {
  isOpen: boolean;
  initialRow: EnrichedMatrixRow | null; // null berarti tambah baris baru
  initialSipdItem?: KodeSipdItem | null;
  allOpds: OPD[];
  activeOpd: OPD;
  activePeriode: PeriodePelaporan;
  selectedSemester?: 1 | 2;
  userRole: UserRole;
  auditLogs: AuditLog[];
  onClose: () => void;
  onSave: (params: {
    matrix_id?: string | null;
    periode_id: string;
    opd_id: string;
    opdUpdates: {
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
      lokasi_kecamatan: string;
      lokasi_desa: string;
      lokasi_spesifik: string;
      jumlah_sasaran: number;
      satuan_sasaran?: string;
      keterangan_sasaran?: string;
      besaran_manfaat: string;
      jenis_bantuan: string;
      durasi_pemberian_bantuan: string;
      keterangan_durasi_bantuan?: string;
    };
    sem1Input?: {
      realisasi: number;
      rincian_realisasi?: string;
      action: 'draft' | 'submit';
    };
    sem2Input?: {
      realisasi: number;
      rincian_realisasi?: string;
      action: 'draft' | 'submit';
    };
  }) => void;
}

const DURASI_SATUAN_LIST = [
  'kali',
  'kegiatan',
  'hari',
  'minggu',
  'bulan',
  'tahun',
] as const;

const DURASI_PRESET_ITEMS: { label: string; angka: number; satuan: string }[] = [
  { label: '1 kali', angka: 1, satuan: 'kali' },
  { label: '1 kegiatan', angka: 1, satuan: 'kegiatan' },
  { label: '3 bulan', angka: 3, satuan: 'bulan' },
  { label: '6 bulan', angka: 6, satuan: 'bulan' },
  { label: '1 tahun', angka: 1, satuan: 'tahun' },
];

function parseDurasiString(raw?: string): { angka: number; satuan: string } {
  if (!raw) return { angka: 1, satuan: 'tahun' };
  const lower = raw.trim().toLowerCase();
  if (lower.includes('satu kali')) return { angka: 1, satuan: 'kali' };
  if (lower.includes('satu kegiatan')) return { angka: 1, satuan: 'kegiatan' };
  if (lower.includes('tiga bulan')) return { angka: 3, satuan: 'bulan' };
  if (lower.includes('enam bulan')) return { angka: 6, satuan: 'bulan' };
  if (lower.includes('dua belas bulan') || lower.includes('setahun')) {
    return { angka: 1, satuan: 'tahun' };
  }
  const match = lower.match(/^(\d+)\s*(kali|kegiatan|hari|minggu|bulan|tahun)/i);
  if (match) {
    return {
      angka: Math.max(1, parseInt(match[1], 10) || 1),
      satuan: match[2].toLowerCase(),
    };
  }
  return { angka: 1, satuan: 'tahun' };
}

function extractNumericSasaranFromDescription(desc: string, fallback = 0): number {
  const cleaned = desc.replace(/\./g, '');
  const match = cleaned.match(/\d+/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
  }
  return fallback;
}

export const MatrixInputModal: React.FC<MatrixInputModalProps> = ({
  isOpen,
  initialRow,
  initialSipdItem = null,
  allOpds,
  activeOpd,
  activePeriode,
  selectedSemester = 1,
  userRole,
  auditLogs,
  onClose,
  onSave,
}) => {
  const isEditMode = Boolean(initialRow);
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Langkah 1: Identitas & Rekening Program (Terisolasi ketat per Instansi berdasarkan Master Kode SIPD)
  const [selectedOpdId, setSelectedOpdId] = useState<string>(activeOpd.opd_id);
  const [strategi, setStrategi] = useState<string>(STRATEGI_OPPKPKE_LIST[0]);
  const [kodeProgram, setKodeProgram] = useState<string>('');
  const [program, setProgram] = useState<string>('');
  const [kodeKegiatan, setKodeKegiatan] = useState<string>('');
  const [kegiatan, setKegiatan] = useState<string>('');
  const [subKegiatan, setSubKegiatan] = useState<string>('');
  const [kodeRekening, setKodeRekening] = useState<string>('');

  // State Dropdown Bertingkat Kode SIPD pada Langkah 1
  const [sipdList, setSipdList] = useState<KodeSipdItem[]>([]);
  const [openSipdDropdown, setOpenSipdDropdown] = useState<
    'program' | 'kegiatan' | 'sub_kegiatan' | null
  >(null);
  const [programSearchQuery, setProgramSearchQuery] = useState<string>('');
  const [kegiatanSearchQuery, setKegiatanSearchQuery] = useState<string>('');
  const [subKegiatanSearchQuery, setSubKegiatanSearchQuery] = useState<string>('');

  // Langkah 2: Aktivitas Real & Anggaran (Sumber Pendanaan bisa dipilih lebih dari 1, termasuk APBDP)
  const [aktivitasLangsung, setAktivitasLangsung] = useState<string>('');
  const [aktivitasTidakLangsung, setAktivitasTidakLangsung] = useState<string>('');
  const [aktivitasPenunjang, setAktivitasPenunjang] = useState<string>('');
  const [alokasiAnggaran, setAlokasiAnggaran] = useState<number>(0);
  const [selectedSumberList, setSelectedSumberList] = useState<string[]>(['APBD Kabupaten']);
  const [customSumberInput, setCustomSumberInput] = useState<string>('');

  // Langkah 3: Karakteristik, Lokasi Kegiatan & Sasaran Bantuan
  const [sifatBantuan, setSifatBantuan] = useState<SifatBantuan>('Berkelanjutan');
  const [lokasiKegiatan, setLokasiKegiatan] = useState<string>('Kabupaten Blora');
  const [deskripsiSasaran, setDeskripsiSasaran] = useState<string>('');
  const [besaranManfaat, setBesaranManfaat] = useState<string>('');
  const [jenisBantuan, setJenisBantuan] = useState<string>('Bantuan sosial');
  const [customJenisBantuan, setCustomJenisBantuan] = useState<string>('');
  const [durasiAngka, setDurasiAngka] = useState<number>(1);
  const [durasiSatuan, setDurasiSatuan] = useState<string>('tahun');
  const [keteranganDurasiBantuan, setKeteranganDurasiBantuan] = useState<string>('');

  const durasiBantuan = `${Math.max(1, durasiAngka || 1)} ${durasiSatuan}`;

  // Langkah 4: Realisasi & Rincian Realisasi Semester 1 & Semester 2
  const [realisasiSem1, setRealisasiSem1] = useState<number>(0);
  const [rincianRealisasiSem1, setRincianRealisasiSem1] = useState<string>('');
  const [realisasiSem2, setRealisasiSem2] = useState<number>(0);
  const [rincianRealisasiSem2, setRincianRealisasiSem2] = useState<string>('');

  // Sinkronisasi data saat modal dibuka
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep(1);

    if (initialRow) {
      setSelectedOpdId(initialRow.opd_id);
      setStrategi(initialRow.strategi || STRATEGI_OPPKPKE_LIST[0]);
      setKodeRekening(initialRow.kode || '');
      setKodeProgram('');
      setProgram(initialRow.program || '');
      setKodeKegiatan('');
      setKegiatan(initialRow.kegiatan || '');
      setSubKegiatan(initialRow.sub_kegiatan || '');

      setAktivitasLangsung(initialRow.aktivitas_real_langsung || '');
      setAktivitasTidakLangsung(initialRow.aktivitas_real_tidak_langsung || '');
      setAktivitasPenunjang(initialRow.aktivitas_real_penunjang || '');
      setAlokasiAnggaran(initialRow.alokasi_anggaran || 0);

      const rawSumber = initialRow.sumber_pembiayaan || 'APBD Kabupaten';
      const parsedSumber = rawSumber
        .split(/[,+]/)
        .map((s) => s.trim())
        .filter(Boolean);
      setSelectedSumberList(parsedSumber.length > 0 ? parsedSumber : ['APBD Kabupaten']);
      setCustomSumberInput('');

      setSifatBantuan(initialRow.sifat_bantuan || 'Berkelanjutan');
      setLokasiKegiatan(
        initialRow.lokasi ||
          [initialRow.lokasi_kecamatan, initialRow.lokasi_desa, initialRow.lokasi_spesifik]
            .filter(Boolean)
            .join(' · ') ||
          'Kabupaten Blora'
      );

      const initialDeskripsiSasaran =
        initialRow.keterangan_sasaran?.trim() ||
        (initialRow.jumlah_sasaran > 0
          ? `${formatNumber(initialRow.jumlah_sasaran)} ${initialRow.satuan_sasaran || 'KPM'}`
          : '');
      setDeskripsiSasaran(initialDeskripsiSasaran);
      setBesaranManfaat(initialRow.besaran_manfaat || '');

      if (
        JENIS_BANTUAN_OPTIONS.includes(initialRow.jenis_bantuan) ||
        !initialRow.jenis_bantuan
      ) {
        setJenisBantuan(initialRow.jenis_bantuan || 'Bantuan sosial');
        setCustomJenisBantuan('');
      } else {
        setJenisBantuan('Bantuan lainnya');
        setCustomJenisBantuan(initialRow.jenis_bantuan);
      }

      const parsedDurasi = parseDurasiString(initialRow.durasi_pemberian_bantuan);
      setDurasiAngka(parsedDurasi.angka);
      setDurasiSatuan(parsedDurasi.satuan);
      setKeteranganDurasiBantuan(initialRow.keterangan_durasi_bantuan || '');

      setRealisasiSem1(initialRow.sem1.realisasi || 0);
      setRincianRealisasiSem1(initialRow.sem1.rincian_realisasi || '');
      setRealisasiSem2(initialRow.sem2.realisasi || 0);
      setRincianRealisasiSem2(initialRow.sem2.rincian_realisasi || '');
    } else {
      // Default untuk Tambah Baris Baru oleh Instansi (OPD) atau Admin
      const matchedOpdId =
        userRole === 'ADMIN' && initialSipdItem
          ? SipdService.findMatchingOpdId(initialSipdItem, allOpds) || activeOpd.opd_id
          : activeOpd.opd_id;
      const targetOpd = allOpds.find((o) => o.opd_id === matchedOpdId) || activeOpd;
      const isSipdValidForOpd =
        initialSipdItem && SipdService.matchesActiveOpd(initialSipdItem, targetOpd);

      setSelectedOpdId(matchedOpdId);
      setStrategi(STRATEGI_OPPKPKE_LIST[0]);
      setKodeProgram(isSipdValidForOpd ? initialSipdItem.kode_program : '');
      setProgram(isSipdValidForOpd ? initialSipdItem.nama_program : '');
      setKodeKegiatan(isSipdValidForOpd ? initialSipdItem.kode_kegiatan : '');
      setKegiatan(isSipdValidForOpd ? initialSipdItem.nama_kegiatan : '');
      setSubKegiatan(isSipdValidForOpd ? initialSipdItem.nama_sub_kegiatan : '');
      setKodeRekening(isSipdValidForOpd ? initialSipdItem.kode_sub_kegiatan : '');
      setAktivitasLangsung('');
      setAktivitasTidakLangsung('');
      setAktivitasPenunjang('');
      setAlokasiAnggaran(0);
      setSelectedSumberList(['APBD Kabupaten']);
      setCustomSumberInput('');
      setSifatBantuan('Berkelanjutan');
      setLokasiKegiatan('Kabupaten Blora');
      setDeskripsiSasaran('');
      setBesaranManfaat('');
      setJenisBantuan('Bantuan sosial');
      setCustomJenisBantuan('');
      setDurasiAngka(1);
      setDurasiSatuan('tahun');
      setKeteranganDurasiBantuan('');
      setRealisasiSem1(0);
      setRincianRealisasiSem1('');
      setRealisasiSem2(0);
      setRincianRealisasiSem2('');
    }

    setOpenSipdDropdown(null);
    setProgramSearchQuery('');
    setKegiatanSearchQuery('');
    setSubKegiatanSearchQuery('');

    void SipdService.loadSipdDataset().then((res) => {
      setSipdList(res.uniqueRows);
    });
  }, [isOpen, initialRow, initialSipdItem, activeOpd, allOpds, userRole]);

  // Instansi target yang aktif untuk isolasi Kode SIPD (100% Anti Salah Kamar)
  const targetOpdForSipd = useMemo(() => {
    if (userRole !== 'ADMIN') return activeOpd;
    return allOpds.find((o) => o.opd_id === selectedOpdId) || activeOpd;
  }, [allOpds, selectedOpdId, activeOpd, userRole]);

  // Hanya memuat baris Kode SIPD milik instansi terkait (tidak pernah bocor ke instansi lain)
  const opdSipdRows = useMemo(() => {
    return SipdService.getSipdRowsForOpd(sipdList, targetOpdForSipd);
  }, [sipdList, targetOpdForSipd]);

  // Saat mode Edit, sinkronkan kodeProgram & kodeKegiatan dari opdSipdRows bila cocok
  useEffect(() => {
    if (!isOpen || opdSipdRows.length === 0) return;
    if (kodeRekening && (!kodeProgram || !kodeKegiatan)) {
      const matchedBySub = opdSipdRows.find(
        (r) =>
          r.kode_sub_kegiatan === kodeRekening ||
          (subKegiatan && r.nama_sub_kegiatan.toLowerCase() === subKegiatan.toLowerCase())
      );
      if (matchedBySub) {
        if (!kodeProgram) setKodeProgram(matchedBySub.kode_program);
        if (!kodeKegiatan) setKodeKegiatan(matchedBySub.kode_kegiatan);
        return;
      }
    }
    if (program && !kodeProgram) {
      const matchedProg = opdSipdRows.find(
        (r) => r.nama_program.toLowerCase() === program.toLowerCase()
      );
      if (matchedProg) setKodeProgram(matchedProg.kode_program);
    }
    if (kegiatan && !kodeKegiatan) {
      const matchedKeg = opdSipdRows.find(
        (r) => r.nama_kegiatan.toLowerCase() === kegiatan.toLowerCase()
      );
      if (matchedKeg) setKodeKegiatan(matchedKeg.kode_kegiatan);
    }
  }, [isOpen, opdSipdRows, kodeRekening, subKegiatan, program, kegiatan, kodeProgram, kodeKegiatan]);

  // LEVEL 1: Daftar Kode Program + Nama Program khusus Instansi ini
  const programOptions = useMemo(() => {
    const map = new Map<
      string,
      { kode_program: string; nama_program: string; kegiatanCount: number; subCount: number }
    >();
    const kegTracker = new Map<string, Set<string>>();

    opdSipdRows.forEach((r) => {
      if (!r.nama_program) return;
      const key = `${r.kode_program}|${r.nama_program}`;
      if (!map.has(key)) {
        map.set(key, {
          kode_program: r.kode_program,
          nama_program: r.nama_program,
          kegiatanCount: 0,
          subCount: 0,
        });
        kegTracker.set(key, new Set());
      }
      const entry = map.get(key)!;
      entry.subCount += 1;
      const kSet = kegTracker.get(key)!;
      kSet.add(`${r.kode_kegiatan}|${r.nama_kegiatan}`);
      entry.kegiatanCount = kSet.size;
    });

    return Array.from(map.values()).sort((a, b) =>
      a.kode_program.localeCompare(b.kode_program)
    );
  }, [opdSipdRows]);

  const filteredProgramOptions = useMemo(() => {
    const q = programSearchQuery.trim().toLowerCase();
    if (!q) return programOptions;
    return programOptions.filter(
      (p) =>
        p.kode_program.toLowerCase().includes(q) ||
        p.nama_program.toLowerCase().includes(q)
    );
  }, [programOptions, programSearchQuery]);

  // LEVEL 2: Daftar Kode Kegiatan + Nama Kegiatan sesuai Program yang dipilih pada Instansi ini
  const kegiatanOptions = useMemo(() => {
    if (!program) return [];
    const map = new Map<
      string,
      { kode_kegiatan: string; nama_kegiatan: string; subCount: number }
    >();

    opdSipdRows.forEach((r) => {
      const matchProg = kodeProgram
        ? r.kode_program === kodeProgram && r.nama_program === program
        : r.nama_program.toLowerCase() === program.toLowerCase();
      if (!matchProg || !r.nama_kegiatan) return;

      const key = `${r.kode_kegiatan}|${r.nama_kegiatan}`;
      if (!map.has(key)) {
        map.set(key, {
          kode_kegiatan: r.kode_kegiatan,
          nama_kegiatan: r.nama_kegiatan,
          subCount: 1,
        });
      } else {
        map.get(key)!.subCount += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.kode_kegiatan.localeCompare(b.kode_kegiatan)
    );
  }, [opdSipdRows, kodeProgram, program]);

  const filteredKegiatanOptions = useMemo(() => {
    const q = kegiatanSearchQuery.trim().toLowerCase();
    if (!q) return kegiatanOptions;
    return kegiatanOptions.filter(
      (k) =>
        k.kode_kegiatan.toLowerCase().includes(q) ||
        k.nama_kegiatan.toLowerCase().includes(q)
    );
  }, [kegiatanOptions, kegiatanSearchQuery]);

  // LEVEL 3: Daftar Kode Sub Kegiatan + Nama Sub Kegiatan sesuai Kegiatan yang dipilih pada Instansi ini
  const subKegiatanOptions = useMemo(() => {
    if (!program || !kegiatan) return [];
    const map = new Map<
      string,
      { kode_sub_kegiatan: string; nama_sub_kegiatan: string; item: KodeSipdItem }
    >();

    opdSipdRows.forEach((r) => {
      const matchProg = kodeProgram
        ? r.kode_program === kodeProgram && r.nama_program === program
        : r.nama_program.toLowerCase() === program.toLowerCase();
      const matchKeg = kodeKegiatan
        ? r.kode_kegiatan === kodeKegiatan && r.nama_kegiatan === kegiatan
        : r.nama_kegiatan.toLowerCase() === kegiatan.toLowerCase();
      if (!matchProg || !matchKeg || !r.nama_sub_kegiatan) return;

      const key = `${r.kode_sub_kegiatan}|${r.nama_sub_kegiatan}`;
      if (!map.has(key)) {
        map.set(key, {
          kode_sub_kegiatan: r.kode_sub_kegiatan,
          nama_sub_kegiatan: r.nama_sub_kegiatan,
          item: r,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.kode_sub_kegiatan.localeCompare(b.kode_sub_kegiatan)
    );
  }, [opdSipdRows, kodeProgram, program, kodeKegiatan, kegiatan]);

  const filteredSubKegiatanOptions = useMemo(() => {
    const q = subKegiatanSearchQuery.trim().toLowerCase();
    if (!q) return subKegiatanOptions;
    return subKegiatanOptions.filter(
      (s) =>
        s.kode_sub_kegiatan.toLowerCase().includes(q) ||
        s.nama_sub_kegiatan.toLowerCase().includes(q)
    );
  }, [subKegiatanOptions, subKegiatanSearchQuery]);

  const finalSumberPembiayaan = useMemo(() => {
    if (selectedSumberList.length === 0) return 'APBD Kabupaten';
    return selectedSumberList.join(', ');
  }, [selectedSumberList]);

  const toggleSumberPendanaan = (item: string) => {
    setSelectedSumberList((prev) => {
      if (prev.includes(item)) {
        return prev.length > 1 ? prev.filter((x) => x !== item) : prev;
      }
      return [...prev, item];
    });
  };

  const handleAddCustomSumber = () => {
    const clean = customSumberInput.trim();
    if (!clean) return;
    if (!selectedSumberList.includes(clean)) {
      setSelectedSumberList((prev) => [...prev, clean]);
    }
    setCustomSumberInput('');
  };

  const finalJenisBantuan =
    jenisBantuan === 'Bantuan lainnya'
      ? customJenisBantuan.trim() || 'Bantuan lainnya'
      : jenisBantuan;

  // Jika status Terverifikasi, otomatis OPD tidak bisa mengubah data terverifikasi tersebut (terkunci)
  const isSem1Locked =
    userRole === 'OPD' && initialRow?.sem1.status_verifikasi === 'Terverifikasi';
  const isSem2Locked =
    userRole === 'OPD' && initialRow?.sem2.status_verifikasi === 'Terverifikasi';
  const isActiveSemesterLocked = selectedSemester === 1 ? isSem1Locked : isSem2Locked;

  const activeSemRealisasi = selectedSemester === 1 ? realisasiSem1 : realisasiSem2;

  // Indikator Kelengkapan Tiap Langkah
  const step1Done = Boolean(
    strategi && kodeRekening.trim() && program.trim() && kegiatan.trim() && subKegiatan.trim()
  );
  // Pengisian aktivitas real cukup mengisi salah satu (Langsung, Tidak Langsung, atau Penunjang)
  const hasAktivitas = Boolean(
    aktivitasLangsung.trim() ||
      aktivitasTidakLangsung.trim() ||
      aktivitasPenunjang.trim()
  );
  const step2Done = Boolean(hasAktivitas && alokasiAnggaran > 0 && selectedSumberList.length > 0);
  const step3Done = Boolean(
    sifatBantuan &&
      lokasiKegiatan.trim() &&
      deskripsiSasaran.trim() &&
      besaranManfaat.trim() &&
      finalJenisBantuan.trim() &&
      durasiBantuan.trim()
  );
  const step4Done = Boolean(
    selectedSemester === 1 ? realisasiSem1 > 0 : realisasiSem1 > 0 || realisasiSem2 > 0
  );

  // Progres Bar Kelengkapan Pengisian Matriks (0 - 100%)
  const modalProgressPercent = useMemo(() => {
    let score = 0;
    const maxScore = 8;
    if (kodeRekening.trim() && subKegiatan.trim()) score += 1;
    if (program.trim() && kegiatan.trim()) score += 1;
    if (hasAktivitas) score += 1;
    if (alokasiAnggaran > 0) score += 1;
    if (selectedSumberList.length > 0) score += 1;
    if (deskripsiSasaran.trim() && lokasiKegiatan.trim()) score += 1;
    if (besaranManfaat.trim() && finalJenisBantuan.trim()) score += 1;
    if (activeSemRealisasi > 0) score += 1;
    return Math.round((score / maxScore) * 100);
  }, [
    kodeRekening,
    subKegiatan,
    program,
    kegiatan,
    hasAktivitas,
    alokasiAnggaran,
    selectedSumberList,
    deskripsiSasaran,
    lokasiKegiatan,
    besaranManfaat,
    finalJenisBantuan,
    activeSemRealisasi,
  ]);

  if (!isOpen) return null;

  const steps = [
    {
      num: 1 as const,
      title: 'Rekening & Program',
      subtitle: 'Kode rekening s.d. subkegiatan',
      icon: <Layers className="w-4 h-4" />,
      done: step1Done,
    },
    {
      num: 2 as const,
      title: 'Aktivitas & Anggaran',
      subtitle: 'Aktivitas real & pagu Rp',
      icon: <Wallet className="w-4 h-4" />,
      done: step2Done,
    },
    {
      num: 3 as const,
      title: 'Karakteristik & Sasaran',
      subtitle: 'Lokasi, sasaran & durasi',
      icon: <MapPin className="w-4 h-4" />,
      done: step3Done,
    },
    {
      num: 4 as const,
      title:
        selectedSemester === 1
          ? 'Realisasi Semester 1'
          : 'Realisasi Sem 1 & Sem 2',
      subtitle:
        selectedSemester === 1
          ? 'Periode Januari – Juni'
          : 'Semester 1 & Semester 2',
      icon: <CalendarRange className="w-4 h-4" />,
      done: step4Done,
    },
  ];

  const sem1Logs = initialRow
    ? auditLogs.filter((l) => l.matrix_id === initialRow.matrix_id && l.semester === 1)
    : [];
  const sem2Logs = initialRow
    ? auditLogs.filter((l) => l.matrix_id === initialRow.matrix_id && l.semester === 2)
    : [];

  const triggerSave = (
    sem1Action: 'draft' | 'submit' | 'none',
    sem2Action: 'draft' | 'submit' | 'none',
    closeAfter = true
  ) => {
    const cleanLokasi = lokasiKegiatan.trim() || 'Kabupaten Blora';
    const cleanDeskripsiSasaran = deskripsiSasaran.trim();
    const numericSasaran = extractNumericSasaranFromDescription(
      cleanDeskripsiSasaran,
      initialRow?.jumlah_sasaran ?? 0
    );

    onSave({
      matrix_id: initialRow ? initialRow.matrix_id : null,
      periode_id: activePeriode.periode_id,
      opd_id: userRole === 'ADMIN' ? selectedOpdId : activeOpd.opd_id,
      opdUpdates: {
        strategi,
        kode: kodeRekening.trim() || '1.00.01.2.01.0001',
        program: program.trim() || 'Program Penanggulangan Kemiskinan Daerah',
        kegiatan: kegiatan.trim() || 'Kegiatan Intervensi Kemiskinan Ekstrem',
        sub_kegiatan: subKegiatan.trim() || 'Sub Kegiatan Penanganan Kemiskinan',
        aktivitas_real_langsung: aktivitasLangsung,
        aktivitas_real_tidak_langsung: aktivitasTidakLangsung,
        aktivitas_real_penunjang: aktivitasPenunjang,
        alokasi_anggaran: alokasiAnggaran,
        sumber_pembiayaan: finalSumberPembiayaan,
        sifat_bantuan: sifatBantuan,
        lokasi: cleanLokasi,
        lokasi_kecamatan: cleanLokasi,
        lokasi_desa: '',
        lokasi_spesifik: cleanLokasi,
        jumlah_sasaran: numericSasaran,
        satuan_sasaran: initialRow?.satuan_sasaran || 'KPM',
        keterangan_sasaran: cleanDeskripsiSasaran,
        besaran_manfaat: besaranManfaat,
        jenis_bantuan: finalJenisBantuan,
        durasi_pemberian_bantuan: durasiBantuan,
        keterangan_durasi_bantuan: keteranganDurasiBantuan.trim(),
      },
      sem1Input:
        !isSem1Locked && sem1Action !== 'none'
          ? {
              realisasi: realisasiSem1,
              rincian_realisasi: rincianRealisasiSem1.trim(),
              action: sem1Action,
            }
          : undefined,
      sem2Input:
        !isSem2Locked && sem2Action !== 'none'
          ? {
              realisasi: realisasiSem2,
              rincian_realisasi: rincianRealisasiSem2.trim(),
              action: sem2Action,
            }
          : undefined,
    });

    if (closeAfter) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 lg:p-6 overflow-y-auto"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 14 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl border border-slate-200/90 shadow-[0_24px_60px_-15px_rgba(15,23,42,0.22)] w-[96vw] xl:w-[88vw] max-w-7xl max-h-[94vh] flex flex-col overflow-hidden"
          >
            {/* Header Popout Modal dengan Gradien Lembut */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#EEF4FF] via-[#F5F8FF] to-white border-b border-slate-200/80 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#2563EB] text-white flex items-center justify-center shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)] shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#2563EB]">
                    <span>
                      {isEditMode
                        ? 'Edit Data Matriks & Realisasi OPD'
                        : 'Input Data Matriks Baru (Mulai Rekening s.d. Realisasi)'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="px-2 py-0.5 rounded-md bg-blue-100/80 text-[#1D4ED8]">
                      TA {activePeriode.tahun} · Semester {selectedSemester} (Dibuka)
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-0.5 line-clamp-1">
                    {subKegiatan.trim()
                      ? subKegiatan
                      : 'Formulir Popout Matriks OPTIMIS (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)'}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-white/80 transition-colors cursor-pointer"
                aria-label="Tutup Popout"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Bar (4 Card Langkah) + Progress Bar Memanjang Penuh di Bawahnya */}
            <div className="px-6 pt-3.5 pb-3 bg-[#F8FAFF] border-b border-slate-200/70 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                {steps.map((s) => {
                  const isActive = currentStep === s.num;
                  return (
                    <button
                      key={s.num}
                      type="button"
                      onClick={() => setCurrentStep(s.num)}
                      className={`p-2.5 rounded-2xl border text-left transition-all flex items-center gap-2.5 cursor-pointer ${
                        isActive
                          ? 'bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] text-white border-transparent shadow-[0_6px_16px_-4px_rgba(37,99,235,0.4)]'
                          : 'bg-white text-slate-700 border-slate-200/80 hover:border-blue-300'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : s.done
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.done && !isActive ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          s.num
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{s.title}</p>
                        <p
                          className={`text-[10px] truncate ${
                            isActive ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {s.subtitle}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Progress Bar Memanjang di Bawah Card (Dari Card Rekening & Program s.d. Realisasi) */}
              <div className="w-full space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      Progres Kelengkapan Pengisian Matriks (Rekening s.d. Realisasi Semester {selectedSemester}):
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        modalProgressPercent === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : modalProgressPercent >= 60
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {modalProgressPercent === 100
                        ? 'Lengkap 100%'
                        : modalProgressPercent >= 60
                        ? 'Hampir Lengkap'
                        : 'Dalam Pengisian'}
                    </span>
                  </div>
                  <span className="font-mono-tabular font-bold text-[#2563EB]">
                    {modalProgressPercent}%
                  </span>
                </div>
                <div className="w-full h-3 bg-slate-200/80 rounded-full overflow-hidden border border-slate-300/60 shadow-inner">
                  <div
                    className={`h-full transition-all duration-300 rounded-full ${
                      modalProgressPercent === 100
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-500'
                        : modalProgressPercent >= 60
                        ? 'bg-gradient-to-r from-[#2563EB] via-blue-500 to-indigo-600'
                        : 'bg-gradient-to-r from-amber-400 to-amber-500'
                    }`}
                    style={{ width: `${Math.max(4, modalProgressPercent)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Isi Konten Langkah Aktif */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isActiveSemesterLocked && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs text-emerald-900">
                  <Lock className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-bold">
                      Data Semester {selectedSemester} (TA {activePeriode.tahun}) Telah Terverifikasi & Terkunci Otomatis
                    </p>
                    <p className="text-emerald-800 leading-relaxed">
                      Data matriks dan realisasi pada semester ini telah diverifikasi oleh Admin Bapperida sehingga OPD tidak dapat mengubah data yang sudah terverifikasi.
                    </p>
                  </div>
                </div>
              )}
              <fieldset disabled={isActiveSemesterLocked} className="space-y-5 contents">
              <AnimatePresence mode="wait">
                {/* LANGKAH 1: REKENING & PROGRAM (Dropdown Bertingkat Sesuai Kode SIPD Instansi — Anti Salah Kamar) */}
                {currentStep === 1 && (
                  <motion.div
                    key="step-1"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Langkah 1: Rekening & Program (Sesuai Kode SIPD Instansi)
                        </h3>
                        <p className="text-xs text-slate-500">
                          Pilih berurutan: <strong>1. Program</strong> → <strong>2. Kegiatan</strong> → <strong>3. Sub Kegiatan</strong>. Sistem otomatis menampilkan Kode Sub Kegiatan khusus untuk instansi Anda.
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>
                          Terisolasi Khusus {targetOpdForSipd.singkatan} ({opdSipdRows.length} Sub Kegiatan SIPD)
                        </span>
                      </div>
                    </div>

                    {/* Baris Identitas Instansi & Strategi OPPKPKE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Instansi / Perangkat Daerah Pengampu <span className="text-rose-600">*</span>
                        </label>
                        {userRole === 'ADMIN' ? (
                          <select
                            value={selectedOpdId}
                            onChange={(e) => {
                              setSelectedOpdId(e.target.value);
                              // Reset pilihan Program, Kegiatan, Sub Kegiatan & Kode saat Admin berganti Instansi agar tidak salah kamar
                              setKodeProgram('');
                              setProgram('');
                              setKodeKegiatan('');
                              setKegiatan('');
                              setSubKegiatan('');
                              setKodeRekening('');
                              setOpenSipdDropdown(null);
                              setProgramSearchQuery('');
                              setKegiatanSearchQuery('');
                              setSubKegiatanSearchQuery('');
                            }}
                            className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
                          >
                            {allOpds.map((o) => (
                              <option key={o.opd_id} value={o.opd_id}>
                                {o.singkatan} — {o.nama_opd}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <div className="px-3.5 py-2.5 text-xs font-bold text-[#1E3A8A] bg-blue-50/70 border border-blue-200/80 rounded-xl flex items-center justify-between gap-2">
                            <span className="truncate">
                              {activeOpd.singkatan} — {activeOpd.nama_opd}
                            </span>
                            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1D4ED8] text-[10px] font-extrabold shrink-0">
                              Terkunci Sesuai Instansi
                            </span>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Strategi OPPKPKE <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={strategi}
                          onChange={(e) => setStrategi(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
                        >
                          {STRATEGI_OPPKPKE_LIST.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* KOTAK UTAMA PEMILIHAN BERTINGKAT KODE SIPD (URUTAN 1 -> 2 -> 3 -> OTOMATIS KODE SUB KEGIATAN) */}
                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#F4F8FF] to-white border border-blue-200/80 space-y-4 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#2563EB] shrink-0" />
                          <span className="text-xs font-extrabold text-slate-900">
                            Katalog Nomenklatur SIPD: {targetOpdForSipd.nama_opd}
                          </span>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-600">
                          Tersedia <strong className="text-[#1D4ED8]">{programOptions.length} Program</strong> ·{' '}
                          <strong className="text-[#1D4ED8]">{opdSipdRows.length} Sub Kegiatan</strong>
                        </span>
                      </div>

                      {/* TAHAP 1: PILIH KODE PROGRAM + NAMA PROGRAM (Dropdown dengan Pencarian) */}
                      <div className="space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            1. Pilih Kode Program + Nama Program <span className="text-rose-600">*</span>
                          </label>
                          <span className="text-[10.5px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/60">
                            {programOptions.length} Program pada {targetOpdForSipd.singkatan}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            setOpenSipdDropdown((prev) => (prev === 'program' ? null : 'program'))
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 cursor-pointer ${
                            openSipdDropdown === 'program'
                              ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20'
                              : program
                              ? 'bg-white border-indigo-300 hover:border-[#2563EB]'
                              : 'bg-white border-slate-300 hover:border-[#2563EB]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            {program ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {kodeProgram && (
                                  <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-xs font-bold shrink-0">
                                    {kodeProgram}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900">
                                  {program}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                -- Klik untuk memilih Kode Program + Nama Program ({targetOpdForSipd.singkatan}) --
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                              openSipdDropdown === 'program' ? 'rotate-180 text-[#2563EB]' : ''
                            }`}
                          />
                        </button>

                        {openSipdDropdown === 'program' && (
                          <div className="mt-1.5 p-2.5 bg-white rounded-2xl border border-blue-300 shadow-xl space-y-2 z-30">
                            <div className="relative">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                autoFocus
                                value={programSearchQuery}
                                onChange={(e) => setProgramSearchQuery(e.target.value)}
                                placeholder={`Cari Kode Program atau Nama Program di ${targetOpdForSipd.singkatan}...`}
                                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
                              />
                              {programSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setProgramSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                              {filteredProgramOptions.length === 0 ? (
                                <p className="p-3 text-xs text-slate-500 text-center">
                                  Tidak ditemukan Program yang cocok untuk {targetOpdForSipd.nama_opd}.
                                </p>
                              ) : (
                                filteredProgramOptions.map((item) => {
                                  const isSelected =
                                    program === item.nama_program &&
                                    (!kodeProgram || kodeProgram === item.kode_program);
                                  return (
                                    <button
                                      key={`${item.kode_program}-${item.nama_program}`}
                                      type="button"
                                      onClick={() => {
                                        setKodeProgram(item.kode_program);
                                        setProgram(item.nama_program);
                                        // Reset Kegiatan, Sub Kegiatan, dan Kode Sub Kegiatan saat Program berubah
                                        setKodeKegiatan('');
                                        setKegiatan('');
                                        setSubKegiatan('');
                                        setKodeRekening('');
                                        setKegiatanSearchQuery('');
                                        setSubKegiatanSearchQuery('');
                                        setOpenSipdDropdown('kegiatan');
                                      }}
                                      className={`w-full p-2.5 text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-50/90 text-indigo-950'
                                          : 'hover:bg-blue-50/60 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 font-mono text-xs font-bold shrink-0">
                                          {item.kode_program}
                                        </span>
                                        <span className="text-xs font-bold leading-snug">
                                          {item.nama_program}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                        {item.kegiatanCount} Kegiatan
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TAHAP 2: PILIH KODE KEGIATAN + NAMA KEGIATAN SESUAI PROGRAM (Dropdown dengan Pencarian) */}
                      <div className="space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            2. Pilih Kode Kegiatan + Nama Kegiatan <span className="text-rose-600">*</span>
                          </label>
                          <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                            {program
                              ? `${kegiatanOptions.length} Kegiatan sesuai Program`
                              : 'Pilih Program terlebih dahulu'}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={!program}
                          onClick={() =>
                            setOpenSipdDropdown((prev) => (prev === 'kegiatan' ? null : 'kegiatan'))
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                            !program
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : openSipdDropdown === 'kegiatan'
                              ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 cursor-pointer'
                              : kegiatan
                              ? 'bg-white border-emerald-300 hover:border-[#2563EB] cursor-pointer'
                              : 'bg-white border-slate-300 hover:border-[#2563EB] cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            {kegiatan ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {kodeKegiatan && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-mono text-xs font-bold shrink-0">
                                    {kodeKegiatan}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900">
                                  {kegiatan}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                {program
                                  ? '-- Klik untuk memilih Kode Kegiatan + Nama Kegiatan --'
                                  : '-- Pilih Kode Program + Nama Program pada langkah 1 terlebih dahulu --'}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                              openSipdDropdown === 'kegiatan' ? 'rotate-180 text-[#2563EB]' : ''
                            }`}
                          />
                        </button>

                        {openSipdDropdown === 'kegiatan' && program && (
                          <div className="mt-1.5 p-2.5 bg-white rounded-2xl border border-blue-300 shadow-xl space-y-2 z-30">
                            <div className="relative">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                autoFocus
                                value={kegiatanSearchQuery}
                                onChange={(e) => setKegiatanSearchQuery(e.target.value)}
                                placeholder="Cari Kode Kegiatan atau Nama Kegiatan pada Program ini..."
                                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
                              />
                              {kegiatanSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setKegiatanSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                              {filteredKegiatanOptions.length === 0 ? (
                                <p className="p-3 text-xs text-slate-500 text-center">
                                  Tidak ditemukan Kegiatan yang cocok pada Program ini.
                                </p>
                              ) : (
                                filteredKegiatanOptions.map((item) => {
                                  const isSelected =
                                    kegiatan === item.nama_kegiatan &&
                                    (!kodeKegiatan || kodeKegiatan === item.kode_kegiatan);
                                  return (
                                    <button
                                      key={`${item.kode_kegiatan}-${item.nama_kegiatan}`}
                                      type="button"
                                      onClick={() => {
                                        setKodeKegiatan(item.kode_kegiatan);
                                        setKegiatan(item.nama_kegiatan);
                                        // Reset Sub Kegiatan dan Kode Sub Kegiatan saat Kegiatan berubah
                                        setSubKegiatan('');
                                        setKodeRekening('');
                                        setSubKegiatanSearchQuery('');
                                        setOpenSipdDropdown('sub_kegiatan');
                                      }}
                                      className={`w-full p-2.5 text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                        isSelected
                                          ? 'bg-emerald-50/90 text-emerald-950'
                                          : 'hover:bg-blue-50/60 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-xs font-bold shrink-0">
                                          {item.kode_kegiatan}
                                        </span>
                                        <span className="text-xs font-bold leading-snug">
                                          {item.nama_kegiatan}
                                        </span>
                                      </div>
                                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                                        {item.subCount} Sub Kegiatan
                                      </span>
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TAHAP 3: PILIH KODE SUB KEGIATAN + NAMA SUB KEGIATAN SESUAI KEGIATAN (Dropdown dengan Pencarian) */}
                      <div className="space-y-1.5 relative">
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-800">
                            3. Pilih Kode Sub Kegiatan + Nama Sub Kegiatan <span className="text-rose-600">*</span>
                          </label>
                          <span className="text-[10.5px] font-semibold text-[#1D4ED8] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/60">
                            {kegiatan
                              ? `${subKegiatanOptions.length} Sub Kegiatan sesuai Kegiatan`
                              : 'Pilih Kegiatan terlebih dahulu'}
                          </span>
                        </div>

                        <button
                          type="button"
                          disabled={!program || !kegiatan}
                          onClick={() =>
                            setOpenSipdDropdown((prev) =>
                              prev === 'sub_kegiatan' ? null : 'sub_kegiatan'
                            )
                          }
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                            !program || !kegiatan
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                              : openSipdDropdown === 'sub_kegiatan'
                              ? 'bg-white border-[#2563EB] ring-2 ring-[#2563EB]/20 cursor-pointer'
                              : subKegiatan
                              ? 'bg-white border-blue-300 hover:border-[#2563EB] cursor-pointer'
                              : 'bg-white border-slate-300 hover:border-[#2563EB] cursor-pointer'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            {subKegiatan ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {kodeRekening && (
                                  <span className="px-2 py-0.5 rounded-md bg-[#2563EB] text-white font-mono text-xs font-bold shrink-0">
                                    {kodeRekening}
                                  </span>
                                )}
                                <span className="text-xs font-bold text-slate-900">
                                  {subKegiatan}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">
                                {kegiatan
                                  ? '-- Klik untuk memilih Kode Sub Kegiatan + Nama Sub Kegiatan --'
                                  : '-- Pilih Kode Kegiatan + Nama Kegiatan pada langkah 2 terlebih dahulu --'}
                              </span>
                            )}
                          </div>
                          <ChevronDown
                            className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                              openSipdDropdown === 'sub_kegiatan'
                                ? 'rotate-180 text-[#2563EB]'
                                : ''
                            }`}
                          />
                        </button>

                        {openSipdDropdown === 'sub_kegiatan' && program && kegiatan && (
                          <div className="mt-1.5 p-2.5 bg-white rounded-2xl border border-blue-300 shadow-xl space-y-2 z-30">
                            <div className="relative">
                              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                autoFocus
                                value={subKegiatanSearchQuery}
                                onChange={(e) => setSubKegiatanSearchQuery(e.target.value)}
                                placeholder="Cari Kode Sub Kegiatan atau Nama Sub Kegiatan pada Kegiatan ini..."
                                className="w-full pl-9 pr-8 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
                              />
                              {subKegiatanSearchQuery && (
                                <button
                                  type="button"
                                  onClick={() => setSubKegiatanSearchQuery('')}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-100">
                              {filteredSubKegiatanOptions.length === 0 ? (
                                <p className="p-3 text-xs text-slate-500 text-center">
                                  Tidak ditemukan Sub Kegiatan yang cocok pada Kegiatan ini.
                                </p>
                              ) : (
                                filteredSubKegiatanOptions.map((item) => {
                                  const isSelected =
                                    subKegiatan === item.nama_sub_kegiatan &&
                                    kodeRekening === item.kode_sub_kegiatan;
                                  return (
                                    <button
                                      key={`${item.kode_sub_kegiatan}-${item.nama_sub_kegiatan}`}
                                      type="button"
                                      onClick={() => {
                                        setSubKegiatan(item.nama_sub_kegiatan);
                                        // Sistem otomatis menampilkan Kode Sub Kegiatan yang dipilih
                                        setKodeRekening(item.kode_sub_kegiatan);
                                        setOpenSipdDropdown(null);
                                      }}
                                      className={`w-full p-2.5 text-left transition-colors flex items-start justify-between gap-3 cursor-pointer ${
                                        isSelected
                                          ? 'bg-blue-50 text-[#1E3A8A]'
                                          : 'hover:bg-blue-50/60 text-slate-800'
                                      }`}
                                    >
                                      <div className="flex items-start gap-2 min-w-0">
                                        <span className="px-2 py-0.5 rounded-md bg-blue-100 text-[#1D4ED8] font-mono text-xs font-extrabold shrink-0">
                                          {item.kode_sub_kegiatan}
                                        </span>
                                        <span className="text-xs font-bold leading-snug">
                                          {item.nama_sub_kegiatan}
                                        </span>
                                      </div>
                                      {isSelected && (
                                        <CheckCircle2 className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                                      )}
                                    </button>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* TAHAP 4: SISTEM OTOMATIS MENAMPILKAN KODE SUB KEGIATAN YANG SUDAH DIPILIH */}
                      <div className="pt-2 border-t border-blue-200/60">
                        <div className="p-3.5 rounded-2xl bg-white border-2 border-blue-200/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                          <div className="space-y-0.5">
                            <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#2563EB] flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              4. Kode Sub Kegiatan SIPD (Tampil Otomatis)
                            </span>
                            <p className="text-xs text-slate-600">
                              {kodeRekening
                                ? `Terhubung otomatis dengan Sub Kegiatan: "${subKegiatan}"`
                                : 'Kode Sub Kegiatan akan tampil otomatis setelah Anda memilih Sub Kegiatan di atas.'}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {kodeRekening ? (
                              <div className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white font-mono-tabular text-sm font-extrabold tracking-wide shadow-sm flex items-center gap-2">
                                <span>{formatKodeRekening(kodeRekening)}</span>
                                <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                              </div>
                            ) : (
                              <div className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 font-mono text-xs font-semibold">
                                Belum dipilih (_.__.__._.__.____)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* LANGKAH 2: AKTIVITAS REAL & ANGGARAN (Bisa Mengisi Salah Satu Aktivitas) */}
                {currentStep === 2 && (
                  <motion.div
                    key="step-2"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          Langkah 2: Aktivitas Real & Alokasi Anggaran
                        </h3>
                        <p className="text-xs text-slate-500">
                          OPD cukup mengisi minimal salah satu aktivitas real (Langsung, Tidak Langsung, atau Penunjang) sesuai karakteristik kegiatan.
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          hasAktivitas
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {hasAktivitas ? '✓ Aktivitas Terisi' : 'Wajib isi min. 1 aktivitas'}
                      </span>
                    </div>

                    <div className="p-3 bg-blue-50/70 border border-blue-200/70 rounded-xl text-xs text-[#1D4ED8] flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-[#2563EB]" />
                      <p className="leading-relaxed">
                        <strong>Ketentuan Fleksibilitas Aktivitas:</strong> Anda tidak harus mengisi ketiga kolom. Silakan isi salah satu kolom yang relevan (misal hanya Langsung, atau hanya Penunjang) serta lengkapi nilai Alokasi Anggaran.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            1. Aktivitas Real Langsung
                          </label>
                          <span className="text-[10px] text-slate-400">Pilihan A</span>
                        </div>
                        <textarea
                          rows={4}
                          value={aktivitasLangsung}
                          onChange={(e) => setAktivitasLangsung(e.target.value)}
                          placeholder="Uraikan aktivitas intervensi langsung kepada penerima manfaat..."
                          className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] leading-relaxed"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            2. Aktivitas Real Tidak Langsung
                          </label>
                          <span className="text-[10px] text-slate-400">Pilihan B</span>
                        </div>
                        <textarea
                          rows={4}
                          value={aktivitasTidakLangsung}
                          onChange={(e) => setAktivitasTidakLangsung(e.target.value)}
                          placeholder="Uraikan verifikasi lapangan, pendampingan, atau penyuluhan..."
                          className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] leading-relaxed"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-700">
                            3. Aktivitas Real Penunjang
                          </label>
                          <span className="text-[10px] text-slate-400">Pilihan C</span>
                        </div>
                        <textarea
                          rows={4}
                          value={aktivitasPenunjang}
                          onChange={(e) => setAktivitasPenunjang(e.target.value)}
                          placeholder="Uraikan rapat koordinasi, SK penetapan, dan monitoring evaluasi..."
                          className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] leading-relaxed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-3 border-t border-slate-100">
                      <div className="lg:col-span-5">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Alokasi Anggaran (Rp) <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                            Rp
                          </span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={alokasiAnggaran > 0 ? formatNumber(alokasiAnggaran) : ''}
                            onChange={(e) =>
                              setAlokasiAnggaran(parseNumericInput(e.target.value))
                            }
                            placeholder="0"
                            className="w-full pl-10 pr-4 py-2.5 text-sm font-mono-tabular font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-1.5">
                          Tersimpan numerik: <strong className="text-slate-700">{formatRupiah(alokasiAnggaran)}</strong>
                        </p>
                      </div>

                      <div className="lg:col-span-7 space-y-2.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <label className="block text-xs font-semibold text-slate-700">
                            Sumber Pendanaan / Pembiayaan <span className="text-rose-600">*</span>
                            <span className="ml-1.5 text-[11px] font-normal text-slate-500">
                              (Bisa pilih / isi lebih dari 1)
                            </span>
                          </label>
                          <span className="text-[11px] font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200/70">
                            {selectedSumberList.length} Sumber Dipilih
                          </span>
                        </div>

                        {/* Pilihan Multi-Select Sumber Pendanaan */}
                        <div className="flex flex-wrap gap-2">
                          {SUMBER_PEMBIAYAAN_OPTIONS.filter(
                            (opt) => opt !== 'Sumber Pembiayaan Lainnya'
                          ).map((opt) => {
                            const isChecked = selectedSumberList.includes(opt);
                            return (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => toggleSumberPendanaan(opt)}
                                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                                  isChecked
                                    ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                                    : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/40'
                                }`}
                              >
                                <CheckCircle2
                                  className={`w-3.5 h-3.5 ${
                                    isChecked ? 'text-white' : 'text-slate-300'
                                  }`}
                                />
                                <span>{opt}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Tambah Sumber Pendanaan Lainnya (Kustom) */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <input
                            type="text"
                            value={customSumberInput}
                            onChange={(e) => setCustomSumberInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddCustomSumber();
                              }
                            }}
                            placeholder="Tambah sumber pendanaan lainnya (misal: BAZNAS, DAK, DBHCHT)..."
                            className="flex-1 px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                          <button
                            type="button"
                            onClick={handleAddCustomSumber}
                            className="px-3.5 py-2 rounded-xl bg-blue-50 text-[#2563EB] hover:bg-blue-100 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer shrink-0"
                          >
                            + Tambah Sumber
                          </button>
                        </div>

                        {/* Ringkasan Sumber Pendanaan yang Aktif */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[11px] text-slate-400 mr-1">Terpilih:</span>
                          {selectedSumberList.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/90 border border-blue-200 text-[11px] font-semibold text-[#1D4ED8]"
                            >
                              <span>{item}</span>
                              {selectedSumberList.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => toggleSumberPendanaan(item)}
                                  className="text-blue-400 hover:text-rose-600 cursor-pointer"
                                  title="Hapus sumber pendanaan ini"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* LANGKAH 3: KARAKTERISTIK & SASARAN BANTUAN (Termasuk Lokasi Kegiatan, Deskripsi Sasaran, dan Keterangan Durasi) */}
                {currentStep === 3 && (
                  <motion.div
                    key="step-3"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Sifat Bantuan <span className="text-rose-600">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {(['Berkelanjutan', 'Tidak Berkelanjutan'] as const).map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setSifatBantuan(opt)}
                              className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                sifatBantuan === opt
                                  ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-xs'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <span>{opt}</span>
                              {sifatBantuan === opt && <CheckCircle2 className="w-4 h-4" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Lokasi Kegiatan */}
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Lokasi Kegiatan <span className="text-rose-600">*</span>
                        </label>
                        <div className="relative">
                          <MapPin className="w-4 h-4 text-[#2563EB] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={lokasiKegiatan}
                            onChange={(e) => setLokasiKegiatan(e.target.value)}
                            placeholder="Contoh: Kabupaten Blora / Kec. Blora, Desa Tempelan..."
                            className="w-full pl-9 pr-3.5 py-2.5 text-xs font-medium text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {[
                            'Kabupaten Blora',
                            '16 Kecamatan se-Kabupaten Blora',
                            ...KECAMATAN_BLORA.slice(0, 4).map((k) => `Kec. ${k}`),
                          ].map((presetLok) => (
                            <button
                              key={presetLok}
                              type="button"
                              onClick={() => setLokasiKegiatan(presetLok)}
                              className={`text-[10px] px-2 py-0.5 rounded-md transition-colors cursor-pointer ${
                                lokasiKegiatan === presetLok
                                  ? 'bg-[#2563EB] text-white font-semibold'
                                  : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#2563EB]'
                              }`}
                            >
                              + {presetLok}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Panel Target & Rincian Sasaran Penerima Manfaat (Kolom Ketikan Deskripsi Saja) */}
                    <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-blue-100 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-800">
                          Target & Rincian Sasaran Penerima Manfaat <span className="text-rose-600">*</span>
                        </label>
                        <span className="text-[11px] font-medium text-slate-500">
                          Kolom Deskripsi Sasaran
                        </span>
                      </div>

                      <textarea
                        rows={3}
                        value={deskripsiSasaran}
                        onChange={(e) => setDeskripsiSasaran(e.target.value)}
                        placeholder="Ketik deskripsi target dan rincian sasaran penerima manfaat (contoh: 250 KPM keluarga miskin ekstrem Desil 1–2 P3KE / DTKS di wilayah lokus kemiskinan)..."
                        className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] leading-relaxed"
                      />
                      <p className="text-[11px] text-slate-500">
                        Tuliskan secara deskriptif jumlah/target serta kriteria kelompok sasaran penerima manfaat kegiatan.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Besaran Manfaat <span className="text-rose-600">*</span>
                        </label>
                        <input
                          type="text"
                          value={besaranManfaat}
                          onChange={(e) => setBesaranManfaat(e.target.value)}
                          placeholder="Rp300.000/orang atau 1 paket"
                          className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {BESARAN_MANFAAT_PRESETS.slice(0, 3).map((p) => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setBesaranManfaat(p)}
                              className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#2563EB] cursor-pointer"
                            >
                              + {p}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Jenis Bantuan <span className="text-rose-600">*</span>
                        </label>
                        <select
                          value={jenisBantuan}
                          onChange={(e) => setJenisBantuan(e.target.value)}
                          className="w-full px-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        >
                          {JENIS_BANTUAN_OPTIONS.map((j) => (
                            <option key={j} value={j}>
                              {j}
                            </option>
                          ))}
                        </select>
                        {jenisBantuan === 'Bantuan lainnya' && (
                          <input
                            type="text"
                            value={customJenisBantuan}
                            onChange={(e) => setCustomJenisBantuan(e.target.value)}
                            placeholder="Ketik jenis bantuan..."
                            className="w-full mt-1.5 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        )}
                      </div>

                      <div className="space-y-2.5">
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            Durasi Pemberian Bantuan <span className="text-rose-600">*</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={1}
                              step={1}
                              value={durasiAngka}
                              onChange={(e) =>
                                setDurasiAngka(
                                  e.target.value === ''
                                    ? 1
                                    : Math.max(1, parseInt(e.target.value, 10) || 1)
                                )
                              }
                              placeholder="1"
                              className="w-20 px-3 py-2 text-xs font-mono-tabular font-bold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                            />
                            <select
                              value={durasiSatuan}
                              onChange={(e) => setDurasiSatuan(e.target.value)}
                              className="flex-1 px-3 py-2 text-xs font-semibold text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
                            >
                              {DURASI_SATUAN_LIST.map((sat) => (
                                <option key={sat} value={sat}>
                                  {sat}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {DURASI_PRESET_ITEMS.map((item) => {
                              const isSelected =
                                durasiAngka === item.angka && durasiSatuan === item.satuan;
                              return (
                                <button
                                  key={item.label}
                                  type="button"
                                  onClick={() => {
                                    setDurasiAngka(item.angka);
                                    setDurasiSatuan(item.satuan);
                                  }}
                                  className={`text-[10px] px-2.5 py-0.5 rounded-md transition-colors cursor-pointer ${
                                    isSelected
                                      ? 'bg-[#2563EB] text-white font-semibold'
                                      : 'bg-slate-100 text-slate-600 hover:bg-blue-50 hover:text-[#2563EB]'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Kolom Isian Tambahan Keterangan Durasi Bantuan */}
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            Keterangan Durasi Bantuan
                          </label>
                          <input
                            type="text"
                            value={keteranganDurasiBantuan}
                            onChange={(e) => setKeteranganDurasiBantuan(e.target.value)}
                            placeholder="Ketik keterangan tambahan durasi bantuan..."
                            className="w-full px-3.5 py-2 text-xs text-slate-900 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* LANGKAH 4: REALISASI SESUAI PILIHAN SEMESTER DI AWAL (Semester 1 = Sem 1 saja, Semester 2 = Sem 1 & Sem 2) */}
                {currentStep === 4 && (
                  <motion.div
                    key="step-4"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {selectedSemester === 1
                            ? `Langkah 4: Realisasi Anggaran Semester 1 (TA ${activePeriode.tahun})`
                            : `Langkah 4: Realisasi Anggaran Semester 1 & Semester 2 (TA ${activePeriode.tahun})`}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {selectedSemester === 1 ? (
                            <>
                              Menampilkan <strong>Realisasi Semester 1 (Januari – Juni)</strong> beserta rincian realisasi.
                            </>
                          ) : (
                            <>
                              Karena pilihan awal adalah <strong>Semester 2</strong>, ditampilkan <strong>Realisasi Semester 1 (Januari – Juni)</strong> dan <strong>Realisasi Semester 2 (Juli – Desember)</strong>.
                            </>
                          )}
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {selectedSemester === 1 ? 'Mode Semester 1' : 'Mode Semester 1 & 2'}
                      </span>
                    </div>

                    {/* Ringkasan Pagu Alokasi Anggaran Sub Kegiatan */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <span className="block text-xs font-medium text-slate-500">
                          Pagu Alokasi Anggaran Sub Kegiatan
                        </span>
                        <p className="text-lg font-mono-tabular font-bold text-slate-900 mt-0.5">
                          {formatRupiah(alokasiAnggaran)}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-500 block">
                          Sumber Pendanaan
                        </span>
                        <span className="text-xs font-bold text-[#1D4ED8]">
                          {finalSumberPembiayaan || '-'}
                        </span>
                      </div>
                    </div>

                    <div
                      className={`grid grid-cols-1 ${
                        selectedSemester === 2 ? 'lg:grid-cols-2' : ''
                      } gap-5`}
                    >
                      {/* PANEL REALISASI SEMESTER 1 (Selalu muncul baik saat pilih Semester 1 maupun Semester 2) */}
                      <div className="p-5 rounded-2xl bg-[#F8FAFF] border border-blue-200/80 space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                              <span>Realisasi Semester 1 — TA {activePeriode.tahun}</span>
                              {isSem1Locked && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                  <Lock className="w-3 h-3" /> Terkunci
                                </span>
                              )}
                            </h4>
                            <p className="text-xs text-slate-500">
                              Periode Pelaporan: Januari – Juni {activePeriode.tahun}
                            </p>
                          </div>
                          <StatusIndicator
                            status={initialRow?.sem1.status_verifikasi || 'Belum Diisi'}
                          />
                        </div>

                        {initialRow?.sem1.catatan_verifikator && (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                            <strong>Catatan Verifikator Semester 1:</strong>{' '}
                            {initialRow.sem1.catatan_verifikator}
                          </div>
                        )}

                        <div className="space-y-3.5 pt-1">
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                              Nominal Realisasi Semester 1 (Rp) <span className="text-rose-600">*</span>
                            </label>
                            <div className="relative">
                              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                Rp
                              </span>
                              <input
                                type="text"
                                inputMode="numeric"
                                disabled={isSem1Locked}
                                value={realisasiSem1 > 0 ? formatNumber(realisasiSem1) : ''}
                                onChange={(e) =>
                                  setRealisasiSem1(parseNumericInput(e.target.value))
                                }
                                placeholder="0"
                                className={`w-full pl-10 pr-4 py-2.5 text-base font-mono-tabular font-bold rounded-xl border ${
                                  isSem1Locked
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]'
                                }`}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                              <span>
                                Terbilang:{' '}
                                <strong className="text-slate-800">
                                  {formatRupiah(realisasiSem1)}
                                </strong>
                              </span>
                              <span className="font-mono-tabular font-bold text-[#2563EB]">
                                Capaian S1:{' '}
                                {alokasiAnggaran > 0
                                  ? `${((realisasiSem1 / alokasiAnggaran) * 100).toFixed(1)}%`
                                  : '0%'}
                              </span>
                            </div>
                          </div>

                          {/* Kolom Rincian Realisasi Semester 1 */}
                          <div>
                            <label className="block text-xs font-semibold text-slate-700 mb-1">
                              Rincian Realisasi Semester 1
                            </label>
                            <textarea
                              rows={3}
                              disabled={isSem1Locked}
                              value={rincianRealisasiSem1}
                              onChange={(e) => setRincianRealisasiSem1(e.target.value)}
                              placeholder="Ketik rincian realisasi Semester 1 (misal: Terealisasi penyaluran untuk 125 KPM pada tahap I di 8 kecamatan)..."
                              className={`w-full px-3.5 py-2 text-xs rounded-xl border leading-relaxed ${
                                isSem1Locked
                                  ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                  : 'bg-white text-slate-900 border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#2563EB]'
                              }`}
                            />
                          </div>
                        </div>

                        {sem1Logs.length > 0 && (
                          <div className="pt-3 border-t border-slate-200/60">
                            <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                              <History className="w-3.5 h-3.5" /> Histori Perubahan Semester 1
                            </p>
                            <div className="space-y-1.5 max-h-24 overflow-y-auto text-[11px] text-slate-600">
                              {sem1Logs.slice(0, 3).map((l) => (
                                <div
                                  key={l.log_id}
                                  className="bg-white p-2 rounded-lg border border-slate-100"
                                >
                                  <strong>{l.aksi}</strong> · {formatDateTimeID(l.created_at)}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* PANEL REALISASI SEMESTER 2 (Hanya muncul jika dipilih Semester 2) */}
                      {selectedSemester === 2 && (
                        <div className="p-5 rounded-2xl bg-[#F8FAFF] border border-indigo-200/80 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <h4 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                                <span>Realisasi Semester 2 — TA {activePeriode.tahun}</span>
                                {isSem2Locked && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                    <Lock className="w-3 h-3" /> Terkunci
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-slate-500">
                                Periode Pelaporan: Juli – Desember {activePeriode.tahun}
                              </p>
                            </div>
                            <StatusIndicator
                              status={initialRow?.sem2.status_verifikasi || 'Belum Diisi'}
                            />
                          </div>

                          {initialRow?.sem2.catatan_verifikator && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                              <strong>Catatan Verifikator Semester 2:</strong>{' '}
                              {initialRow.sem2.catatan_verifikator}
                            </div>
                          )}

                          <div className="space-y-3.5 pt-1">
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                                Nominal Realisasi Semester 2 (Rp) <span className="text-rose-600">*</span>
                              </label>
                              <div className="relative">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                                  Rp
                                </span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={isSem2Locked}
                                  value={realisasiSem2 > 0 ? formatNumber(realisasiSem2) : ''}
                                  onChange={(e) =>
                                    setRealisasiSem2(parseNumericInput(e.target.value))
                                  }
                                  placeholder="0"
                                  className={`w-full pl-10 pr-4 py-2.5 text-base font-mono-tabular font-bold rounded-xl border ${
                                    isSem2Locked
                                      ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                      : 'bg-white text-slate-900 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600'
                                  }`}
                                />
                              </div>
                              <div className="flex justify-between text-xs text-slate-500 mt-1.5">
                                <span>
                                  Terbilang:{' '}
                                  <strong className="text-slate-800">
                                    {formatRupiah(realisasiSem2)}
                                  </strong>
                                </span>
                                <span className="font-mono-tabular font-bold text-indigo-700">
                                  Capaian S2:{' '}
                                  {alokasiAnggaran > 0
                                    ? `${((realisasiSem2 / alokasiAnggaran) * 100).toFixed(1)}%`
                                    : '0%'}
                                </span>
                              </div>
                            </div>

                            {/* Kolom Rincian Realisasi Semester 2 */}
                            <div>
                              <label className="block text-xs font-semibold text-slate-700 mb-1">
                                Rincian Realisasi Semester 2
                              </label>
                              <textarea
                                rows={3}
                                disabled={isSem2Locked}
                                value={rincianRealisasiSem2}
                                onChange={(e) => setRincianRealisasiSem2(e.target.value)}
                                placeholder="Ketik rincian realisasi Semester 2 (misal: Penyaluran tahap akhir untuk 250 KPM telah selesai 100% sesuai target)..."
                                className={`w-full px-3.5 py-2 text-xs rounded-xl border leading-relaxed ${
                                  isSem2Locked
                                    ? 'bg-slate-100 text-slate-600 border-slate-200 cursor-not-allowed'
                                    : 'bg-white text-slate-900 border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600'
                                }`}
                              />
                            </div>
                          </div>

                          {sem2Logs.length > 0 && (
                            <div className="pt-3 border-t border-slate-200/60">
                              <p className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                                <History className="w-3.5 h-3.5" /> Histori Perubahan Semester 2
                              </p>
                              <div className="space-y-1.5 max-h-24 overflow-y-auto text-[11px] text-slate-600">
                                {sem2Logs.slice(0, 3).map((l) => (
                                  <div
                                    key={l.log_id}
                                    className="bg-white p-2 rounded-lg border border-slate-100"
                                  >
                                    <strong>{l.aksi}</strong> · {formatDateTimeID(l.created_at)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </fieldset>
            </div>

            {/* Footer Popout Modal */}
            <div className="px-6 py-4 bg-[#F8FAFF] border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {currentStep > 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev - 1) as 1 | 2 | 3 | 4)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Sebelumnya</span>
                  </button>
                )}
                {currentStep < 4 && (
                  <button
                    type="button"
                    onClick={() => setCurrentStep((prev) => (prev + 1) as 1 | 2 | 3 | 4)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#2563EB] bg-blue-50 border border-blue-200 rounded-xl hover:bg-blue-100 transition-colors cursor-pointer"
                  >
                    <span>Langkah Selanjutnya</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
                >
                  {isActiveSemesterLocked ? 'Tutup' : 'Batal'}
                </button>
                {isActiveSemesterLocked ? (
                  <div className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>Terkunci — Telah Terverifikasi (Semester {selectedSemester})</span>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        triggerSave(
                          selectedSemester === 1
                            ? 'draft'
                            : !isSem1Locked
                            ? 'draft'
                            : 'none',
                          selectedSemester === 2 ? 'draft' : 'none',
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-[#1D4ED8] bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>
                        {selectedSemester === 1
                          ? 'Simpan Draft (Semester 1)'
                          : 'Simpan Draft (Semester 1 & 2)'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        triggerSave(
                          selectedSemester === 1
                            ? 'submit'
                            : !isSem1Locked
                            ? initialRow?.sem1.status_verifikasi === 'Menunggu Verifikasi'
                              ? 'submit'
                              : 'draft'
                            : 'none',
                          selectedSemester === 2 ? 'submit' : 'none',
                          true
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] rounded-xl shadow-[0_6px_16px_-4px_rgba(37,99,235,0.45)] transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Simpan & Kirim Verifikasi Semester {selectedSemester}</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
