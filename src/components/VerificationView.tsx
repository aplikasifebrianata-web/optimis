import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
  Search,
  AlertTriangle,
  Lock,
  Unlock,
  X,
  FileCheck2,
  Eye,
  Clock,
  MessageSquareText,
  Calendar,
  ArrowUpDown,
  Building2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  EnrichedMatrixRow,
  OPD,
  PeriodePelaporan,
  SemesterNumber,
  UserRole,
} from '../types/oppkpke';
import { formatDateTimeID, formatNumber, formatRupiah } from '../utils/formatters';
import { StatusIndicator } from './ui/StatusIndicator';

interface VerificationViewProps {
  rows: EnrichedMatrixRow[];
  allOpds: OPD[];
  activePeriode: PeriodePelaporan;
  selectedSemester?: 1 | 2;
  userRole: UserRole;
  onVerifySemester: (params: {
    matrix_id: string;
    semester: SemesterNumber;
    decision: 'Terverifikasi' | 'Perlu Perbaikan' | 'Menunggu Verifikasi';
    catatan_verifikator: string;
  }) => void;
  onEditRow?: (matrixId: string) => void;
}

const KETERANGAN_PRESETS_VERIFIKASI = [
  'Data realisasi dan dokumen pendukung OPD telah sesuai dan lengkap.',
  'Capaian realisasi anggaran dan sasaran penerima manfaat telah terverifikasi.',
  'Diverifikasi sesuai laporan fungsional bendahara pengeluaran OPD.',
];

const KETERANGAN_PRESETS_PERBAIKAN = [
  'Mohon lengkapi rincian aktivitas real dan sesuaikan nilai realisasi anggaran.',
  'Nilai realisasi belum sesuai dengan laporan SPJ/dokumen pendukung OPD.',
  'Mohon perbaiki jumlah sasaran penerima manfaat dan keterangan sasaran.',
];

export const VerificationView: React.FC<VerificationViewProps> = ({
  rows,
  allOpds,
  activePeriode,
  selectedSemester = 1,
  userRole,
  onVerifySemester,
}) => {
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [opdFilter, setOpdFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<string>('prioritas_verifikasi');
  const [detailRow, setDetailRow] = useState<EnrichedMatrixRow | null>(null);

  // Modal Verifikasi & Keterangan
  const [modalTarget, setModalTarget] = useState<{
    row: EnrichedMatrixRow;
    semester: SemesterNumber;
  } | null>(null);
  const [selectedDecision, setSelectedDecision] = useState<
    'Terverifikasi' | 'Perlu Perbaikan'
  >('Terverifikasi');
  const [catatanInput, setCatatanInput] = useState('');

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (opdFilter !== 'ALL' && r.opd_id !== opdFilter) return false;
      const activeSemObj = selectedSemester === 1 ? r.sem1 : r.sem2;
      if (statusFilter !== 'ALL' && activeSemObj.status_verifikasi !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.sub_kegiatan.toLowerCase().includes(q) ||
          r.program.toLowerCase().includes(q) ||
          r.kegiatan.toLowerCase().includes(q) ||
          r.nama_opd.toLowerCase().includes(q) ||
          r.singkatan_opd.toLowerCase().includes(q) ||
          r.kode.toLowerCase().includes(q)
        );
      }
      return true;
    });

    const getStatusPriority = (status: string) => {
      if (status === 'Menunggu Verifikasi') return 1;
      if (status === 'Perlu Perbaikan') return 2;
      if (status === 'Draft') return 3;
      if (status === 'Terverifikasi') return 4;
      return 5;
    };

    const getPaguAcuan = (r: EnrichedMatrixRow) =>
      (Number(r.alokasi_anggaran_perubahan) || 0) > 0
        ? Number(r.alokasi_anggaran_perubahan) || 0
        : Number(r.alokasi_anggaran) || 0;

    const getActiveRealisasi = (r: EnrichedMatrixRow) =>
      selectedSemester === 1 ? Number(r.sem1.realisasi) || 0 : Number(r.sem2.realisasi) || 0;

    return [...filtered].sort((a, b) => {
      const semA = selectedSemester === 1 ? a.sem1 : a.sem2;
      const semB = selectedSemester === 1 ? b.sem1 : b.sem2;

      switch (sortBy) {
        case 'prioritas_verifikasi':
          return (
            getStatusPriority(semA.status_verifikasi) -
              getStatusPriority(semB.status_verifikasi) ||
            a.nama_opd.localeCompare(b.nama_opd, 'id') ||
            a.kode.localeCompare(b.kode, 'id', { numeric: true })
          );
        case 'opd_asc':
          return (
            a.nama_opd.localeCompare(b.nama_opd, 'id') ||
            a.kode.localeCompare(b.kode, 'id', { numeric: true })
          );
        case 'opd_desc':
          return (
            b.nama_opd.localeCompare(a.nama_opd, 'id') ||
            a.kode.localeCompare(b.kode, 'id', { numeric: true })
          );
        case 'kode_asc':
          return a.kode.localeCompare(b.kode, 'id', { numeric: true });
        case 'kode_desc':
          return b.kode.localeCompare(a.kode, 'id', { numeric: true });
        case 'sub_kegiatan_asc':
          return a.sub_kegiatan.localeCompare(b.sub_kegiatan, 'id');
        case 'sub_kegiatan_desc':
          return b.sub_kegiatan.localeCompare(a.sub_kegiatan, 'id');
        case 'pagu_desc':
          return getPaguAcuan(b) - getPaguAcuan(a);
        case 'pagu_asc':
          return getPaguAcuan(a) - getPaguAcuan(b);
        case 'realisasi_desc':
          return getActiveRealisasi(b) - getActiveRealisasi(a);
        case 'realisasi_asc':
          return getActiveRealisasi(a) - getActiveRealisasi(b);
        default:
          return 0;
      }
    });
  }, [rows, opdFilter, statusFilter, selectedSemester, searchQuery, sortBy]);

  // Statistik Verifikasi sesuai Tahun & Semester yang dipilih di awal
  const counts = useMemo(() => {
    const getSem = (r: EnrichedMatrixRow) => (selectedSemester === 1 ? r.sem1 : r.sem2);
    return {
      total: rows.length,
      verified: rows.filter((r) => getSem(r).status_verifikasi === 'Terverifikasi').length,
      pending: rows.filter((r) => getSem(r).status_verifikasi === 'Menunggu Verifikasi')
        .length,
      revision: rows.filter((r) => getSem(r).status_verifikasi === 'Perlu Perbaikan')
        .length,
      draftOrEmpty: rows.filter(
        (r) =>
          getSem(r).status_verifikasi === 'Draft' ||
          getSem(r).status_verifikasi === 'Belum Diisi'
      ).length,
    };
  }, [rows, selectedSemester]);

  const openVerificationModal = (
    row: EnrichedMatrixRow,
    semester: SemesterNumber,
    defaultDecision: 'Terverifikasi' | 'Perlu Perbaikan'
  ) => {
    const semObj = semester === 1 ? row.sem1 : row.sem2;
    setSelectedDecision(defaultDecision);
    if (semObj.catatan_verifikator && semObj.catatan_verifikator.trim()) {
      setCatatanInput(semObj.catatan_verifikator);
    } else if (defaultDecision === 'Terverifikasi') {
      setCatatanInput(
        `Data realisasi Semester ${semester} (${
          semester === 1 ? 'Januari–Juni' : 'Juli–Desember'
        }) TA ${activePeriode.tahun} telah sesuai dan terverifikasi.`
      );
    } else {
      setCatatanInput('');
    }
    setModalTarget({ row, semester });
  };

  const handleDecisionChange = (decision: 'Terverifikasi' | 'Perlu Perbaikan') => {
    setSelectedDecision(decision);
    if (!modalTarget) return;
    const semObj =
      modalTarget.semester === 1 ? modalTarget.row.sem1 : modalTarget.row.sem2;
    if (!semObj.catatan_verifikator) {
      if (decision === 'Terverifikasi' && !catatanInput.trim()) {
        setCatatanInput(
          `Data realisasi Semester ${modalTarget.semester} (${
            modalTarget.semester === 1 ? 'Januari–Juni' : 'Juli–Desember'
          }) TA ${activePeriode.tahun} telah sesuai dan terverifikasi.`
        );
      } else if (
        decision === 'Perlu Perbaikan' &&
        catatanInput.includes('telah sesuai dan terverifikasi')
      ) {
        setCatatanInput('');
      }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header Sistem Verifikasi Sesuai Tahun & Semester yang Dipilih di Awal */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] text-xs font-bold border border-blue-200/80">
              <Calendar className="w-3.5 h-3.5" />
              <span>Tahun Anggaran {activePeriode.tahun}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200/80">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                Semester {selectedSemester} (
                {selectedSemester === 1 ? 'Januari – Juni' : 'Juli – Desember'})
              </span>
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Verifikasi Realisasi Semester {selectedSemester} — TA {activePeriode.tahun}
          </h1>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Menampilkan data verifikasi sesuai <strong>Tahun {activePeriode.tahun}</strong> dan{' '}
            <strong>Semester {selectedSemester}</strong> yang dipilih di awal. Pilih keputusan{' '}
            <strong className="text-emerald-700">Verifikasi</strong> atau{' '}
            <strong className="text-amber-700">Perlu Perbaikan</strong> beserta keterangannya. Data yang berstatus{' '}
            <strong className="text-emerald-700">Terverifikasi</strong> otomatis terkunci sehingga OPD tidak dapat mengubah data tersebut.
          </p>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-blue-100 flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="text-xs">
            <p className="font-bold text-slate-900">Proteksi Kunci Otomatis OPD</p>
            <p className="text-[11px] text-slate-500">
              {counts.verified} dari {counts.total} subkegiatan terkunci (Terverifikasi)
            </p>
          </div>
        </div>
      </div>

      {/* Ringkasan Status Verifikasi untuk Tahun & Semester Aktif */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-medium text-slate-500">
              Total Sub Kegiatan (TA {activePeriode.tahun})
            </p>
            <p className="text-2xl font-bold font-mono-tabular text-slate-900 mt-1">
              {counts.total}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Periode Semester {selectedSemester}
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-emerald-200/80 p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-emerald-700">
              Terverifikasi & Terkunci (Sem {selectedSemester})
            </p>
            <p className="text-2xl font-bold font-mono-tabular text-emerald-700 mt-1">
              {counts.verified}
            </p>
            <p className="text-[11px] text-emerald-600/80 mt-0.5 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Terkunci bagi OPD
            </p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-sky-200/80 p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-sky-700">
              Menunggu Verifikasi (Sem {selectedSemester})
            </p>
            <p className="text-2xl font-bold font-mono-tabular text-sky-700 mt-1">
              {counts.pending}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Siap diperiksa Admin</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200/80 p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-amber-700">
              Perlu Perbaikan (Sem {selectedSemester})
            </p>
            <p className="text-2xl font-bold font-mono-tabular text-amber-700 mt-1">
              {counts.revision}
            </p>
            <p className="text-[11px] text-amber-600/80 mt-0.5">Dikembalikan ke OPD</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar & Sort By */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari sub kegiatan, kode rekening, atau OPD..."
            className="w-full h-10 pl-9 pr-3 text-xs bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <select
          value={opdFilter}
          onChange={(e) => setOpdFilter(e.target.value)}
          className="h-10 px-3 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="ALL">Semua Perangkat Daerah ({allOpds.length} OPD)</option>
          {allOpds.map((o) => (
            <option key={o.opd_id} value={o.opd_id}>
              {o.singkatan} — {o.nama_opd}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 px-3 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
        >
          <option value="ALL">
            Semua Status Verifikasi Semester {selectedSemester}
          </option>
          <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
          <option value="Terverifikasi">Terverifikasi (Terkunci)</option>
          <option value="Perlu Perbaikan">Perlu Perbaikan</option>
          <option value="Draft">Draft</option>
          <option value="Belum Diisi">Belum Diisi</option>
        </select>

        {/* Fungsi Sort By pada Menu Verifikasi */}
        <div className="relative">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#2563EB] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort By Verifikasi"
            className="w-full h-10 pl-8 pr-3 text-xs font-semibold text-slate-800 bg-[#F8FAFF] border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
          >
            <option value="prioritas_verifikasi">Sort By: Prioritas Verifikasi</option>
            <option value="opd_asc">Sort By: Nama OPD (A – Z)</option>
            <option value="opd_desc">Sort By: Nama OPD (Z – A)</option>
            <option value="kode_asc">Sort By: Kode Rekening (Terkecil)</option>
            <option value="kode_desc">Sort By: Kode Rekening (Terbesar)</option>
            <option value="sub_kegiatan_asc">Sort By: Sub Kegiatan (A – Z)</option>
            <option value="sub_kegiatan_desc">Sort By: Sub Kegiatan (Z – A)</option>
            <option value="pagu_desc">Sort By: Pagu Anggaran (Tertinggi)</option>
            <option value="pagu_asc">Sort By: Pagu Anggaran (Terendah)</option>
            <option value="realisasi_desc">Sort By: Realisasi Sem {selectedSemester} (Tertinggi)</option>
            <option value="realisasi_asc">Sort By: Realisasi Sem {selectedSemester} (Terendah)</option>
          </select>
        </div>
      </div>

      {/* Daftar Sub Kegiatan & Panel Verifikasi Semester yang Dipilih */}
      <div className="space-y-4">
        {filteredRows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-xs text-slate-500">
            Tidak ada data subkegiatan yang sesuai dengan filter pencarian pada{' '}
            <strong>
              TA {activePeriode.tahun} — Semester {selectedSemester}
            </strong>
            .
          </div>
        ) : (
          filteredRows.map((row) => {
            const activeSem = selectedSemester === 1 ? row.sem1 : row.sem2;
            const activePct =
              selectedSemester === 1
                ? row.persentase_realisasi_sem1
                : row.persentase_realisasi_sem2;
            const isVerified = activeSem.status_verifikasi === 'Terverifikasi';

            return (
              <div
                key={row.matrix_id}
                className={`bg-white rounded-2xl border p-5 shadow-[0_4px_15px_-4px_rgba(15,23,42,0.04)] space-y-4 transition-colors ${
                  isVerified ? 'border-emerald-200/90' : 'border-slate-200/80'
                }`}
              >
                {/* Baris Identitas Sub Kegiatan */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3.5 border-b border-slate-100">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <button
                        type="button"
                        onClick={() => setDetailRow(row)}
                        className="font-bold text-slate-900 hover:text-[#2563EB] hover:underline transition-colors cursor-pointer"
                        title={`Klik Nama OPD (${row.nama_opd}) untuk membuka preview rincian lengkap matriks`}
                      >
                        {row.singkatan_opd} ({row.nama_opd})
                      </button>
                      <span aria-hidden="true">·</span>
                      <button
                        type="button"
                        onClick={() => setDetailRow(row)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-[#2563EB] text-[#2563EB] hover:text-white border border-blue-200/80 font-mono-tabular font-semibold transition-all cursor-pointer"
                        title={`Klik Kode Rekening (${row.kode}) untuk membuka preview rincian lengkap matriks`}
                      >
                        <span>{row.kode}</span>
                        <Eye className="w-3 h-3" />
                      </button>
                      <span aria-hidden="true">·</span>
                      <span>{row.strategi}</span>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">
                      {row.sub_kegiatan}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Pagu Alokasi Anggaran:{' '}
                      <strong className="font-mono-tabular text-slate-800">
                        {formatRupiah(row.alokasi_anggaran)}
                      </strong>{' '}
                      · Sasaran:{' '}
                      <strong className="font-mono-tabular text-slate-800">
                        {formatNumber(row.jumlah_sasaran)} {row.satuan_sasaran || 'KPM'}
                      </strong>
                      {row.keterangan_sasaran ? ` (${row.keterangan_sasaran})` : ''} · Sumber:{' '}
                      <strong className="text-slate-700">{row.sumber_pembiayaan}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                    {isVerified && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Terkunci untuk OPD</span>
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setDetailRow(row)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                      <span>Rincian Matriks</span>
                    </button>
                  </div>
                </div>

                {/* Panel Verifikasi Sesuai Tahun & Semester yang Dipilih di Awal */}
                <div
                  className={`p-4 rounded-2xl border flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                    isVerified
                      ? 'bg-emerald-50/40 border-emerald-200/80'
                      : activeSem.status_verifikasi === 'Perlu Perbaikan'
                      ? 'bg-amber-50/40 border-amber-200/80'
                      : 'bg-[#F8FAFF] border-slate-200/80'
                  }`}
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-xs font-bold text-slate-900">
                        Realisasi Semester {selectedSemester} (
                        {selectedSemester === 1 ? 'Januari – Juni' : 'Juli – Desember'}{' '}
                        {activePeriode.tahun})
                      </span>
                      <StatusIndicator status={activeSem.status_verifikasi} />
                    </div>

                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                      <div>
                        <span className="text-xs text-slate-500 mr-2">
                          Nilai Realisasi Semester {selectedSemester}:
                        </span>
                        <span className="text-base font-bold font-mono-tabular text-slate-900">
                          {formatRupiah(activeSem.realisasi)}
                        </span>
                        <span className="ml-2 text-xs font-mono-tabular font-semibold text-[#2563EB]">
                          ({activePct.toFixed(1)}% dari Pagu)
                        </span>
                      </div>
                    </div>

                    {activeSem.catatan_verifikator && (
                      <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-slate-200/80 flex items-start gap-2">
                        <MessageSquareText className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-900">
                            Keterangan Verifikasi:{' '}
                          </span>
                          <span>{activeSem.catatan_verifikator}</span>
                        </div>
                      </div>
                    )}

                    {activeSem.verified_at && (
                      <p className="text-[11px] text-slate-400">
                        Diproses oleh <strong>{activeSem.verified_by}</strong> pada{' '}
                        {formatDateTimeID(activeSem.verified_at)}
                      </p>
                    )}
                  </div>

                  {/* Pilihan Tombol Aksi Verifikasi & Perlu Perbaikan */}
                  {userRole === 'ADMIN' && (
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-200/60">
                      {!isVerified ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openVerificationModal(row, selectedSemester, 'Terverifikasi')
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Verifikasi</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openVerificationModal(row, selectedSemester, 'Perlu Perbaikan')
                            }
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300/80 rounded-xl transition-colors cursor-pointer"
                          >
                            <RotateCcw className="w-4 h-4" />
                            <span>Perlu Perbaikan</span>
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              openVerificationModal(row, selectedSemester, 'Terverifikasi')
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-800 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                          >
                            <MessageSquareText className="w-3.5 h-3.5" />
                            <span>Ubah Keterangan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openVerificationModal(row, selectedSemester, 'Perlu Perbaikan')
                            }
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-xl transition-colors cursor-pointer"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Perlu Perbaikan (Buka Kunci OPD)</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal Pilihan Verifikasi / Perlu Perbaikan dengan Penambahan Keterangan */}
      <AnimatePresence>
        {modalTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-xl w-full p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div>
                  <p className="text-xs font-semibold text-[#2563EB]">
                    Keputusan Verifikasi · TA {activePeriode.tahun} · Semester{' '}
                    {modalTarget.semester} (
                    {modalTarget.semester === 1 ? 'Januari–Juni' : 'Juli–Desember'})
                  </p>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5">
                    Verifikasi & Keterangan Realisasi Semester {modalTarget.semester}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setModalTarget(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informasi Ringkas Baris Sub Kegiatan */}
              <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-slate-200/80 text-xs space-y-1.5">
                <p className="font-mono-tabular font-semibold text-[#2563EB]">
                  {modalTarget.row.kode} · {modalTarget.row.nama_opd}
                </p>
                <p className="font-bold text-slate-900 text-sm">
                  {modalTarget.row.sub_kegiatan}
                </p>
                <div className="flex flex-wrap items-center gap-4 pt-1 text-slate-600">
                  <span>
                    Pagu Anggaran:{' '}
                    <strong className="font-mono-tabular text-slate-900">
                      {formatRupiah(modalTarget.row.alokasi_anggaran)}
                    </strong>
                  </span>
                  <span>
                    Realisasi Sem {modalTarget.semester}:{' '}
                    <strong className="font-mono-tabular text-emerald-700">
                      {formatRupiah(
                        modalTarget.semester === 1
                          ? modalTarget.row.sem1.realisasi
                          : modalTarget.row.sem2.realisasi
                      )}
                    </strong>
                  </span>
                </div>
              </div>

              {/* Pilihan Status: Verifikasi vs Perlu Perbaikan */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-800">
                  Pilih Keputusan Verifikasi <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleDecisionChange('Terverifikasi')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      selectedDecision === 'Terverifikasi'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40'
                    }`}
                  >
                    <CheckCircle2
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        selectedDecision === 'Terverifikasi'
                          ? 'text-white'
                          : 'text-emerald-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold">Verifikasi (Terverifikasi)</p>
                      <p
                        className={`text-[11px] mt-0.5 leading-snug ${
                          selectedDecision === 'Terverifikasi'
                            ? 'text-emerald-100'
                            : 'text-slate-500'
                        }`}
                      >
                        Setujui laporan & otomatis kunci data agar tidak bisa diubah OPD.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecisionChange('Perlu Perbaikan')}
                    className={`p-3.5 rounded-2xl border text-left transition-all flex items-start gap-3 cursor-pointer ${
                      selectedDecision === 'Perlu Perbaikan'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-amber-300 hover:bg-amber-50/40'
                    }`}
                  >
                    <RotateCcw
                      className={`w-5 h-5 shrink-0 mt-0.5 ${
                        selectedDecision === 'Perlu Perbaikan'
                          ? 'text-white'
                          : 'text-amber-600'
                      }`}
                    />
                    <div>
                      <p className="text-xs font-bold">Perlu Perbaikan</p>
                      <p
                        className={`text-[11px] mt-0.5 leading-snug ${
                          selectedDecision === 'Perlu Perbaikan'
                            ? 'text-amber-50'
                            : 'text-slate-500'
                        }`}
                      >
                        Kembalikan ke OPD untuk diperbaiki sesuai keterangan verifikator.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Input Keterangan Verifikasi */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Keterangan / Catatan Verifikasi:{' '}
                    {selectedDecision === 'Perlu Perbaikan' && (
                      <span className="text-rose-600">*</span>
                    )}
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Ditampilkan pada akun OPD
                  </span>
                </div>
                <textarea
                  rows={3}
                  value={catatanInput}
                  onChange={(e) => setCatatanInput(e.target.value)}
                  placeholder={
                    selectedDecision === 'Terverifikasi'
                      ? 'Tambahkan keterangan verifikasi (misal: Data realisasi telah sesuai dengan laporan fungsional)...'
                      : 'Tuliskan keterangan bagian mana yang perlu diperbaiki oleh OPD...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                />

                {/* Preset Keterangan Cepat */}
                <div className="space-y-1 pt-0.5">
                  <span className="text-[10px] font-semibold text-slate-400 block">
                    Pilih Cepat Keterangan:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {(selectedDecision === 'Terverifikasi'
                      ? KETERANGAN_PRESETS_VERIFIKASI
                      : KETERANGAN_PRESETS_PERBAIKAN
                    ).map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setCatatanInput(preset)}
                        className="text-[10px] px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#2563EB] transition-colors text-left cursor-pointer"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Info Lock Otomatis */}
              <div
                className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                  selectedDecision === 'Terverifikasi'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-800'
                }`}
              >
                {selectedDecision === 'Terverifikasi' ? (
                  <>
                    <Lock className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Setelah disimpan sebagai <strong>Terverifikasi</strong>, data ini otomatis terkunci dan OPD tidak dapat mengubahnya.
                    </span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      Status <strong>Perlu Perbaikan</strong> membuka akses edit bagi OPD untuk memperbaiki data sesuai keterangan di atas.
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalTarget(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const finalCatatan =
                      catatanInput.trim() ||
                      (selectedDecision === 'Terverifikasi'
                        ? `Terverifikasi pada Semester ${modalTarget.semester} TA ${activePeriode.tahun}.`
                        : `Perlu perbaikan data pada Semester ${modalTarget.semester} TA ${activePeriode.tahun}.`);
                    onVerifySemester({
                      matrix_id: modalTarget.row.matrix_id,
                      semester: modalTarget.semester,
                      decision: selectedDecision,
                      catatan_verifikator: finalCatatan,
                    });
                    setModalTarget(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
                    selectedDecision === 'Terverifikasi'
                      ? 'bg-emerald-600 hover:bg-emerald-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {selectedDecision === 'Terverifikasi' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Simpan Verifikasi & Kunci Data (Sem {modalTarget.semester})</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>Simpan Perlu Perbaikan (Sem {modalTarget.semester})</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Read-Only Preview Rincian Lengkap Matriks untuk Pemeriksaan Verifikator */}
      <AnimatePresence>
        {detailRow && (() => {
          const paguMurni = Number(detailRow.alokasi_anggaran) || 0;
          const paguPerubahan = Number(detailRow.alokasi_anggaran_perubahan) || 0;
          const hasAnggaranPerubahan = paguPerubahan > 0;
          const paguAcuan = hasAnggaranPerubahan ? paguPerubahan : paguMurni;
          const realisasiS1 = Number(detailRow.sem1.realisasi) || 0;
          const realisasiS2 = Number(detailRow.sem2.realisasi) || 0;
          const realisasiFinal = realisasiS1 + realisasiS2;
          const sisaPagu = paguAcuan - realisasiFinal;
          const persenFinal = paguAcuan > 0 ? (realisasiFinal / paguAcuan) * 100 : 0;

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailRow(null)}
              className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 font-mono-tabular font-bold text-xs">
                        {detailRow.kode}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs">
                        <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>
                          {detailRow.singkatan_opd} — {detailRow.nama_opd}
                        </span>
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {detailRow.sub_kegiatan}
                    </h3>
                    <div className="text-xs text-slate-600 space-y-0.5">
                      <p>
                        <strong>Strategi OPPKPKE:</strong>{' '}
                        <span className="text-[#2563EB] font-semibold">{detailRow.strategi}</span>
                      </p>
                      <p>
                        <strong>Program:</strong> {detailRow.program || '-'}
                      </p>
                      <p>
                        <strong>Kegiatan:</strong> {detailRow.kegiatan || '-'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailRow(null)}
                    className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70 space-y-2">
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">
                        Aktivitas Real Langsung (Sem 1)
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        {detailRow.aktivitas_real_langsung || '-'}
                      </p>
                    </div>
                    {detailRow.aktivitas_real_langsung_sem2?.trim() && (
                      <div className="pt-2 border-t border-indigo-100">
                        <p className="font-semibold text-indigo-800 mb-1">
                          Aktivitas Real Langsung (Sem 2)
                        </p>
                        <p className="text-indigo-950 leading-relaxed">
                          {detailRow.aktivitas_real_langsung_sem2}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70 space-y-2">
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">
                        Aktivitas Real Tidak Langsung (Sem 1)
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        {detailRow.aktivitas_real_tidak_langsung || '-'}
                      </p>
                    </div>
                    {detailRow.aktivitas_real_tidak_langsung_sem2?.trim() && (
                      <div className="pt-2 border-t border-indigo-100">
                        <p className="font-semibold text-indigo-800 mb-1">
                          Aktivitas Real Tidak Langsung (Sem 2)
                        </p>
                        <p className="text-indigo-950 leading-relaxed">
                          {detailRow.aktivitas_real_tidak_langsung_sem2}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70 space-y-2">
                    <div>
                      <p className="font-semibold text-slate-800 mb-1">
                        Aktivitas Real Penunjang (Sem 1)
                      </p>
                      <p className="text-slate-600 leading-relaxed">
                        {detailRow.aktivitas_real_penunjang || '-'}
                      </p>
                    </div>
                    {detailRow.aktivitas_real_penunjang_sem2?.trim() && (
                      <div className="pt-2 border-t border-indigo-100">
                        <p className="font-semibold text-indigo-800 mb-1">
                          Aktivitas Real Penunjang (Sem 2)
                        </p>
                        <p className="text-indigo-950 leading-relaxed">
                          {detailRow.aktivitas_real_penunjang_sem2}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Alokasi Anggaran Murni</span>
                    <strong className="font-mono-tabular text-slate-900 text-sm">
                      {formatRupiah(detailRow.alokasi_anggaran)}
                    </strong>
                    {hasAnggaranPerubahan && (
                      <div className="mt-1.5 pt-1.5 border-t border-indigo-100">
                        <span className="text-[11px] font-semibold text-indigo-700 block">
                          Alokasi Anggaran Perubahan:
                        </span>
                        <strong className="font-mono-tabular text-indigo-900 text-sm">
                          {formatRupiah(paguPerubahan)}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Sumber Pembiayaan</span>
                    <strong className="text-slate-900">{detailRow.sumber_pembiayaan}</strong>
                    {hasAnggaranPerubahan && detailRow.sumber_pembiayaan_perubahan && (
                      <div className="mt-1.5 pt-1.5 border-t border-indigo-100">
                        <span className="text-[11px] font-semibold text-indigo-700 block">
                          Sumber Pembiayaan Perubahan:
                        </span>
                        <strong className="text-indigo-900">
                          {detailRow.sumber_pembiayaan_perubahan}
                        </strong>
                      </div>
                    )}
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Sifat & Lokasi Kegiatan</span>
                    <strong className="text-slate-900 block">
                      {detailRow.sifat_bantuan || '-'}
                    </strong>
                    <span className="text-[11px] text-slate-600 mt-0.5 block">
                      Lokasi: {detailRow.lokasi || '-'}
                    </span>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Target & Rincian Sasaran</span>
                    <strong className="font-mono-tabular text-slate-900">
                      {detailRow.keterangan_sasaran?.trim() ||
                        `${formatNumber(detailRow.jumlah_sasaran)} ${
                          detailRow.satuan_sasaran || 'KPM'
                        }`}
                    </strong>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Besaran Manfaat</span>
                    <strong className="text-slate-900">{detailRow.besaran_manfaat || '-'}</strong>
                  </div>
                  <div className="p-3 rounded-xl border border-slate-200">
                    <span className="text-slate-500 block">Jenis & Durasi</span>
                    <strong className="text-slate-900">
                      {detailRow.jenis_bantuan} ({detailRow.durasi_pemberian_bantuan})
                    </strong>
                  </div>
                </div>

                {/* Realisasi Semester 1, Semester 2, Realisasi Final & Sisa Pagu */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-blue-100">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Realisasi Semester 1 & 2
                    </span>
                    <p className="text-xs font-mono-tabular font-bold text-[#2563EB] mt-1">
                      S1: {formatRupiah(realisasiS1)}
                    </p>
                    <p className="text-xs font-mono-tabular font-bold text-indigo-700 mt-0.5">
                      S2: {formatRupiah(realisasiS2)}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200">
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                      <Sparkles className="w-3 h-3" />
                      <span>Realisasi Final (Sem 1 + Sem 2)</span>
                    </span>
                    <p className="text-sm font-mono-tabular font-extrabold text-indigo-900 mt-1">
                      {formatRupiah(realisasiFinal)} ({persenFinal.toFixed(1)}%)
                    </p>
                  </div>

                  <div
                    className={`p-3.5 rounded-2xl border ${
                      sisaPagu < 0
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-emerald-50/80 border-emerald-200'
                    }`}
                  >
                    <span
                      className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                        sisaPagu < 0 ? 'text-rose-700' : 'text-emerald-800'
                      }`}
                    >
                      <Wallet className="w-3 h-3" />
                      <span>Sisa Pagu Anggaran</span>
                    </span>
                    <p
                      className={`text-sm font-mono-tabular font-extrabold mt-1 ${
                        sisaPagu < 0 ? 'text-rose-700' : 'text-emerald-900'
                      }`}
                    >
                      {sisaPagu < 0
                        ? `- ${formatRupiah(Math.abs(sisaPagu))}`
                        : formatRupiah(sisaPagu)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDetailRow(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Tutup Preview
                  </button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
};

