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
    return rows.filter((r) => {
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
          r.nama_opd.toLowerCase().includes(q) ||
          r.singkatan_opd.toLowerCase().includes(q) ||
          r.kode.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, opdFilter, statusFilter, selectedSemester, searchQuery]);

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

      {/* Filter Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 shadow-xs">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari sub kegiatan, kode rekening, atau OPD..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
          />
        </div>

        <select
          value={opdFilter}
          onChange={(e) => setOpdFilter(e.target.value)}
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
          className="px-3 py-2 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
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
                      <span className="font-bold text-slate-900">{row.singkatan_opd}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular font-semibold text-[#2563EB]">
                        {row.kode}
                      </span>
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

      {/* Modal Read-Only Rincian Matriks untuk Pemeriksaan Verifikator */}
      <AnimatePresence>
        {detailRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-3xl w-full max-h-[88vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <p className="text-xs font-mono-tabular font-semibold text-[#2563EB]">
                    {detailRow.kode} · {detailRow.nama_opd}
                  </p>
                  <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                    {detailRow.sub_kegiatan}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{detailRow.strategi}</p>
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
                <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70">
                  <p className="font-semibold text-slate-800 mb-1">Aktivitas Real Langsung</p>
                  <p className="text-slate-600 leading-relaxed">
                    {detailRow.aktivitas_real_langsung || '-'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70">
                  <p className="font-semibold text-slate-800 mb-1">
                    Aktivitas Real Tidak Langsung
                  </p>
                  <p className="text-slate-600 leading-relaxed">
                    {detailRow.aktivitas_real_tidak_langsung || '-'}
                  </p>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/70">
                  <p className="font-semibold text-slate-800 mb-1">Aktivitas Real Penunjang</p>
                  <p className="text-slate-600 leading-relaxed">
                    {detailRow.aktivitas_real_penunjang || '-'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Alokasi Anggaran</span>
                  <strong className="font-mono-tabular text-slate-900 text-sm">
                    {formatRupiah(detailRow.alokasi_anggaran)}
                  </strong>
                </div>
                <div className="p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Sumber Pembiayaan</span>
                  <strong className="text-slate-900">{detailRow.sumber_pembiayaan}</strong>
                </div>
                <div className="p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Sifat Bantuan</span>
                  <strong className="text-slate-900">{detailRow.sifat_bantuan || '-'}</strong>
                </div>
                <div className="p-3 rounded-xl border border-slate-200">
                  <span className="text-slate-500 block">Jumlah & Satuan Sasaran</span>
                  <strong className="font-mono-tabular text-slate-900">
                    {formatNumber(detailRow.jumlah_sasaran)}{' '}
                    {detailRow.satuan_sasaran || 'KPM'}
                  </strong>
                  {detailRow.keterangan_sasaran && (
                    <span className="block text-[11px] text-slate-500 mt-0.5">
                      {detailRow.keterangan_sasaran}
                    </span>
                  )}
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

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDetailRow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Tutup Rincian
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

