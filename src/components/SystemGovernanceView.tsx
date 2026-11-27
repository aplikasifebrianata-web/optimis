import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CalendarCog,
  Lock,
  Unlock,
  PlusCircle,
  History,
  Database,
  RotateCcw,
  CheckCircle2,
  Search,
  FileText,
  ArrowRight,
  Wallet,
  Layers,
  X,
  Eye,
  Sparkles,
  MapPin,
  Building2,
} from 'lucide-react';
import {
  AuditLog,
  EnrichedMatrixRow,
  OPD,
  PeriodePelaporan,
  UserRole,
} from '../types/oppkpke';
import { formatDateTimeID, formatRupiah } from '../utils/formatters';
import { StatusIndicator } from './ui/StatusIndicator';

interface SystemGovernanceViewProps {
  mode: 'pengaturan-periode' | 'audit-log' | 'struktur-db';
  periodes: PeriodePelaporan[];
  activePeriode: PeriodePelaporan;
  allOpds: OPD[];
  auditLogs: AuditLog[];
  rows: EnrichedMatrixRow[];
  userRole: UserRole;
  onSelectPeriode: (periodeId: string) => void;
  onUpdatePeriode: (
    periodeId: string,
    updates: Partial<
      Pick<
        PeriodePelaporan,
        'semester_1_buka' | 'semester_2_buka' | 'batas_semester_1' | 'batas_semester_2'
      >
    >
  ) => void;
  onCreateNewYear: (tahun: number, copyFromPeriodeId: string | null) => void;
  onResetDatabase: () => void;
}

interface RowHistoryAnalysis {
  row: EnrichedMatrixRow;
  hasAnggaranPerubahan: boolean;
  paguMurni: number;
  paguPerubahan: number;
  paguAcuan: number;
  realisasiSem1: number;
  realisasiSem2: number;
  totalRealisasi: number;
  sisaPagu: number;
  persenRealisasiTotal: number;
  sem2AktivitasLangsung: string;
  sem2AktivitasTidakLangsung: string;
  sem2AktivitasPenunjang: string;
  hasAktivitasSem2Input: boolean;
  isAktivitasChangedInSem2: boolean;
  sem2SifatBantuan: string;
  sem2Lokasi: string;
  sem2Sasaran: string;
  sem2BesaranManfaat: string;
  sem2JenisBantuan: string;
  sem2Durasi: string;
  sem2KeteranganDurasi: string;
  hasKarakteristikSem2Input: boolean;
  isKarakteristikChangedInSem2: boolean;
  hasSem2ActivityOrRealisasi: boolean;
  changeBadges: string[];
}

function analyzeRowHistory(row: EnrichedMatrixRow): RowHistoryAnalysis {
  const paguMurni = Number(row.alokasi_anggaran) || 0;
  const paguPerubahan = Number(row.alokasi_anggaran_perubahan) || 0;
  const hasAnggaranPerubahan = paguPerubahan > 0;
  const paguAcuan = hasAnggaranPerubahan ? paguPerubahan : paguMurni;

  const realisasiSem1 = Number(row.sem1?.realisasi) || 0;
  const realisasiSem2 = Number(row.sem2?.realisasi) || 0;
  const totalRealisasi = realisasiSem1 + realisasiSem2;
  const sisaPagu = paguAcuan - totalRealisasi;
  const persenRealisasiTotal = paguAcuan > 0 ? (totalRealisasi / paguAcuan) * 100 : 0;

  const sem1Langsung = (row.aktivitas_real_langsung || '').trim();
  const sem1TidakLangsung = (row.aktivitas_real_tidak_langsung || '').trim();
  const sem1Penunjang = (row.aktivitas_real_penunjang || '').trim();

  const rawSem2Langsung = (row.aktivitas_real_langsung_sem2 || '').trim();
  const rawSem2TidakLangsung = (row.aktivitas_real_tidak_langsung_sem2 || '').trim();
  const rawSem2Penunjang = (row.aktivitas_real_penunjang_sem2 || '').trim();

  const hasAktivitasSem2Input = Boolean(
    rawSem2Langsung || rawSem2TidakLangsung || rawSem2Penunjang
  );

  const sem2AktivitasLangsung = hasAktivitasSem2Input ? rawSem2Langsung : sem1Langsung;
  const sem2AktivitasTidakLangsung = hasAktivitasSem2Input
    ? rawSem2TidakLangsung
    : sem1TidakLangsung;
  const sem2AktivitasPenunjang = hasAktivitasSem2Input ? rawSem2Penunjang : sem1Penunjang;

  const isAktivitasChangedInSem2 =
    hasAktivitasSem2Input &&
    (rawSem2Langsung !== sem1Langsung ||
      rawSem2TidakLangsung !== sem1TidakLangsung ||
      rawSem2Penunjang !== sem1Penunjang);

  const sem1Sifat = (row.sifat_bantuan || '').trim();
  const sem1Lokasi = (row.lokasi || '').trim();
  const sem1Sasaran = (row.keterangan_sasaran || row.satuan_sasaran || '').trim();
  const sem1Besaran = (row.besaran_manfaat || '').trim();
  const sem1Jenis = (row.jenis_bantuan || '').trim();
  const sem1Durasi = (row.durasi_pemberian_bantuan || '').trim();
  const sem1KetDurasi = (row.keterangan_durasi_bantuan || '').trim();

  const rawSem2Sifat = (row.sifat_bantuan_sem2 || '').trim();
  const rawSem2Lokasi = (row.lokasi_sem2 || '').trim();
  const rawSem2Sasaran = (row.keterangan_sasaran_sem2 || row.satuan_sasaran_sem2 || '').trim();
  const rawSem2Besaran = (row.besaran_manfaat_sem2 || '').trim();
  const rawSem2Jenis = (row.jenis_bantuan_sem2 || '').trim();
  const rawSem2Durasi = (row.durasi_pemberian_bantuan_sem2 || '').trim();
  const rawSem2KetDurasi = (row.keterangan_durasi_bantuan_sem2 || '').trim();

  const hasKarakteristikSem2Input = Boolean(
    rawSem2Sifat ||
      rawSem2Lokasi ||
      rawSem2Sasaran ||
      rawSem2Besaran ||
      rawSem2Jenis ||
      rawSem2Durasi ||
      rawSem2KetDurasi
  );

  const sem2SifatBantuan = rawSem2Sifat || sem1Sifat;
  const sem2Lokasi = rawSem2Lokasi || sem1Lokasi;
  const sem2Sasaran = rawSem2Sasaran || sem1Sasaran;
  const sem2BesaranManfaat = rawSem2Besaran || sem1Besaran;
  const sem2JenisBantuan = rawSem2Jenis || sem1Jenis;
  const sem2Durasi = rawSem2Durasi || sem1Durasi;
  const sem2KeteranganDurasi = rawSem2KetDurasi || sem1KetDurasi;

  const isKarakteristikChangedInSem2 = Boolean(
    hasKarakteristikSem2Input &&
      ((rawSem2Sifat && rawSem2Sifat !== sem1Sifat) ||
        (rawSem2Lokasi && rawSem2Lokasi !== sem1Lokasi) ||
        (rawSem2Sasaran && rawSem2Sasaran !== sem1Sasaran) ||
        (rawSem2Besaran && rawSem2Besaran !== sem1Besaran) ||
        (rawSem2Jenis && rawSem2Jenis !== sem1Jenis) ||
        (rawSem2Durasi && rawSem2Durasi !== sem1Durasi) ||
        (rawSem2KetDurasi && rawSem2KetDurasi !== sem1KetDurasi))
  );

  const changeBadges: string[] = [];
  if (hasAnggaranPerubahan) {
    changeBadges.push('Alokasi Anggaran Perubahan');
  }
  if (isAktivitasChangedInSem2) {
    changeBadges.push('Perubahan Aktivitas Real Sem 2');
  }
  if (isKarakteristikChangedInSem2) {
    changeBadges.push('Perubahan Karakteristik & Sasaran Sem 2');
  }

  const hasSem2ActivityOrRealisasi =
    hasAnggaranPerubahan ||
    hasAktivitasSem2Input ||
    hasKarakteristikSem2Input ||
    realisasiSem2 > 0 ||
    row.sem2?.status_verifikasi !== 'Belum Diisi';

  return {
    row,
    hasAnggaranPerubahan,
    paguMurni,
    paguPerubahan,
    paguAcuan,
    realisasiSem1,
    realisasiSem2,
    totalRealisasi,
    sisaPagu,
    persenRealisasiTotal,
    sem2AktivitasLangsung,
    sem2AktivitasTidakLangsung,
    sem2AktivitasPenunjang,
    hasAktivitasSem2Input,
    isAktivitasChangedInSem2,
    sem2SifatBantuan,
    sem2Lokasi,
    sem2Sasaran,
    sem2BesaranManfaat,
    sem2JenisBantuan,
    sem2Durasi,
    sem2KeteranganDurasi,
    hasKarakteristikSem2Input,
    isKarakteristikChangedInSem2,
    hasSem2ActivityOrRealisasi,
    changeBadges,
  };
}

export const SystemGovernanceView: React.FC<SystemGovernanceViewProps> = ({
  mode,
  periodes,
  activePeriode,
  allOpds,
  auditLogs,
  rows,
  userRole,
  onSelectPeriode,
  onUpdatePeriode,
  onCreateNewYear,
  onResetDatabase,
}) => {
  const [newYearInput, setNewYearInput] = useState<number>(
    Math.max(...periodes.map((p) => p.tahun)) + 1
  );
  const [copyStructure, setCopyStructure] = useState<boolean>(true);
  const [riwayatFilterMode, setRiwayatFilterMode] = useState<'ALL' | 'CHANGED_SEM2' | 'SEM2_INPUT'>(
    'ALL'
  );
  const [riwayatOpdFilter, setRiwayatOpdFilter] = useState<string>('ALL');
  const [riwayatSearch, setRiwayatSearch] = useState('');
  const [selectedMatrixId, setSelectedMatrixId] = useState<string | null>(null);

  const analyzedRows = useMemo(() => {
    return rows.map((r) => analyzeRowHistory(r));
  }, [rows]);

  const filteredAnalyzedRows = useMemo(() => {
    return analyzedRows.filter((item) => {
      if (userRole === 'ADMIN' && riwayatOpdFilter !== 'ALL') {
        if (item.row.opd_id !== riwayatOpdFilter) return false;
      }
      if (riwayatFilterMode === 'CHANGED_SEM2' && item.changeBadges.length === 0) {
        return false;
      }
      if (riwayatFilterMode === 'SEM2_INPUT' && !item.hasSem2ActivityOrRealisasi) {
        return false;
      }
      if (riwayatSearch.trim()) {
        const q = riwayatSearch.toLowerCase();
        const r = item.row;
        return (
          (r.kode || '').toLowerCase().includes(q) ||
          (r.sub_kegiatan || '').toLowerCase().includes(q) ||
          (r.kegiatan || '').toLowerCase().includes(q) ||
          (r.program || '').toLowerCase().includes(q) ||
          (r.nama_opd || '').toLowerCase().includes(q) ||
          (r.strategi || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [analyzedRows, userRole, riwayatOpdFilter, riwayatFilterMode, riwayatSearch]);

  const selectedAnalysis = useMemo(() => {
    if (!selectedMatrixId) return null;
    return analyzedRows.find((a) => a.row.matrix_id === selectedMatrixId) || null;
  }, [analyzedRows, selectedMatrixId]);

  if (mode === 'pengaturan-periode') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <div className="pb-5 border-b border-slate-200/80">
          <p className="text-xs font-medium text-sky-700 mb-1">
            Manajemen Periode Pelaporan & Pengembangan Multi-Tahun
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pengaturan Periode Input Semester 1 & Semester 2
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Admin dapat membuka atau menutup periode pengisian Realisasi Semester 1 (Januari–Juni) maupun Semester 2 (Juli–Desember) secara independen serta menambahkan tahun anggaran baru.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kolom Kiri (2/3): Pengaturan Buka/Tutup Semester */}
          <div className="lg:col-span-2 space-y-4">
            {periodes.map((per) => {
              const isSelected = per.periode_id === activePeriode.periode_id;
              return (
                <div
                  key={per.periode_id}
                  className={`bg-white rounded-xl border p-6 space-y-5 transition-all ${
                    isSelected
                      ? 'border-[#1E3A8A] shadow-[0_4px_16px_-4px_rgba(30,58,138,0.1)]'
                      : 'border-slate-200/80'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">
                          {per.nama_periode}
                        </h3>
                        {isSelected && (
                          <span className="text-xs font-semibold text-[#1E3A8A]">
                            · Sedang Dilihat
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        ID Periode: <span className="font-mono-tabular">{per.periode_id}</span> ·
                        Terakhir diperbarui {formatDateTimeID(per.updated_at)}
                      </p>
                    </div>
                    {!isSelected && (
                      <button
                        onClick={() => onSelectPeriode(per.periode_id)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-[#1E3A8A] bg-sky-50 border border-sky-200 rounded-lg hover:bg-sky-100 cursor-pointer"
                      >
                        Aktifkan Tampilan Tahun {per.tahun}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Kendali Semester 1 */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Periode Semester 1
                          </p>
                          <p className="text-[11px] text-slate-500">Januari – Juni {per.tahun}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-1 ${
                            per.semester_1_buka ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {per.semester_1_buka ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" /> Dibuka
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Ditutup
                            </>
                          )}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Batas Akhir Pelaporan Semester 1:
                        </label>
                        <input
                          type="date"
                          disabled={userRole !== 'ADMIN'}
                          value={per.batas_semester_1}
                          onChange={(e) =>
                            onUpdatePeriode(per.periode_id, {
                              batas_semester_1: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      {userRole === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePeriode(per.periode_id, {
                              semester_1_buka: !per.semester_1_buka,
                            })
                          }
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            per.semester_1_buka
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          {per.semester_1_buka
                            ? 'Tutup Periode Input Semester 1'
                            : 'Buka Periode Input Semester 1'}
                        </button>
                      )}
                    </div>

                    {/* Kendali Semester 2 */}
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-900">
                            Periode Semester 2
                          </p>
                          <p className="text-[11px] text-slate-500">Juli – Desember {per.tahun}</p>
                        </div>
                        <span
                          className={`text-xs font-semibold inline-flex items-center gap-1 ${
                            per.semester_2_buka ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {per.semester_2_buka ? (
                            <>
                              <Unlock className="w-3.5 h-3.5" /> Dibuka
                            </>
                          ) : (
                            <>
                              <Lock className="w-3.5 h-3.5" /> Ditutup
                            </>
                          )}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          Batas Akhir Pelaporan Semester 2:
                        </label>
                        <input
                          type="date"
                          disabled={userRole !== 'ADMIN'}
                          value={per.batas_semester_2}
                          onChange={(e) =>
                            onUpdatePeriode(per.periode_id, {
                              batas_semester_2: e.target.value,
                            })
                          }
                          className="w-full px-3 py-1.5 text-xs font-mono-tabular bg-white border border-slate-300 rounded-lg"
                        />
                      </div>

                      {userRole === 'ADMIN' && (
                        <button
                          type="button"
                          onClick={() =>
                            onUpdatePeriode(per.periode_id, {
                              semester_2_buka: !per.semester_2_buka,
                            })
                          }
                          className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                            per.semester_2_buka
                              ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                              : 'bg-emerald-700 text-white hover:bg-emerald-800'
                          }`}
                        >
                          {per.semester_2_buka
                            ? 'Tutup Periode Input Semester 2'
                            : 'Buka Periode Input Semester 2'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Kolom Kanan (1/3): Pengembangan Tahun Anggaran Berikutnya */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4">
              <div className="flex items-center gap-2.5">
                <PlusCircle className="w-5 h-5 text-[#1E3A8A]" />
                <h3 className="text-sm font-bold text-slate-900">
                  Tambah Tahun Anggaran Berikutnya
                </h3>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Sistem dirancang multi-periode agar mudah dikembangkan untuk tahun berikutnya tanpa kehilangan riwayat tahun berjalan.
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tahun Anggaran Baru:
                </label>
                <input
                  type="number"
                  min={2024}
                  max={2035}
                  value={newYearInput}
                  onChange={(e) => setNewYearInput(parseInt(e.target.value, 10) || 2027)}
                  className="w-full px-3.5 py-2 text-sm font-mono-tabular font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded-lg"
                />
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={copyStructure}
                  onChange={(e) => setCopyStructure(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-[#1E3A8A]"
                />
                <span>
                  Salin struktur dasar Program, Kegiatan, dan Sub Kegiatan dari{' '}
                  <strong>{activePeriode.nama_periode}</strong>
                </span>
              </label>

              <button
                type="button"
                disabled={userRole !== 'ADMIN'}
                onClick={() =>
                  onCreateNewYear(
                    newYearInput,
                    copyStructure ? activePeriode.periode_id : null
                  )
                }
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-slate-900 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
              >
                Buat Periode Tahun {newYearInput}
              </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900">Reset Data Simulasi</h3>
              <p className="text-xs text-slate-500">
                Kembalikan seluruh data matriks, realisasi semester, dan log verifikasi ke kondisi awal Kabupaten Blora.
              </p>
              <button
                type="button"
                onClick={onResetDatabase}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset ke Data Awal</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  if (mode === 'audit-log') {
    const totalPaguAcuan = filteredAnalyzedRows.reduce((sum, item) => sum + item.paguAcuan, 0);
    const totalPaguMurni = filteredAnalyzedRows.reduce((sum, item) => sum + item.paguMurni, 0);
    const totalRealisasiS1 = filteredAnalyzedRows.reduce(
      (sum, item) => sum + item.realisasiSem1,
      0
    );
    const totalRealisasiS2 = filteredAnalyzedRows.reduce(
      (sum, item) => sum + item.realisasiSem2,
      0
    );
    const totalSisaPagu = filteredAnalyzedRows.reduce((sum, item) => sum + item.sisaPagu, 0);
    const countChangedInSem2 = filteredAnalyzedRows.filter(
      (item) => item.changeBadges.length > 0
    ).length;

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {/* Header Riwayat */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            <p className="text-xs font-semibold text-[#2563EB] mb-1">
              Riwayat Input, Perubahan Semester 1 & 2, Realisasi, hingga Sisa Pagu
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Riwayat Sub Program & Kode Rekening (Semester 1 & Semester 2)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Klik pada <strong>Kode Rekening</strong> atau <strong>Nama Sub Kegiatan</strong> untuk melihat rincian history mulai dari inputan Semester 1, perubahan di Semester 2, Realisasi Semester 1 & 2, hingga perhitungan <strong>Sisa Pagu Anggaran</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={riwayatSearch}
                onChange={(e) => setRiwayatSearch(e.target.value)}
                placeholder="Cari kode rekening / sub kegiatan..."
                className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-xl w-56 sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              />
            </div>

            {userRole === 'ADMIN' && (
              <select
                value={riwayatOpdFilter}
                onChange={(e) => setRiwayatOpdFilter(e.target.value)}
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl max-w-[220px] truncate"
              >
                <option value="ALL">Semua Perangkat Daerah (OPD)</option>
                {allOpds.map((opd) => (
                  <option key={opd.opd_id} value={opd.opd_id}>
                    {opd.nama_opd}
                  </option>
                ))}
              </select>
            )}

            <select
              value={riwayatFilterMode}
              onChange={(e) =>
                setRiwayatFilterMode(e.target.value as 'ALL' | 'CHANGED_SEM2' | 'SEM2_INPUT')
              }
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-xl"
            >
              <option value="ALL">Semua Sub Kegiatan ({analyzedRows.length})</option>
              <option value="CHANGED_SEM2">Ada Perubahan di Semester 2</option>
              <option value="SEM2_INPUT">Sudah Diisi pada Semester 2</option>
            </select>
          </div>
        </div>

        {/* Kartu Ringkasan Riwayat */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Sub Kegiatan & Kode Rekening
            </span>
            <p className="text-xl font-mono-tabular font-extrabold text-slate-900">
              {filteredAnalyzedRows.length} Sub Kegiatan
            </p>
            <p className="text-[11px] text-indigo-700 font-semibold">
              {countChangedInSem2} sub kegiatan mengalami perubahan di Sem 2
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Pagu Acuan (Murni / Perubahan)
            </span>
            <p className="text-lg font-mono-tabular font-extrabold text-slate-900">
              {formatRupiah(totalPaguAcuan)}
            </p>
            <p className="text-[11px] text-slate-500">
              Pagu Murni Sem 1: <strong className="text-slate-700">{formatRupiah(totalPaguMurni)}</strong>
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Realisasi Semester 1 & Semester 2
            </span>
            <p className="text-lg font-mono-tabular font-extrabold text-[#2563EB]">
              {formatRupiah(totalRealisasiS1 + totalRealisasiS2)}
            </p>
            <p className="text-[11px] text-slate-500">
              S1: <strong className="text-slate-700">{formatRupiah(totalRealisasiS1)}</strong> · S2:{' '}
              <strong className="text-indigo-700">{formatRupiah(totalRealisasiS2)}</strong>
            </p>
          </div>

          <div
            className={`rounded-2xl border p-4 shadow-2xs space-y-1 ${
              totalSisaPagu < 0
                ? 'bg-rose-50/80 border-rose-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}
          >
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider ${
                totalSisaPagu < 0 ? 'text-rose-700' : 'text-emerald-800'
              }`}
            >
              Total Sisa Pagu Anggaran
            </span>
            <p
              className={`text-lg font-mono-tabular font-extrabold ${
                totalSisaPagu < 0 ? 'text-rose-700' : 'text-emerald-900'
              }`}
            >
              {totalSisaPagu < 0
                ? `- ${formatRupiah(Math.abs(totalSisaPagu))}`
                : formatRupiah(totalSisaPagu)}
            </p>
            <p className="text-[11px] text-slate-600">
              Pagu Acuan − Realisasi Sem 1 − Realisasi Sem 2
            </p>
          </div>
        </div>

        {/* Tabel Daftar Sub Program & Kode Rekening */}
        <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-[0_2px_12px_-3px_rgba(15,23,42,0.05)]">
          {filteredAnalyzedRows.length === 0 ? (
            <div className="py-14 px-4 text-center space-y-2">
              <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
                <History className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Belum Ada Data Sub Kegiatan / Kode Rekening
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Data sub program, kode rekening, perubahan Semester 1 & Semester 2, realisasi, serta perhitungan sisa pagu akan tampil di sini setelah matriks diinputkan.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/90 text-[11px] font-bold text-slate-600">
                    <th className="py-3.5 px-4 w-10 text-center">No</th>
                    <th className="py-3.5 px-4 min-w-[280px]">
                      Kode Rekening & Sub Program / Sub Kegiatan
                    </th>
                    <th className="py-3.5 px-4 min-w-[210px]">Inputan & Realisasi Semester 1</th>
                    <th className="py-3.5 px-4 min-w-[230px]">Perubahan & Realisasi Semester 2</th>
                    <th className="py-3.5 px-4 min-w-[200px]">Sisa Pagu Anggaran</th>
                    <th className="py-3.5 px-4 text-right whitespace-nowrap">Rincian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70">
                  {filteredAnalyzedRows.map((item, idx) => {
                    const { row } = item;
                    const isNegativeSisa = item.sisaPagu < 0;

                    return (
                      <tr
                        key={row.matrix_id}
                        onClick={() => setSelectedMatrixId(row.matrix_id)}
                        className="hover:bg-blue-50/40 transition-colors align-top cursor-pointer group"
                      >
                        <td className="py-4 px-4 text-center font-mono-tabular font-semibold text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Kolom Klik Kode Rekening & Sub Kegiatan */}
                        <td className="py-4 px-4 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatrixId(row.matrix_id);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 group-hover:bg-[#2563EB] text-[#1D4ED8] group-hover:text-white border border-blue-200 group-hover:border-[#2563EB] font-mono-tabular font-bold text-xs transition-all cursor-pointer"
                              title="Klik Kode Rekening untuk melihat rincian history Semester 1 & 2"
                            >
                              <span>{row.kode || '-'}</span>
                              <ArrowRight className="w-3 h-3" />
                            </button>

                            {userRole === 'ADMIN' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10.5px] font-semibold">
                                <Building2 className="w-3 h-3 text-slate-500" />
                                {row.singkatan_opd || row.nama_opd}
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatrixId(row.matrix_id);
                            }}
                            className="text-left block font-bold text-slate-900 group-hover:text-[#2563EB] transition-colors leading-snug cursor-pointer"
                          >
                            {row.sub_kegiatan || '-'}
                          </button>

                          <div className="text-[11px] text-slate-500 space-y-0.5">
                            <p className="line-clamp-1">
                              <span className="font-semibold text-slate-600">Program:</span>{' '}
                              {row.program || '-'}
                            </p>
                            <p className="line-clamp-1">
                              <span className="font-semibold text-slate-600">Kegiatan:</span>{' '}
                              {row.kegiatan || '-'}
                            </p>
                          </div>
                        </td>

                        {/* Kolom Ringkasan Semester 1 */}
                        <td className="py-4 px-4 space-y-1.5">
                          <StatusIndicator status={row.sem1.status_verifikasi} />
                          <div className="pt-0.5 space-y-0.5">
                            <p className="text-[11px] text-slate-500">
                              Alokasi Sem 1:{' '}
                              <strong className="font-mono-tabular text-slate-900">
                                {formatRupiah(item.paguMurni)}
                              </strong>
                            </p>
                            <p className="text-[11px] text-slate-500">
                              Realisasi Sem 1:{' '}
                              <strong className="font-mono-tabular text-[#2563EB]">
                                {formatRupiah(item.realisasiSem1)}
                              </strong>
                            </p>
                            <p className="text-[10.5px] text-slate-400 line-clamp-1">
                              Sumber: {row.sumber_pembiayaan || '-'}
                            </p>
                          </div>
                        </td>

                        {/* Kolom Perubahan & Realisasi Semester 2 */}
                        <td className="py-4 px-4 space-y-1.5">
                          <StatusIndicator status={row.sem2.status_verifikasi} />

                          <div className="flex flex-wrap gap-1 pt-0.5">
                            {item.changeBadges.length > 0 ? (
                              item.changeBadges.map((badge) => (
                                <span
                                  key={badge}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] font-bold"
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  {badge}
                                </span>
                              ))
                            ) : item.hasSem2ActivityOrRealisasi ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                Data Teknis Sama dengan Sem 1
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 text-[10px]">
                                Belum Ada Input Sem 2
                              </span>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            {item.hasAnggaranPerubahan ? (
                              <p className="text-[11px] text-indigo-900">
                                Alokasi Perubahan:{' '}
                                <strong className="font-mono-tabular font-bold">
                                  {formatRupiah(item.paguPerubahan)}
                                </strong>
                              </p>
                            ) : (
                              <p className="text-[11px] text-slate-500">
                                Tanpa Anggaran Perubahan
                              </p>
                            )}
                            <p className="text-[11px] text-slate-500">
                              Realisasi Sem 2:{' '}
                              <strong className="font-mono-tabular text-indigo-700">
                                {formatRupiah(item.realisasiSem2)}
                              </strong>
                            </p>
                          </div>
                        </td>

                        {/* Kolom Sisa Pagu */}
                        <td className="py-4 px-4 space-y-1">
                          <span
                            className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              item.hasAnggaranPerubahan
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-blue-50 text-blue-700 border-blue-200'
                            }`}
                          >
                            {item.hasAnggaranPerubahan
                              ? 'Acuan: Alokasi Perubahan'
                              : 'Acuan: Alokasi Murni'}
                          </span>
                          <p
                            className={`text-sm font-mono-tabular font-extrabold ${
                              isNegativeSisa ? 'text-rose-600' : 'text-emerald-700'
                            }`}
                          >
                            {isNegativeSisa
                              ? `- ${formatRupiah(Math.abs(item.sisaPagu))}`
                              : formatRupiah(item.sisaPagu)}
                          </p>
                          <p className="text-[10.5px] text-slate-500">
                            Total Realisasi S1+S2:{' '}
                            <strong className="text-slate-700">
                              {formatRupiah(item.totalRealisasi)}
                            </strong>{' '}
                            ({item.persenRealisasiTotal.toFixed(1)}%)
                          </p>
                        </td>

                        {/* Tombol Buka Rincian History */}
                        <td className="py-4 px-4 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMatrixId(row.matrix_id);
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 group-hover:bg-[#2563EB] text-slate-700 group-hover:text-white text-xs font-bold transition-all cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Rincian History</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* MODAL RINCIAN HISTORY SUB KEGIATAN (SEMESTER 1 vs SEMESTER 2, REALISASI & SISA PAGU) */}
        <AnimatePresence>
          {selectedAnalysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMatrixId(null)}
              className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white w-full max-w-5xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              >
                {/* Header Modal Detail History */}
                <div className="px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded-lg bg-white/15 border border-white/25 font-mono-tabular text-xs font-bold">
                        Kode Rekening: {selectedAnalysis.row.kode || '-'}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-xs font-semibold">
                        TA {activePeriode.tahun}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-white/15 text-xs font-semibold">
                        {selectedAnalysis.row.nama_opd}
                      </span>
                    </div>
                    <h2 className="text-base sm:text-lg font-extrabold leading-snug">
                      {selectedAnalysis.row.sub_kegiatan || '-'}
                    </h2>
                    <p className="text-xs text-blue-100">
                      Program: {selectedAnalysis.row.program || '-'} · Kegiatan:{' '}
                      {selectedAnalysis.row.kegiatan || '-'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedMatrixId(null)}
                    className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shrink-0"
                    aria-label="Tutup Rincian History"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Body Modal Detail History */}
                <div className="p-6 overflow-y-auto space-y-6">
                  {/* 1. PERBANDINGAN ANGGARAN & SUMBER PENDANAAN (SEMESTER 1 vs PERUBAHAN SEMESTER 2) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-[#2563EB]" />
                        <span>
                          1. Riwayat Alokasi Anggaran & Sumber Pendanaan (Semester 1 vs Semester 2)
                        </span>
                      </h3>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                          selectedAnalysis.hasAnggaranPerubahan
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {selectedAnalysis.hasAnggaranPerubahan
                          ? 'Terdapat Alokasi Anggaran Perubahan di Semester 2'
                          : 'Alokasi Anggaran Tetap (Murni Semester 1)'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Alokasi Semester 1 */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-800">
                            Semester 1 — Alokasi Anggaran Murni
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Semester 1
                          </span>
                        </div>
                        <p className="text-lg font-mono-tabular font-extrabold text-slate-900">
                          {formatRupiah(selectedAnalysis.paguMurni)}
                        </p>
                        <p className="text-xs text-slate-600">
                          <span className="font-semibold">Sumber Pendanaan Sem 1:</span>{' '}
                          {selectedAnalysis.row.sumber_pembiayaan || '-'}
                        </p>
                      </div>

                      {/* Alokasi Semester 2 (Perubahan) */}
                      <div
                        className={`p-4 rounded-2xl border space-y-2 ${
                          selectedAnalysis.hasAnggaranPerubahan
                            ? 'bg-indigo-50/60 border-indigo-200'
                            : 'bg-slate-50 border-slate-200/90'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-indigo-950">
                            Semester 2 — Alokasi Anggaran Perubahan
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            Semester 2
                          </span>
                        </div>
                        {selectedAnalysis.hasAnggaranPerubahan ? (
                          <>
                            <div className="flex flex-wrap items-baseline gap-2">
                              <p className="text-lg font-mono-tabular font-extrabold text-indigo-950">
                                {formatRupiah(selectedAnalysis.paguPerubahan)}
                              </p>
                              {(() => {
                                const delta =
                                  selectedAnalysis.paguPerubahan - selectedAnalysis.paguMurni;
                                if (delta === 0) return null;
                                return (
                                  <span
                                    className={`text-xs font-mono-tabular font-bold ${
                                      delta > 0 ? 'text-emerald-700' : 'text-rose-700'
                                    }`}
                                  >
                                    ({delta > 0 ? '+' : '- '}
                                    {formatRupiah(Math.abs(delta))})
                                  </span>
                                );
                              })()}
                            </div>
                            <p className="text-xs text-indigo-900">
                              <span className="font-semibold">Sumber Pendanaan Perubahan:</span>{' '}
                              {selectedAnalysis.row.sumber_pembiayaan_perubahan ||
                                selectedAnalysis.row.sumber_pembiayaan ||
                                '-'}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm font-bold text-slate-700">
                              Menggunakan Alokasi Anggaran Murni ({formatRupiah(selectedAnalysis.paguMurni)})
                            </p>
                            <p className="text-xs text-slate-500">
                              Tidak ada pengisian Alokasi Anggaran Perubahan pada Semester 2.
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. PERBANDINGAN AKTIVITAS REAL (SEMESTER 1 vs SEMESTER 2) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <Layers className="w-4 h-4 text-[#2563EB]" />
                        <span>2. Riwayat & Perubahan Aktivitas Real (Semester 1 vs Semester 2)</span>
                      </h3>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                          selectedAnalysis.isAktivitasChangedInSem2
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {selectedAnalysis.isAktivitasChangedInSem2
                          ? 'Ada Perubahan Aktivitas di Semester 2'
                          : 'Aktivitas Semester 2 Sama dengan Semester 1'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Aktivitas Real Semester 1 */}
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
                          <span className="text-xs font-extrabold text-slate-800">
                            Rekap Aktivitas Real Semester 1
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-800">
                            Semester 1
                          </span>
                        </div>
                        {[
                          {
                            label: '1. Aktivitas Real Langsung',
                            val: selectedAnalysis.row.aktivitas_real_langsung,
                          },
                          {
                            label: '2. Aktivitas Real Tidak Langsung',
                            val: selectedAnalysis.row.aktivitas_real_tidak_langsung,
                          },
                          {
                            label: '3. Aktivitas Real Penunjang',
                            val: selectedAnalysis.row.aktivitas_real_penunjang,
                          },
                        ]
                          .filter((a) => (a.val || '').trim().length > 0)
                          .map((a) => (
                            <div
                              key={a.label}
                              className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1"
                            >
                              <span className="block text-[11px] font-bold text-slate-700">
                                {a.label}
                              </span>
                              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                {a.val}
                              </p>
                            </div>
                          ))}
                      </div>

                      {/* Aktivitas Real Semester 2 */}
                      <div className="p-4 rounded-2xl bg-indigo-50/40 border border-indigo-200/90 space-y-3">
                        <div className="flex items-center justify-between pb-2 border-b border-indigo-200/70">
                          <span className="text-xs font-extrabold text-indigo-950">
                            Rekap Aktivitas Real Semester 2
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                            Semester 2
                          </span>
                        </div>
                        {[
                          {
                            label: '1. Aktivitas Real Langsung (Sem 2)',
                            val: selectedAnalysis.sem2AktivitasLangsung,
                            changed:
                              selectedAnalysis.hasAktivitasSem2Input &&
                              selectedAnalysis.sem2AktivitasLangsung !==
                                (selectedAnalysis.row.aktivitas_real_langsung || '').trim(),
                          },
                          {
                            label: '2. Aktivitas Real Tidak Langsung (Sem 2)',
                            val: selectedAnalysis.sem2AktivitasTidakLangsung,
                            changed:
                              selectedAnalysis.hasAktivitasSem2Input &&
                              selectedAnalysis.sem2AktivitasTidakLangsung !==
                                (selectedAnalysis.row.aktivitas_real_tidak_langsung || '').trim(),
                          },
                          {
                            label: '3. Aktivitas Real Penunjang (Sem 2)',
                            val: selectedAnalysis.sem2AktivitasPenunjang,
                            changed:
                              selectedAnalysis.hasAktivitasSem2Input &&
                              selectedAnalysis.sem2AktivitasPenunjang !==
                                (selectedAnalysis.row.aktivitas_real_penunjang || '').trim(),
                          },
                        ]
                          .filter((a) => (a.val || '').trim().length > 0)
                          .map((a) => (
                            <div
                              key={a.label}
                              className="p-3 rounded-xl bg-white border border-indigo-200/80 space-y-1"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="block text-[11px] font-bold text-indigo-950">
                                  {a.label}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                    a.changed
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  {a.changed ? 'Berubah di Sem 2' : 'Sama dgn Sem 1'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">
                                {a.val}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 3. PERBANDINGAN KARAKTERISTIK & SASARAN PENERIMA MANFAAT (SEMESTER 1 vs SEMESTER 2) */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-[#2563EB]" />
                        <span>
                          3. Riwayat & Perubahan Karakteristik & Sasaran (Semester 1 vs Semester 2)
                        </span>
                      </h3>
                      <span
                        className={`text-[11px] font-bold px-2.5 py-0.5 rounded-lg border ${
                          selectedAnalysis.isKarakteristikChangedInSem2
                            ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {selectedAnalysis.isKarakteristikChangedInSem2
                          ? 'Ada Perubahan Karakteristik/Sasaran di Semester 2'
                          : 'Karakteristik & Sasaran Sama dengan Semester 1'}
                      </span>
                    </div>

                    <div className="overflow-x-auto rounded-2xl border border-slate-200/90">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600">
                            <th className="py-2.5 px-4 w-48">Komponen Karakteristik</th>
                            <th className="py-2.5 px-4">Inputan Semester 1</th>
                            <th className="py-2.5 px-4">Inputan / Perubahan Semester 2</th>
                            <th className="py-2.5 px-4 w-36 text-center">Keterangan</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70">
                          {[
                            {
                              label: 'Sifat Bantuan',
                              sem1: selectedAnalysis.row.sifat_bantuan || '-',
                              sem2: selectedAnalysis.sem2SifatBantuan || '-',
                            },
                            {
                              label: 'Lokasi Kegiatan',
                              sem1: selectedAnalysis.row.lokasi || '-',
                              sem2: selectedAnalysis.sem2Lokasi || '-',
                            },
                            {
                              label: 'Target & Rincian Sasaran Penerima Manfaat',
                              sem1:
                                selectedAnalysis.row.keterangan_sasaran ||
                                selectedAnalysis.row.satuan_sasaran ||
                                '-',
                              sem2: selectedAnalysis.sem2Sasaran || '-',
                            },
                            {
                              label: 'Besaran Manfaat',
                              sem1: selectedAnalysis.row.besaran_manfaat || '-',
                              sem2: selectedAnalysis.sem2BesaranManfaat || '-',
                            },
                            {
                              label: 'Jenis Bantuan',
                              sem1: selectedAnalysis.row.jenis_bantuan || '-',
                              sem2: selectedAnalysis.sem2JenisBantuan || '-',
                            },
                            {
                              label: 'Durasi Pemberian Bantuan',
                              sem1: `${selectedAnalysis.row.durasi_pemberian_bantuan || '-'}${
                                selectedAnalysis.row.keterangan_durasi_bantuan
                                  ? ` (${selectedAnalysis.row.keterangan_durasi_bantuan})`
                                  : ''
                              }`,
                              sem2: `${selectedAnalysis.sem2Durasi || '-'}${
                                selectedAnalysis.sem2KeteranganDurasi
                                  ? ` (${selectedAnalysis.sem2KeteranganDurasi})`
                                  : ''
                              }`,
                            },
                          ].map((rowItem) => {
                            const isDiff = rowItem.sem1.trim() !== rowItem.sem2.trim();
                            return (
                              <tr key={rowItem.label} className="align-top">
                                <td className="py-3 px-4 font-bold text-slate-700 bg-slate-50/50">
                                  {rowItem.label}
                                </td>
                                <td className="py-3 px-4 text-slate-700 whitespace-pre-line">
                                  {rowItem.sem1}
                                </td>
                                <td className="py-3 px-4 text-slate-900 font-medium whitespace-pre-line bg-indigo-50/20">
                                  {rowItem.sem2}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <span
                                    className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      isDiff
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {isDiff ? 'Berubah di Sem 2' : 'Tetap / Sama'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 4. REALISASI SEMESTER 1, REALISASI AKUMULASI/FINAL & PERHITUNGAN SISA PAGU */}
                  <div className="space-y-4">
                    <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-[#2563EB]" />
                      <span>
                        4. Rincian Realisasi Semester 1, Realisasi Akumulasi/Final & Sisa Pagu Anggaran
                      </span>
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Realisasi Semester 1 */}
                      <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-blue-200/80 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900">
                              Realisasi Semester 1 (Januari – Juni {activePeriode.tahun})
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Terhadap Alokasi Murni ({formatRupiah(selectedAnalysis.paguMurni)})
                            </p>
                          </div>
                          <StatusIndicator status={selectedAnalysis.row.sem1.status_verifikasi} />
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <p className="text-lg font-mono-tabular font-extrabold text-[#2563EB]">
                            {formatRupiah(selectedAnalysis.realisasiSem1)}
                          </p>
                          <span className="text-xs font-mono-tabular font-bold text-slate-700">
                            Capaian S1:{' '}
                            {selectedAnalysis.paguMurni > 0
                              ? `${(
                                  (selectedAnalysis.realisasiSem1 / selectedAnalysis.paguMurni) *
                                  100
                                ).toFixed(1)}%`
                              : '0%'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Rincian Realisasi Semester 1
                          </span>
                          <p className="text-xs text-slate-700 whitespace-pre-line">
                            {selectedAnalysis.row.sem1.rincian_realisasi ||
                              'Belum ada keterangan rincian realisasi Semester 1.'}
                          </p>
                        </div>

                        {selectedAnalysis.row.sem1.catatan_verifikator && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <strong>Catatan Verifikator Sem 1:</strong>{' '}
                            {selectedAnalysis.row.sem1.catatan_verifikator}
                          </p>
                        )}
                      </div>

                      {/* Realisasi Semester 2 */}
                      <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-indigo-200/80 space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <h4 className="text-xs font-extrabold text-slate-900">
                              Realisasi Semester 2 — TA {activePeriode.tahun}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Periode Juli – Desember ({formatRupiah(selectedAnalysis.paguAcuan)})
                            </p>
                          </div>
                          <StatusIndicator status={selectedAnalysis.row.sem2.status_verifikasi} />
                        </div>

                        <div className="flex items-baseline justify-between pt-1">
                          <p className="text-lg font-mono-tabular font-extrabold text-indigo-700">
                            {formatRupiah(selectedAnalysis.realisasiSem2)}
                          </p>
                          <span className="text-xs font-mono-tabular font-bold text-slate-700">
                            Capaian Sem 2:{' '}
                            {selectedAnalysis.paguAcuan > 0
                              ? `${(
                                  (selectedAnalysis.realisasiSem2 / selectedAnalysis.paguAcuan) *
                                  100
                                ).toFixed(1)}%`
                              : '0%'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl bg-white border border-slate-200/80 space-y-1">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Rincian Realisasi Semester 2
                          </span>
                          <p className="text-xs text-slate-700 whitespace-pre-line">
                            {selectedAnalysis.row.sem2.rincian_realisasi ||
                              'Belum ada keterangan rincian realisasi Semester 2.'}
                          </p>
                        </div>

                        {selectedAnalysis.row.sem2.catatan_verifikator && (
                          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                            <strong>Catatan Verifikator Realisasi Sem 2:</strong>{' '}
                            {selectedAnalysis.row.sem2.catatan_verifikator}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* REALISASI FINAL (PENJUMLAHAN SEMESTER 1 + SEMESTER 2) */}
                    <div className="p-5 rounded-2xl bg-indigo-50/70 border-2 border-indigo-200/90 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-indigo-200/70">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 text-indigo-600" />
                          <div>
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                              Realisasi Final — TA {activePeriode.tahun} (Penjumlahan Semester 1 + Semester 2)
                            </h4>
                            <p className="text-[11px] text-slate-600">
                              Rumus:{' '}
                              <strong>
                                Realisasi Semester 1 + Realisasi Semester 2
                              </strong>
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-indigo-100 text-indigo-800 border-indigo-200">
                          Capaian Realisasi Final: {selectedAnalysis.persenRealisasiTotal.toFixed(1)}%
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-white border border-indigo-100">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Realisasi Semester 1 (Jan – Jun)
                          </span>
                          <p className="text-sm font-mono-tabular font-bold text-[#2563EB] mt-1">
                            {formatRupiah(selectedAnalysis.realisasiSem1)}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-indigo-100">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Realisasi Semester 2 (Jul – Des)
                          </span>
                          <p className="text-sm font-mono-tabular font-bold text-indigo-700 mt-1">
                            + {formatRupiah(selectedAnalysis.realisasiSem2)}
                          </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-indigo-600 text-white border border-indigo-700">
                          <span className="block text-[10px] font-extrabold uppercase tracking-wider text-indigo-100">
                            Total Realisasi Final (S1 + S2)
                          </span>
                          <p className="text-base font-mono-tabular font-extrabold mt-0.5">
                            {formatRupiah(selectedAnalysis.totalRealisasi)}
                          </p>
                          <span className="block text-[10px] text-indigo-100 mt-0.5">
                            Penjumlahan Semester 1 & Semester 2
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* PERHITUNGAN SISA PAGU ANGGARAN */}
                    <div
                      className={`p-5 rounded-2xl border-2 space-y-3.5 ${
                        selectedAnalysis.sisaPagu < 0
                          ? 'bg-rose-50/70 border-rose-200'
                          : 'bg-emerald-50/60 border-emerald-200/90'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-200/70">
                        <div className="flex items-center gap-2">
                          <Wallet
                            className={`w-4 h-4 ${
                              selectedAnalysis.sisaPagu < 0
                                ? 'text-rose-600'
                                : 'text-emerald-600'
                            }`}
                          />
                          <div>
                            <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                              Perhitungan Sisa Pagu Anggaran
                            </h4>
                            <p className="text-[11px] text-slate-600">
                              Rumus:{' '}
                              <strong>
                                Alokasi Pagu Anggaran Perubahan − Realisasi Final (Semester 1 + Semester 2)
                              </strong>
                            </p>
                          </div>
                        </div>
                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg border bg-indigo-100/80 text-indigo-800 border-indigo-200">
                          Acuan Pagu: Alokasi Pagu Anggaran Perubahan
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            1. Alokasi Pagu Anggaran Perubahan
                          </span>
                          <p className="text-sm font-mono-tabular font-extrabold text-slate-900 mt-1">
                            {formatRupiah(selectedAnalysis.paguAcuan)}
                          </p>
                          {!selectedAnalysis.hasAnggaranPerubahan && (
                            <span className="block text-[10px] text-slate-500 mt-0.5">
                              (Menggunakan Pagu Murni karena Perubahan belum diisi)
                            </span>
                          )}
                        </div>

                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/80">
                          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            2. Pengurang Realisasi Final (S1 + S2)
                          </span>
                          <p className="text-sm font-mono-tabular font-bold text-indigo-700 mt-1">
                            − {formatRupiah(selectedAnalysis.totalRealisasi)}
                          </p>
                          <span className="block text-[10px] text-slate-500 mt-0.5">
                            Sem 1 ({formatRupiah(selectedAnalysis.realisasiSem1)}) + Sem 2 ({formatRupiah(selectedAnalysis.realisasiSem2)})
                          </span>
                        </div>

                        <div
                          className={`p-3.5 rounded-xl border ${
                            selectedAnalysis.sisaPagu < 0
                              ? 'bg-rose-100/80 border-rose-300'
                              : 'bg-emerald-100/70 border-emerald-300'
                          }`}
                        >
                          <span
                            className={`block text-[10px] font-extrabold uppercase tracking-wider ${
                              selectedAnalysis.sisaPagu < 0
                                ? 'text-rose-800'
                                : 'text-emerald-800'
                            }`}
                          >
                            Sisa Pagu Anggaran
                          </span>
                          <p
                            className={`text-base font-mono-tabular font-extrabold mt-0.5 ${
                              selectedAnalysis.sisaPagu < 0
                                ? 'text-rose-700'
                                : 'text-emerald-900'
                            }`}
                          >
                            {selectedAnalysis.sisaPagu < 0
                              ? `- ${formatRupiah(Math.abs(selectedAnalysis.sisaPagu))}`
                              : formatRupiah(selectedAnalysis.sisaPagu)}
                          </p>
                          <span className="block text-[10px] font-semibold text-slate-600 mt-0.5">
                            Alokasi Pagu Anggaran Perubahan − Realisasi Final
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 5. LOG KRONOLOGIS AKTIVITAS SUB KEGIATAN INI */}
                  {(() => {
                    const rowLogs = auditLogs.filter(
                      (l) => l.matrix_id === selectedAnalysis.row.matrix_id
                    );
                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-200/80">
                        <h3 className="text-xs sm:text-sm font-extrabold text-slate-900 flex items-center gap-2">
                          <History className="w-4 h-4 text-[#2563EB]" />
                          <span>
                            5. Jejak Waktu & Aktivitas Perubahan Sub Kegiatan ({rowLogs.length}{' '}
                            Catatan)
                          </span>
                        </h3>

                        {rowLogs.length === 0 ? (
                          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
                            <span>
                              Terakhir diperbarui pada{' '}
                              <strong>{formatDateTimeID(selectedAnalysis.row.updated_at)}</strong>
                            </span>
                            <span>
                              Dibuat pada:{' '}
                              <strong>{formatDateTimeID(selectedAnalysis.row.created_at)}</strong>
                            </span>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                            {rowLogs.map((log) => (
                              <div
                                key={log.log_id}
                                className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-bold text-slate-900">{log.aksi}</span>
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                        log.semester === 1
                                          ? 'bg-blue-100 text-blue-800'
                                          : log.semester === 2
                                          ? 'bg-indigo-100 text-indigo-800'
                                          : 'bg-slate-200 text-slate-700'
                                      }`}
                                    >
                                      {log.semester === 1
                                        ? 'Semester 1'
                                        : log.semester === 2
                                        ? 'Semester 2'
                                        : 'Matriks'}
                                    </span>
                                    <span className="text-[11px] text-slate-500">
                                      oleh <strong>{log.user_name}</strong>
                                    </span>
                                  </div>
                                  <p className="text-slate-600">{log.detail_perubahan}</p>
                                  {(log.nilai_sebelumnya || log.nilai_baru) && (
                                    <p className="text-[11px] font-mono-tabular text-slate-500">
                                      Sebelum: {log.nilai_sebelumnya || '-'} → Sesudah:{' '}
                                      <strong className="text-slate-800">
                                        {log.nilai_baru || '-'}
                                      </strong>
                                    </p>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                                  {formatDateTimeID(log.created_at)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Footer Modal */}
                <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => setSelectedMatrixId(null)}
                    className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold transition-colors cursor-pointer"
                  >
                    Tutup Rincian History
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Mode: struktur-db (Inspeksi Skema Tabel MatrixData dan RealisasiSemester sesuai Section 7)
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div className="pb-5 border-b border-slate-200/80">
        <p className="text-xs font-medium text-sky-700 mb-1">
          Arsitektur Basis Data Relasional E-OPPKPKE Kabupaten Blora
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          Struktur Tabel MatrixData & RealisasiSemester
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Pemisahan tabel <code className="font-mono-tabular">MatrixData</code> dan{' '}
          <code className="font-mono-tabular">RealisasiSemester</code> memastikan data realisasi Semester 1 (1 = Januari–Juni) dan Semester 2 (2 = Juli–Desember) diverifikasi serta dikelola secara independen.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tabel 1: MatrixData */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-[#1E3A8A]" />
              <h2 className="text-base font-bold text-slate-900 font-mono-tabular">
                Tabel: MatrixData
              </h2>
            </div>
            <span className="text-xs font-mono-tabular text-slate-500">
              {rows.length} Record Aktif
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2 pr-3">Nama Kolom</th>
                  <th className="py-2 pr-3">Tipe Data</th>
                  <th className="py-2">Keterangan Sumber Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono-tabular text-[11px]">
                {[
                  ['matrix_id', 'VARCHAR (PK)', 'Primary Key Baris Matriks'],
                  ['periode_id', 'VARCHAR (FK)', 'Relasi ke PeriodePelaporan (Tahun)'],
                  ['opd_id', 'VARCHAR (FK)', 'Relasi ke Perangkat Daerah (OPD)'],
                  ['strategi', 'TEXT', 'Otomatis dari Import Excel Admin'],
                  ['kode', 'VARCHAR', 'Otomatis dari Import Excel Admin'],
                  ['program', 'TEXT', 'Otomatis dari Import Excel Admin'],
                  ['kegiatan', 'TEXT', 'Otomatis dari Import Excel Admin'],
                  ['sub_kegiatan', 'TEXT', 'Otomatis dari Import Excel Admin'],
                  ['aktivitas_real_langsung', 'TEXT', 'Diisi oleh OPD (Card 2)'],
                  ['aktivitas_real_tidak_langsung', 'TEXT', 'Diisi oleh OPD (Card 2)'],
                  ['aktivitas_real_penunjang', 'TEXT', 'Diisi oleh OPD (Card 2)'],
                  ['alokasi_anggaran', 'BIGINT / NUMERIC', 'Diisi oleh OPD (Card 3 - Format Rp)'],
                  ['sumber_pembiayaan', 'VARCHAR', 'Diisi oleh OPD (Card 3)'],
                  ['sifat_bantuan', 'ENUM', 'Berkelanjutan / Tidak Berkelanjutan'],
                  ['lokasi', 'TEXT', 'Kecamatan, Desa/Kel, Lokasi Spesifik'],
                  ['jumlah_sasaran', 'INTEGER (>= 0)', 'Mendukung angka 0, tidak negatif'],
                  ['besaran_manfaat', 'TEXT', 'Input fleksibel sesuai satuan program'],
                  ['jenis_bantuan', 'VARCHAR', 'Bansos, pangan, pendidikan, dll.'],
                  ['durasi_pemberian_bantuan', 'VARCHAR', 'Satu kali, 3 bln, 6 bln, 12 bln, dll.'],
                  ['created_at', 'TIMESTAMP', 'Waktu pembuatan record'],
                  ['updated_at', 'TIMESTAMP', 'Waktu pembaruan terakhir'],
                ].map(([col, type, desc]) => (
                  <tr key={col}>
                    <td className="py-1.5 pr-3 font-semibold text-[#1E3A8A]">{col}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{type}</td>
                    <td className="py-1.5 font-sans text-slate-600">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel 2: RealisasiSemester */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-sky-700" />
                <h2 className="text-base font-bold text-slate-900 font-mono-tabular">
                  Tabel: RealisasiSemester
                </h2>
              </div>
              <span className="text-xs font-mono-tabular text-slate-500">
                {rows.length * 2} Record Semester (1 & 2)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-3">Nama Kolom</th>
                    <th className="py-2 pr-3">Tipe Data</th>
                    <th className="py-2">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono-tabular text-[11px]">
                  {[
                    ['realisasi_id', 'VARCHAR (PK)', 'Primary Key Realisasi Semester'],
                    ['matrix_id', 'VARCHAR (FK)', 'Foreign Key ke MatrixData.matrix_id'],
                    ['semester', 'SMALLINT (1 | 2)', '1 = Januari-Juni, 2 = Juli-Desember'],
                    ['realisasi', 'BIGINT / NUMERIC', 'Nilai realisasi anggaran semester (Rp)'],
                    ['status_verifikasi', 'VARCHAR', 'Terverifikasi / Menunggu / Perlu Perbaikan'],
                    ['catatan_verifikator', 'TEXT', 'Catatan pemeriksaan Admin Bapperida'],
                    ['submitted_at', 'TIMESTAMP', 'Waktu pengiriman oleh OPD'],
                    ['verified_at', 'TIMESTAMP', 'Waktu verifikasi oleh Admin'],
                    ['verified_by', 'VARCHAR', 'Identitas pejabat/admin verifikator'],
                    ['updated_at', 'TIMESTAMP', 'Waktu pembaruan terakhir'],
                  ].map(([col, type, desc]) => (
                    <tr key={col}>
                      <td className="py-2 pr-3 font-semibold text-sky-800">{col}</td>
                      <td className="py-2 pr-3 text-slate-500">{type}</td>
                      <td className="py-2 font-sans text-slate-600">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Contoh Isi Tabel RealisasiSemester Aktual */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Sampel Data Aktual pada Tabel <code className="font-mono-tabular">RealisasiSemester</code>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[11px] font-mono-tabular border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2 pr-2">realisasi_id</th>
                    <th className="py-2 pr-2">matrix_id</th>
                    <th className="py-2 pr-2">semester</th>
                    <th className="py-2 pr-2 text-right">realisasi</th>
                    <th className="py-2">status_verifikasi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 4).flatMap((r) => [
                    <tr key={r.sem1.realisasi_id}>
                      <td className="py-1.5 pr-2 text-slate-600">{r.sem1.realisasi_id}</td>
                      <td className="py-1.5 pr-2 text-[#1E3A8A]">{r.matrix_id}</td>
                      <td className="py-1.5 pr-2 font-bold">1 (Jan-Jun)</td>
                      <td className="py-1.5 pr-2 text-right">{r.sem1.realisasi}</td>
                      <td className="py-1.5 font-sans">{r.sem1.status_verifikasi}</td>
                    </tr>,
                    <tr key={r.sem2.realisasi_id} className="bg-slate-50/60">
                      <td className="py-1.5 pr-2 text-slate-600">{r.sem2.realisasi_id}</td>
                      <td className="py-1.5 pr-2 text-[#1E3A8A]">{r.matrix_id}</td>
                      <td className="py-1.5 pr-2 font-bold">2 (Jul-Des)</td>
                      <td className="py-1.5 pr-2 text-right">{r.sem2.realisasi}</td>
                      <td className="py-1.5 font-sans">{r.sem2.status_verifikasi}</td>
                    </tr>,
                  ])}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
