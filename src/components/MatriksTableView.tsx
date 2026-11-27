import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Upload,
  Download,
  Edit3,
  Eye,
  FileSpreadsheet,
  Plus,
  X,
  Trash2,
  AlertTriangle,
  Lock,
  CheckCircle2,
  Table2,
  Info,
  ArrowUpDown,
  Building2,
  Sparkles,
  Wallet,
} from 'lucide-react';
import {
  EnrichedMatrixRow,
  OPD,
  PeriodePelaporan,
  UserRole,
} from '../types/oppkpke';
import { STRATEGI_OPPKPKE_LIST } from '../data/bloraSeedData';
import { formatNumber, formatRupiah } from '../utils/formatters';
import {
  downloadAdminImportTemplate,
  EXCEL_TEMPLATE_COLUMNS_SPEC,
  EXCEL_TEMPLATE_SAMPLE_ROWS,
  exportMatrixToExcel,
  parseExcelImportFile,
  ParsedExcelBaseRow,
} from '../utils/excelService';
import { StatusIndicator } from './ui/StatusIndicator';

interface MatriksTableViewProps {
  rows: EnrichedMatrixRow[];
  allOpds: OPD[];
  periodes?: PeriodePelaporan[];
  activePeriode: PeriodePelaporan;
  selectedSemester?: 1 | 2;
  userRole: UserRole;
  activeOpd: OPD;
  onChangePeriode?: (periodeId: string) => void;
  onChangeSemester?: (sem: 1 | 2) => void;
  onOpenInputModal: (row: EnrichedMatrixRow | null) => void;
  onDeleteMatrixRow?: (matrixId: string) => void;
  onImportExcelRows: (parsedRows: ParsedExcelBaseRow[]) => void;
  onShowToast: (type: 'success' | 'error', message: string) => void;
}

export const MatriksTableView: React.FC<MatriksTableViewProps> = ({
  rows,
  allOpds,
  activePeriode,
  selectedSemester = 1,
  userRole,
  activeOpd,
  onOpenInputModal,
  onDeleteMatrixRow,
  onImportExcelRows,
  onShowToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOpdFilter, setSelectedOpdFilter] = useState<string>('ALL');
  const [selectedStrategi, setSelectedStrategi] = useState<string>('ALL');
  const [selectedSemStatus, setSelectedSemStatus] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('opd_asc');
  const [detailModalRow, setDetailModalRow] = useState<EnrichedMatrixRow | null>(null);
  const [confirmDeleteRow, setConfirmDeleteRow] = useState<EnrichedMatrixRow | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [previewExcelRows, setPreviewExcelRows] = useState<ParsedExcelBaseRow[] | null>(
    null
  );
  const [uploadedFileName, setUploadedFileName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const filteredRows = useMemo(() => {
    const filtered = rows.filter((r) => {
      if (userRole === 'ADMIN' && selectedOpdFilter !== 'ALL' && r.opd_id !== selectedOpdFilter) {
        return false;
      }
      if (selectedStrategi !== 'ALL' && r.strategi !== selectedStrategi) {
        return false;
      }
      if (selectedSemStatus !== 'ALL') {
        const activeSemObj = selectedSemester === 1 ? r.sem1 : r.sem2;
        if (activeSemObj.status_verifikasi !== selectedSemStatus) return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          r.program.toLowerCase().includes(q) ||
          r.kegiatan.toLowerCase().includes(q) ||
          r.sub_kegiatan.toLowerCase().includes(q) ||
          r.kode.toLowerCase().includes(q) ||
          r.nama_opd.toLowerCase().includes(q) ||
          r.singkatan_opd.toLowerCase().includes(q) ||
          r.lokasi.toLowerCase().includes(q) ||
          r.jenis_bantuan.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    const getPaguAcuan = (r: EnrichedMatrixRow) =>
      (Number(r.alokasi_anggaran_perubahan) || 0) > 0
        ? Number(r.alokasi_anggaran_perubahan) || 0
        : Number(r.alokasi_anggaran) || 0;

    const getActiveRealisasi = (r: EnrichedMatrixRow) =>
      selectedSemester === 1
        ? Number(r.sem1.realisasi) || 0
        : (Number(r.sem1.realisasi) || 0) + (Number(r.sem2.realisasi) || 0);

    return [...filtered].sort((a, b) => {
      switch (sortBy) {
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
        case 'kelengkapan_desc':
          return (b.completion_percentage ?? 0) - (a.completion_percentage ?? 0);
        case 'kelengkapan_asc':
          return (a.completion_percentage ?? 0) - (b.completion_percentage ?? 0);
        default:
          return 0;
      }
    });
  }, [
    rows,
    userRole,
    selectedOpdFilter,
    selectedStrategi,
    selectedSemStatus,
    selectedSemester,
    searchQuery,
    sortBy,
  ]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsParsingExcel(true);
    try {
      const parsed = await parseExcelImportFile(file);
      if (parsed.length === 0) {
        onShowToast(
          'error',
          'File Excel tidak memiliki baris data program/kegiatan yang sesuai format template.'
        );
        setPreviewExcelRows(null);
        setUploadedFileName('');
      } else {
        setPreviewExcelRows(parsed);
        setUploadedFileName(file.name);
      }
    } catch (err) {
      console.error(err);
      onShowToast('error', 'Gagal membaca file Excel. Pastikan format .xlsx atau .xls sesuai template.');
      setPreviewExcelRows(null);
      setUploadedFileName('');
    } finally {
      setIsParsingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConfirmImport = () => {
    if (!previewExcelRows || previewExcelRows.length === 0) return;
    onImportExcelRows(previewExcelRows);
    setPreviewExcelRows(null);
    setUploadedFileName('');
    setShowImportModal(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Banner Header & Tombol Aksi */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-[#2563EB] mb-1">
            {activePeriode.nama_periode}
          </p>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 leading-snug">
            {userRole === 'ADMIN'
              ? 'Data Matriks Seluruh Perangkat Daerah (OPD)'
              : `Matriks OPD — ${activeOpd.nama_opd}`}
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            {userRole === 'ADMIN' ? (
              <>
                Rekapitulasi matriks program, kegiatan, dan sub kegiatan seluruh Perangkat Daerah. Gunakan fitur <strong>Import Excel</strong> sesuai template standar atau <strong>Ekspor (.xlsx)</strong>.
              </>
            ) : (
              <>
                Klik tombol <strong>+ Input Data Matriks</strong> atau <strong>Edit</strong> pada baris tabel untuk mengisi data matriks dan realisasi. Data yang sudah <strong>Terverifikasi</strong> otomatis terkunci.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0 self-start lg:self-center">
          {/* Tombol Input Data Matriks hanya ditampilkan untuk OPD (dihapus pada laman Admin) */}
          {userRole === 'OPD' && (
            <button
              type="button"
              onClick={() => onOpenInputModal(null)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] rounded-xl shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)] transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Input Data Matriks</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setPreviewExcelRows(null);
              setUploadedFileName('');
              setShowImportModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#2563EB] bg-blue-50 border border-blue-200/80 rounded-xl hover:bg-blue-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Upload className="w-4 h-4" />
            <span>Import Excel</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const fn = exportMatrixToExcel(
                userRole === 'OPD' ? 'per_opd' : 'all_matrix',
                filteredRows,
                activePeriode.tahun,
                userRole === 'OPD' ? activeOpd : null
              );
              onShowToast('success', `Berhasil mengunduh ${fn}`);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Ekspor (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Filter Bar & Pencarian */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.04)]">
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            userRole === 'ADMIN' ? 'lg:grid-cols-5' : 'lg:grid-cols-4'
          } gap-3 items-center`}
        >
          {/* Pencarian */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari kode rekening, subkegiatan, lokasi..."
              className="w-full h-10 pl-9 pr-3 text-xs text-slate-900 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white"
            />
          </div>

          {/* Filter OPD (Khusus Admin) */}
          {userRole === 'ADMIN' ? (
            <select
              value={selectedOpdFilter}
              onChange={(e) => setSelectedOpdFilter(e.target.value)}
              className="w-full h-10 px-3 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            >
              <option value="ALL">Semua Perangkat Daerah ({allOpds.length} OPD)</option>
              {allOpds.map((o) => (
                <option key={o.opd_id} value={o.opd_id}>
                  {o.singkatan} — {o.nama_opd}
                </option>
              ))}
            </select>
          ) : (
            <div
              className="w-full h-10 px-3.5 text-xs font-medium text-slate-700 bg-blue-50/50 border border-blue-200/60 rounded-xl flex items-center gap-1.5 truncate"
              title={activeOpd.nama_opd}
            >
              <span className="text-slate-500 shrink-0">Instansi:</span>
              <strong className="text-[#1D4ED8] truncate">{activeOpd.singkatan}</strong>
            </div>
          )}

          {/* Filter Strategi OPPKPKE */}
          <select
            value={selectedStrategi}
            onChange={(e) => setSelectedStrategi(e.target.value)}
            className="w-full h-10 px-3 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="ALL">Semua Strategi OPPKPKE (3 Strategi)</option>
            {STRATEGI_OPPKPKE_LIST.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Filter Status Verifikasi */}
          <select
            value={selectedSemStatus}
            onChange={(e) => setSelectedSemStatus(e.target.value)}
            className="w-full h-10 px-3 text-xs font-medium text-slate-700 bg-[#F8FAFF] border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
          >
            <option value="ALL">Semua Status Verifikasi Semester {selectedSemester}</option>
            <option value="Terverifikasi">Terverifikasi (Terkunci)</option>
            <option value="Menunggu Verifikasi">Menunggu Verifikasi</option>
            <option value="Perlu Perbaikan">Perlu Perbaikan</option>
            <option value="Draft">Draft</option>
            <option value="Belum Diisi">Belum Diisi</option>
          </select>

          {/* Fungsi Sort By (Khusus Laman Admin di Filter Bar Utama) */}
          {userRole === 'ADMIN' && (
            <div className="relative">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#2563EB] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                aria-label="Sort By Data Matriks"
                className="w-full h-10 pl-8 pr-3 text-xs font-semibold text-slate-800 bg-[#F8FAFF] border border-blue-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] cursor-pointer"
              >
                <option value="opd_asc">Sort By: Nama OPD (A – Z)</option>
                <option value="opd_desc">Sort By: Nama OPD (Z – A)</option>
                <option value="kode_asc">Sort By: Kode Rekening (Terkecil)</option>
                <option value="kode_desc">Sort By: Kode Rekening (Terbesar)</option>
                <option value="sub_kegiatan_asc">Sort By: Sub Kegiatan (A – Z)</option>
                <option value="sub_kegiatan_desc">Sort By: Sub Kegiatan (Z – A)</option>
                <option value="pagu_desc">Sort By: Alokasi Anggaran (Tertinggi)</option>
                <option value="pagu_asc">Sort By: Alokasi Anggaran (Terendah)</option>
                <option value="realisasi_desc">Sort By: Realisasi (Tertinggi)</option>
                <option value="realisasi_asc">Sort By: Realisasi (Terendah)</option>
                <option value="kelengkapan_desc">Sort By: Kelengkapan (100% – 0%)</option>
                <option value="kelengkapan_asc">Sort By: Kelengkapan (0% – 100%)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Tabel Matriks Modern */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFF]">
          <div className="text-xs font-semibold text-slate-700">
            Menampilkan <span className="font-mono-tabular text-[#2563EB]">{filteredRows.length}</span> Sub Kegiatan ·{' '}
            <span className="text-[#1D4ED8]">
              {selectedSemester === 1
                ? `TA ${activePeriode.tahun} — Semester 1 (Januari–Juni)`
                : `TA ${activePeriode.tahun} — Semester 1 & Semester 2`}
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Klik pada <strong className="text-slate-700">Nama OPD</strong> atau <strong className="text-[#2563EB]">Kode Rekening</strong> untuk membuka preview rincian lengkap matriks
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200/80 bg-[#F8FAFF] text-[11px] font-semibold text-slate-600">
                <th className="py-3.5 px-3 w-10 text-center">No</th>
                <th className="py-3.5 px-3.5 min-w-[140px]">OPD & Strategi OPPKPKE</th>
                <th className="py-3.5 px-3.5 min-w-[200px]">Kode Rekening, Program & Sub Kegiatan</th>
                <th className="py-3.5 px-3.5 min-w-[185px]">Karakteristik, Lokasi & Sasaran</th>
                <th className="py-3.5 px-3.5 text-right min-w-[130px]">Alokasi Anggaran</th>
                <th className="py-3.5 px-3.5 text-right min-w-[150px]">
                  Realisasi Semester 1 (Jan–Jun)
                </th>
                {selectedSemester === 2 && (
                  <th className="py-3.5 px-3.5 text-right min-w-[150px]">
                    Realisasi Semester 2 (Jul–Des)
                  </th>
                )}
                <th className="py-3.5 px-3.5 min-w-[165px]">Rincian Realisasi</th>
                <th className="py-3.5 px-3.5 text-center min-w-[115px]">Kelengkapan</th>
                <th className="py-3.5 px-3.5 text-center min-w-[100px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={selectedSemester === 2 ? 10 : 9}
                    className="py-12 text-center text-slate-500"
                  >
                    {userRole === 'ADMIN' ? (
                      <>Tidak ada baris matriks yang sesuai filter pencarian.</>
                    ) : (
                      <>
                        Tidak ada baris matriks yang sesuai. Klik tombol <strong>+ Input Data Matriks</strong> untuk menambahkan subkegiatan baru.
                      </>
                    )}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const activeSem = selectedSemester === 1 ? row.sem1 : row.sem2;
                  const isVerifiedLocked = activeSem.status_verifikasi === 'Terverifikasi';
                  const isAnySemVerified =
                    row.sem1.status_verifikasi === 'Terverifikasi' ||
                    row.sem2.status_verifikasi === 'Terverifikasi';

                  const sasaranDisplay =
                    row.keterangan_sasaran?.trim() ||
                    (row.jumlah_sasaran > 0
                      ? `${formatNumber(row.jumlah_sasaran)} ${row.satuan_sasaran || 'KPM'}`
                      : '-');

                  return (
                    <tr
                      key={row.matrix_id}
                      className="hover:bg-blue-50/30 transition-colors align-top"
                    >
                      <td className="py-4 px-3 text-center font-mono-tabular text-slate-400">
                        {index + 1}
                      </td>

                      {/* Kolom OPD & Strategi (Klik Nama OPD untuk membuka preview rincian lengkap matriks) */}
                      <td className="py-4 px-3.5">
                        <button
                          type="button"
                          onClick={() => setDetailModalRow(row)}
                          className="text-left group/opd cursor-pointer focus:outline-none block w-full"
                          title={`Klik Nama OPD (${row.nama_opd}) untuk membuka preview rincian lengkap matriks`}
                        >
                          <span className="inline-flex items-center gap-1 font-bold text-slate-900 group-hover/opd:text-[#2563EB] group-hover/opd:underline transition-colors">
                            <span>{row.singkatan_opd}</span>
                            <Eye className="w-3 h-3 opacity-0 group-hover/opd:opacity-100 text-[#2563EB] transition-opacity shrink-0" />
                          </span>
                          <span className="block text-[11px] text-slate-500 group-hover/opd:text-[#1D4ED8] line-clamp-1 mt-0.5 transition-colors">
                            {row.nama_opd}
                          </span>
                        </button>
                        <p className="text-[11px] text-[#2563EB] font-medium mt-1.5">
                          {row.strategi}
                        </p>
                      </td>

                      {/* Kolom Kode, Program, Kegiatan, Sub Kegiatan (Klik Kode Rekening untuk membuka preview rincian lengkap matriks) */}
                      <td className="py-4 px-3.5 space-y-1">
                        <div>
                          <button
                            type="button"
                            onClick={() => setDetailModalRow(row)}
                            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-[#2563EB] text-[#2563EB] hover:text-white border border-blue-200/80 hover:border-[#2563EB] font-mono-tabular text-[11px] font-bold transition-all cursor-pointer"
                            title={`Klik Kode Rekening (${row.kode}) untuk membuka preview rincian lengkap matriks`}
                          >
                            <span>{row.kode}</span>
                            <Eye className="w-3 h-3 shrink-0" />
                          </button>
                        </div>
                        <p className="font-bold text-slate-900 leading-snug">
                          {row.sub_kegiatan}
                        </p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          Program: {row.program}
                        </p>
                        <p className="text-[11px] text-slate-400 line-clamp-1">
                          Kegiatan: {row.kegiatan}
                        </p>
                      </td>

                      {/* Kolom Karakteristik, Lokasi & Sasaran */}
                      <td className="py-4 px-3.5 space-y-1 text-[11px] text-slate-600">
                        <p className="text-slate-900 font-semibold line-clamp-1">
                          {row.jenis_bantuan || '-'} · {row.sifat_bantuan || '-'}
                        </p>
                        <p className="line-clamp-1 text-slate-600" title={row.lokasi}>
                          Lokasi:{' '}
                          <strong className="text-slate-800">{row.lokasi || '-'}</strong>
                        </p>
                        <p className="line-clamp-2" title={sasaranDisplay}>
                          Sasaran:{' '}
                          <strong className="text-slate-800">{sasaranDisplay}</strong>
                          {row.besaran_manfaat ? ` (${row.besaran_manfaat})` : ''}
                        </p>
                        <p className="text-slate-500 line-clamp-1">
                          Durasi: {row.durasi_pemberian_bantuan || '-'}
                          {row.keterangan_durasi_bantuan
                            ? ` — ${row.keterangan_durasi_bantuan}`
                            : ''}
                        </p>
                      </td>

                      {/* Kolom Alokasi Anggaran */}
                      <td className="py-4 px-3.5 text-right font-mono-tabular">
                        <div className="font-bold text-slate-900">
                          {formatRupiah(row.alokasi_anggaran)}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {row.sumber_pembiayaan}
                        </div>
                        {(Number(row.alokasi_anggaran_perubahan) || 0) > 0 && (
                          <div className="mt-1.5 pt-1.5 border-t border-indigo-100 text-right">
                            <span className="inline-block text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200/70">
                              Perubahan: {formatRupiah(Number(row.alokasi_anggaran_perubahan) || 0)}
                            </span>
                            {row.sumber_pembiayaan_perubahan && (
                              <div className="text-[10.5px] text-indigo-600 mt-0.5">
                                {row.sumber_pembiayaan_perubahan}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Kolom Realisasi Semester 1 (Selalu tampil di Semester 1 maupun Semester 2) */}
                      <td className="py-4 px-3.5 text-right">
                        <div className="font-mono-tabular font-bold text-slate-900">
                          {formatRupiah(row.sem1.realisasi)}
                        </div>
                        <div className="text-[11px] font-mono-tabular text-slate-500 mt-0.5">
                          {row.persentase_realisasi_sem1.toFixed(1)}% dari Pagu (S1)
                        </div>
                        <div className="mt-1.5 flex justify-end">
                          <StatusIndicator status={row.sem1.status_verifikasi} />
                        </div>
                        {row.sem1.catatan_verifikator && (
                          <p
                            className="text-[10px] text-slate-500 italic mt-1 line-clamp-1"
                            title={row.sem1.catatan_verifikator}
                          >
                            Ket: {row.sem1.catatan_verifikator}
                          </p>
                        )}
                      </td>

                      {/* Kolom Realisasi Semester 2 (Tampil jika pilihan awal Semester 2) */}
                      {selectedSemester === 2 && (
                        <td className="py-4 px-3.5 text-right">
                          <div className="font-mono-tabular font-bold text-slate-900">
                            {formatRupiah(row.sem2.realisasi)}
                          </div>
                          <div className="text-[11px] font-mono-tabular text-indigo-600 mt-0.5">
                            {row.persentase_realisasi_sem2.toFixed(1)}% dari Pagu (S2)
                          </div>
                          <div className="mt-1.5 flex justify-end">
                            <StatusIndicator status={row.sem2.status_verifikasi} />
                          </div>
                          {row.sem2.catatan_verifikator && (
                            <p
                              className="text-[10px] text-slate-500 italic mt-1 line-clamp-1"
                              title={row.sem2.catatan_verifikator}
                            >
                              Ket: {row.sem2.catatan_verifikator}
                            </p>
                          )}
                        </td>
                      )}

                      {/* Kolom Rincian Realisasi */}
                      <td className="py-4 px-3.5 text-[11px] text-slate-600 space-y-1.5">
                        <div>
                          {selectedSemester === 2 && (
                            <span className="font-semibold text-[#2563EB] block text-[10px]">
                              Semester 1:
                            </span>
                          )}
                          <p
                            className="line-clamp-2 text-slate-700 leading-relaxed"
                            title={row.sem1.rincian_realisasi || '-'}
                          >
                            {row.sem1.rincian_realisasi?.trim() || (
                              <span className="text-slate-400 italic">Belum ada rincian</span>
                            )}
                          </p>
                        </div>
                        {selectedSemester === 2 && (
                          <div className="pt-1 border-t border-slate-100">
                            <span className="font-semibold text-indigo-600 block text-[10px]">
                              Semester 2:
                            </span>
                            <p
                              className="line-clamp-2 text-slate-700 leading-relaxed"
                              title={row.sem2.rincian_realisasi || '-'}
                            >
                              {row.sem2.rincian_realisasi?.trim() || (
                                <span className="text-slate-400 italic">Belum ada rincian</span>
                              )}
                            </p>
                          </div>
                        )}
                      </td>

                      {/* Kolom Kelengkapan Matriks (Progress Bar) */}
                      <td className="py-4 px-3.5 text-center">
                        <div className="flex flex-col items-center gap-1.5 min-w-[110px]">
                          <div className="flex items-center justify-between w-full text-[11px]">
                            <span className="font-semibold font-mono-tabular text-slate-800">
                              {row.completion_percentage ?? 0}%
                            </span>
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                row.completion_percentage === 100
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : (row.completion_percentage ?? 0) >= 60
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}
                            >
                              {row.completion_percentage === 100
                                ? 'Lengkap'
                                : (row.completion_percentage ?? 0) >= 60
                                ? 'Proses'
                                : 'Belum'}
                            </span>
                          </div>
                          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/70">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                row.completion_percentage === 100
                                  ? 'bg-emerald-500'
                                  : (row.completion_percentage ?? 0) >= 60
                                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.max(5, row.completion_percentage ?? 0)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Kolom Aksi */}
                      <td className="py-4 px-3.5 text-center">
                        {userRole === 'ADMIN' ? (
                          /* Pada laman Admin: Aksi Edit dan Hapus dihapus, hanya menampilkan tombol Rincian */
                          <button
                            type="button"
                            onClick={() => setDetailModalRow(row)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                            title="Lihat Rincian Matriks"
                          >
                            <Eye className="w-3.5 h-3.5 text-[#2563EB]" />
                            <span>Rincian</span>
                          </button>
                        ) : (
                          /* Pada laman OPD: Jika status Terverifikasi, otomatis terkunci (tidak bisa mengubah/menghapus data) */
                          <div className="flex flex-col gap-1.5">
                            {isVerifiedLocked ? (
                              <div
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl whitespace-nowrap cursor-not-allowed"
                                title="Data semester ini telah Terverifikasi oleh Admin Bapperida dan terkunci otomatis"
                              >
                                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Terkunci</span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenInputModal(row)}
                                className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] rounded-xl hover:from-[#1D4ED8] hover:to-[#1E40AF] shadow-xs transition-all whitespace-nowrap cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>{selectedSemester === 2 ? 'Isi smt 2' : 'Edit'}</span>
                              </button>
                            )}
                            <div className="grid grid-cols-2 gap-1.5">
                              <button
                                type="button"
                                onClick={() => setDetailModalRow(row)}
                                className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors whitespace-nowrap cursor-pointer"
                                title="Lihat Rincian"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Rincian</span>
                              </button>
                              <button
                                type="button"
                                disabled={isAnySemVerified}
                                onClick={() => {
                                  if (!isAnySemVerified) {
                                    setConfirmDeleteRow(row);
                                  }
                                }}
                                className={`inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold rounded-xl transition-colors whitespace-nowrap ${
                                  isAnySemVerified
                                    ? 'text-slate-400 bg-slate-100 border border-slate-200 cursor-not-allowed'
                                    : 'text-rose-600 bg-rose-50 border border-rose-200/70 hover:bg-rose-100 cursor-pointer'
                                }`}
                                title={
                                  isAnySemVerified
                                    ? 'Data yang sudah Terverifikasi terkunci dan tidak dapat dihapus'
                                    : 'Hapus Baris Matriks'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Preview Rincian Lengkap 1 Baris Matriks */}
      <AnimatePresence>
        {detailModalRow && (() => {
          const paguMurni = Number(detailModalRow.alokasi_anggaran) || 0;
          const paguPerubahan = Number(detailModalRow.alokasi_anggaran_perubahan) || 0;
          const hasAnggaranPerubahan = paguPerubahan > 0;
          const paguAcuan = hasAnggaranPerubahan ? paguPerubahan : paguMurni;
          const realisasiS1 = Number(detailModalRow.sem1.realisasi) || 0;
          const realisasiS2 = Number(detailModalRow.sem2.realisasi) || 0;
          const realisasiFinal = realisasiS1 + realisasiS2;
          const sisaPagu = paguAcuan - realisasiFinal;
          const persenFinal = paguAcuan > 0 ? (realisasiFinal / paguAcuan) * 100 : 0;

          const hasKarakteristikSem2 = Boolean(
            detailModalRow.lokasi_sem2?.trim() ||
              detailModalRow.keterangan_sasaran_sem2?.trim() ||
              detailModalRow.besaran_manfaat_sem2?.trim() ||
              detailModalRow.jenis_bantuan_sem2?.trim() ||
              detailModalRow.durasi_pemberian_bantuan_sem2?.trim()
          );

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailModalRow(null)}
              className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            >
              <motion.div
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.96, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl"
              >
                {/* Header Preview Rincian Lengkap */}
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200/80">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] border border-blue-200 font-mono-tabular font-bold text-xs">
                        {detailModalRow.kode || '-'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs">
                        <Building2 className="w-3.5 h-3.5 text-[#2563EB]" />
                        <span>
                          {detailModalRow.singkatan_opd} — {detailModalRow.nama_opd}
                        </span>
                      </span>
                      <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold">
                        TA {activePeriode.tahun}
                      </span>
                    </div>
                    <h3 className="text-base sm:text-lg font-extrabold text-slate-900 leading-snug">
                      {detailModalRow.sub_kegiatan}
                    </h3>
                    <div className="text-xs text-slate-600 space-y-0.5 pt-0.5">
                      <p>
                        <strong className="text-slate-800">Strategi OPPKPKE:</strong>{' '}
                        <span className="text-[#2563EB] font-semibold">{detailModalRow.strategi}</span>
                      </p>
                      <p>
                        <strong className="text-slate-800">Program:</strong> {detailModalRow.program || '-'}
                      </p>
                      <p>
                        <strong className="text-slate-800">Kegiatan:</strong> {detailModalRow.kegiatan || '-'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailModalRow(null)}
                    className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Progress Bar Kelengkapan Pengisian */}
                <div className="p-3.5 bg-[#F8FAFF] rounded-2xl border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">Tingkat Kelengkapan Matriks:</span>
                    <span className="font-mono-tabular font-bold text-[#2563EB]">
                      {detailModalRow.completion_percentage ?? 0}%
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        detailModalRow.completion_percentage === 100
                          ? 'bg-emerald-100 text-emerald-800'
                          : (detailModalRow.completion_percentage ?? 0) >= 60
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {detailModalRow.completion_percentage === 100
                        ? 'Lengkap (100%)'
                        : (detailModalRow.completion_percentage ?? 0) >= 60
                        ? 'Dalam Pengisian'
                        : 'Belum Lengkap'}
                    </span>
                  </div>
                  <div className="w-36 sm:w-48 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        detailModalRow.completion_percentage === 100
                          ? 'bg-emerald-500'
                          : 'bg-blue-600'
                      }`}
                      style={{ width: `${Math.max(5, detailModalRow.completion_percentage ?? 0)}%` }}
                    />
                  </div>
                </div>

                {/* Bagian 1: Aktivitas Real Langsung, Tidak Langsung & Penunjang */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    1. Rincian Aktivitas Real (Langsung, Tidak Langsung & Penunjang)
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 text-xs">
                    <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/80 space-y-2">
                      <div>
                        <p className="font-bold text-slate-800 mb-1">
                          Aktivitas Real Langsung (Semester 1)
                        </p>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                          {detailModalRow.aktivitas_real_langsung || '-'}
                        </p>
                      </div>
                      {detailModalRow.aktivitas_real_langsung_sem2?.trim() && (
                        <div className="pt-2 border-t border-indigo-100">
                          <p className="font-bold text-indigo-800 mb-1">
                            Aktivitas Real Langsung (Semester 2)
                          </p>
                          <p className="text-indigo-950 leading-relaxed whitespace-pre-line">
                            {detailModalRow.aktivitas_real_langsung_sem2}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/80 space-y-2">
                      <div>
                        <p className="font-bold text-slate-800 mb-1">
                          Aktivitas Real Tidak Langsung (Semester 1)
                        </p>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                          {detailModalRow.aktivitas_real_tidak_langsung || '-'}
                        </p>
                      </div>
                      {detailModalRow.aktivitas_real_tidak_langsung_sem2?.trim() && (
                        <div className="pt-2 border-t border-indigo-100">
                          <p className="font-bold text-indigo-800 mb-1">
                            Aktivitas Real Tidak Langsung (Semester 2)
                          </p>
                          <p className="text-indigo-950 leading-relaxed whitespace-pre-line">
                            {detailModalRow.aktivitas_real_tidak_langsung_sem2}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-2xl bg-[#F8FAFF] border border-slate-200/80 space-y-2">
                      <div>
                        <p className="font-bold text-slate-800 mb-1">
                          Aktivitas Real Penunjang (Semester 1)
                        </p>
                        <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                          {detailModalRow.aktivitas_real_penunjang || '-'}
                        </p>
                      </div>
                      {detailModalRow.aktivitas_real_penunjang_sem2?.trim() && (
                        <div className="pt-2 border-t border-indigo-100">
                          <p className="font-bold text-indigo-800 mb-1">
                            Aktivitas Real Penunjang (Semester 2)
                          </p>
                          <p className="text-indigo-950 leading-relaxed whitespace-pre-line">
                            {detailModalRow.aktivitas_real_penunjang_sem2}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bagian 2: Alokasi Anggaran & Karakteristik Sasaran */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    2. Alokasi Anggaran, Sumber Pendanaan & Karakteristik Sasaran
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 block">Alokasi Anggaran Murni (Sem 1)</span>
                      <strong className="font-mono-tabular text-slate-900 text-sm">
                        {formatRupiah(detailModalRow.alokasi_anggaran)}
                      </strong>
                      {hasAnggaranPerubahan && (
                        <div className="mt-2 pt-2 border-t border-indigo-100">
                          <span className="text-[11px] font-semibold text-indigo-700 block">
                            Alokasi Anggaran Perubahan (Sem 2):
                          </span>
                          <strong className="font-mono-tabular text-indigo-900 text-sm">
                            {formatRupiah(paguPerubahan)}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 block">Sumber Pembiayaan Murni (Sem 1)</span>
                      <strong className="text-slate-900">{detailModalRow.sumber_pembiayaan || '-'}</strong>
                      {hasAnggaranPerubahan && detailModalRow.sumber_pembiayaan_perubahan && (
                        <div className="mt-2 pt-2 border-t border-indigo-100">
                          <span className="text-[11px] font-semibold text-indigo-700 block">
                            Sumber Pembiayaan Perubahan (Sem 2):
                          </span>
                          <strong className="text-indigo-900">
                            {detailModalRow.sumber_pembiayaan_perubahan}
                          </strong>
                        </div>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 block">Sifat & Lokasi Kegiatan</span>
                      <strong className="text-slate-900 block">
                        {detailModalRow.sifat_bantuan || '-'}
                      </strong>
                      <span className="text-[11px] text-slate-600 mt-0.5 block">
                        Lokasi: {detailModalRow.lokasi || '-'}
                      </span>
                      {hasKarakteristikSem2 && detailModalRow.lokasi_sem2 && (
                        <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                          Sem 2: {detailModalRow.sifat_bantuan_sem2 || detailModalRow.sifat_bantuan} ·{' '}
                          {detailModalRow.lokasi_sem2}
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white sm:col-span-2 md:col-span-1">
                      <span className="text-slate-500 block">Target & Rincian Sasaran</span>
                      <strong className="text-slate-900 block leading-relaxed">
                        {detailModalRow.keterangan_sasaran?.trim() ||
                          `${formatNumber(detailModalRow.jumlah_sasaran)} ${
                            detailModalRow.satuan_sasaran || 'KPM'
                          }`}
                      </strong>
                      {hasKarakteristikSem2 && detailModalRow.keterangan_sasaran_sem2?.trim() && (
                        <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                          Sasaran Sem 2: {detailModalRow.keterangan_sasaran_sem2}
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 block">Besaran Manfaat</span>
                      <strong className="text-slate-900">{detailModalRow.besaran_manfaat || '-'}</strong>
                      {hasKarakteristikSem2 && detailModalRow.besaran_manfaat_sem2?.trim() && (
                        <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                          Sem 2: {detailModalRow.besaran_manfaat_sem2}
                        </span>
                      )}
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                      <span className="text-slate-500 block">Jenis & Durasi Bantuan</span>
                      <strong className="text-slate-900 block">
                        {detailModalRow.jenis_bantuan} ({detailModalRow.durasi_pemberian_bantuan})
                      </strong>
                      {detailModalRow.keterangan_durasi_bantuan && (
                        <span className="text-[11px] text-slate-600 mt-0.5 block">
                          Ket. Durasi: {detailModalRow.keterangan_durasi_bantuan}
                        </span>
                      )}
                      {hasKarakteristikSem2 &&
                        (detailModalRow.jenis_bantuan_sem2 ||
                          detailModalRow.durasi_pemberian_bantuan_sem2) && (
                          <span className="text-[11px] text-indigo-700 font-semibold mt-1 block">
                            Sem 2: {detailModalRow.jenis_bantuan_sem2 || detailModalRow.jenis_bantuan} (
                            {detailModalRow.durasi_pemberian_bantuan_sem2 ||
                              detailModalRow.durasi_pemberian_bantuan}
                            )
                          </span>
                        )}
                    </div>
                  </div>
                </div>

                {/* Bagian 3: Realisasi Semester 1 & Semester 2 */}
                <div className="space-y-2">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-500">
                    3. Realisasi Anggaran Semester 1, Semester 2, Realisasi Final & Sisa Pagu
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    {/* Kartu Realisasi Semester 1 */}
                    <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-blue-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          Realisasi Semester 1 (Jan–Jun {activePeriode.tahun}):{' '}
                          <span className="font-mono-tabular text-[#1D4ED8]">
                            {formatRupiah(realisasiS1)} (
                            {detailModalRow.persentase_realisasi_sem1.toFixed(1)}%)
                          </span>
                        </span>
                        <StatusIndicator status={detailModalRow.sem1.status_verifikasi} />
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-slate-600">
                        <strong className="text-slate-800 block mb-0.5">
                          Rincian Realisasi Semester 1:
                        </strong>
                        {detailModalRow.sem1.rincian_realisasi?.trim() || '-'}
                      </div>
                      {detailModalRow.sem1.catatan_verifikator && (
                        <p className="text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80">
                          <strong className="text-amber-900">Catatan Verifikator S1:</strong>{' '}
                          {detailModalRow.sem1.catatan_verifikator}
                        </p>
                      )}
                    </div>

                    {/* Kartu Realisasi Semester 2 */}
                    <div className="p-4 rounded-2xl bg-[#F8FAFF] border border-indigo-100 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          Realisasi Semester 2 (Jul–Des {activePeriode.tahun}):{' '}
                          <span className="font-mono-tabular text-indigo-700">
                            {formatRupiah(realisasiS2)} (
                            {detailModalRow.persentase_realisasi_sem2.toFixed(1)}%)
                          </span>
                        </span>
                        <StatusIndicator status={detailModalRow.sem2.status_verifikasi} />
                      </div>
                      <div className="bg-white p-2.5 rounded-xl border border-slate-200/80 text-slate-600">
                        <strong className="text-slate-800 block mb-0.5">
                          Rincian Realisasi Semester 2:
                        </strong>
                        {detailModalRow.sem2.rincian_realisasi?.trim() || '-'}
                      </div>
                      {detailModalRow.sem2.catatan_verifikator && (
                        <p className="text-slate-600 bg-amber-50/70 p-2.5 rounded-xl border border-amber-200/80">
                          <strong className="text-amber-900">Catatan Verifikator S2:</strong>{' '}
                          {detailModalRow.sem2.catatan_verifikator}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Ringkasan Realisasi Final (Sem 1 + Sem 2) & Sisa Pagu Anggaran */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/90">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        Alokasi Pagu Acuan ({hasAnggaranPerubahan ? 'Perubahan' : 'Murni'})
                      </span>
                      <p className="text-sm font-mono-tabular font-extrabold text-slate-900 mt-1">
                        {formatRupiah(paguAcuan)}
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200">
                      <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-700">
                        <Sparkles className="w-3 h-3" />
                        <span>Realisasi Final (Sem 1 + Sem 2)</span>
                      </span>
                      <p className="text-sm font-mono-tabular font-extrabold text-indigo-900 mt-1">
                        {formatRupiah(realisasiFinal)}{' '}
                        <span className="text-xs font-semibold text-indigo-700">
                          ({persenFinal.toFixed(1)}%)
                        </span>
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
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setDetailModalRow(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    Tutup Preview
                  </button>
                  {userRole === 'OPD' && (
                    (selectedSemester === 1
                      ? detailModalRow.sem1.status_verifikasi
                      : detailModalRow.sem2.status_verifikasi) === 'Terverifikasi' ? (
                      <div className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl">
                        <Lock className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Data Terverifikasi & Terkunci</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          const target = detailModalRow;
                          setDetailModalRow(null);
                          onOpenInputModal(target);
                        }}
                        className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] cursor-pointer"
                      >
                        {selectedSemester === 2 ? 'Isi smt 2' : 'Edit di Popout Matriks'}
                      </button>
                    )
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Modal Import Data Excel dengan Format & Template Standar agar Tidak Berantakan */}
      <AnimatePresence>
        {showImportModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-4xl w-full max-h-[92vh] overflow-y-auto p-6 space-y-5 shadow-2xl"
            >
              {/* Header Modal Import */}
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-blue-50 border border-blue-200 text-[#2563EB] flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900">
                      Import Data Matriks dari File Excel (.xlsx / .xls)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Gunakan format & template standar di bawah ini agar struktur kolom rapi, seragam, dan tidak berantakan saat diimpor ke <strong>{activePeriode.nama_periode}</strong>.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Box 1: Unduh Template Standar & Aturan Format Kolom */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#EEF4FF] to-[#F8FAFF] border border-blue-200/80 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#1D4ED8]">
                      <Table2 className="w-4 h-4" />
                      <span>Langkah 1: Unduh & Gunakan Template Standar Excel OPTIMIS</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Template sudah dilengkapi <strong>Header Baku (7 Kolom Utama)</strong>, <strong>Contoh Pengisian</strong>, serta <strong>Sheet Panduan Format</strong> agar data tidak kocar-kacir.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadAdminImportTemplate()}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Unduh Template Excel (.xlsx)</span>
                  </button>
                </div>

                {/* Tabel Spesifikasi Format & Urutan Kolom */}
                <div className="bg-white rounded-xl border border-slate-200/90 overflow-hidden">
                  <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between text-[11px] font-semibold text-slate-700">
                    <span>Format & Urutan Baku Kolom Excel (Baris Pertama / Header)</span>
                    <span className="text-[#2563EB]">Wajib Sesuai Urutan</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/60 text-slate-500 font-semibold">
                          <th className="py-2 px-3 w-10 text-center">Kolom</th>
                          <th className="py-2 px-3 min-w-[150px]">Nama Header Excel</th>
                          <th className="py-2 px-3 min-w-[190px]">Ketentuan Format</th>
                          <th className="py-2 px-3 min-w-[230px]">Contoh Pengisian Benar</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {EXCEL_TEMPLATE_COLUMNS_SPEC.map((col) => (
                          <tr key={col.no} className="hover:bg-blue-50/20">
                            <td className="py-2 px-3 text-center font-mono-tabular font-bold text-slate-500">
                              {col.no}
                            </td>
                            <td className="py-2 px-3 font-bold text-slate-900">
                              {col.header}
                              <span className="ml-1 text-rose-500">*</span>
                            </td>
                            <td className="py-2 px-3 text-slate-600">{col.format}</td>
                            <td className="py-2 px-3 font-mono-tabular text-slate-700 bg-slate-50/50">
                              {col.contoh}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Catatan Penting Anti-Berantakan */}
                <div className="flex items-start gap-2 text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-xl border border-blue-100">
                  <Info className="w-4 h-4 text-[#2563EB] shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-800">Ketentuan Agar Data Tidak Berantakan:</strong>{' '}
                    Jangan menggabungkan sel (<em>Merge Cells</em>) pada baris judul, gunakan format Kode Rekening 12 digit dengan titik (contoh: <code className="font-mono font-bold text-[#1D4ED8]">2.19.02.2.01.0011</code>), dan tulis Alokasi Anggaran menggunakan angka murni tanpa titik/Rp (contoh: <code className="font-mono font-bold text-slate-800">1250000000</code>).
                  </div>
                </div>
              </div>

              {/* Box 2: Area Unggah File Excel */}
              <div className="border-2 border-dashed border-blue-200 rounded-2xl p-5 text-center space-y-2.5 hover:border-[#2563EB] transition-colors bg-blue-50/20">
                <Upload className="w-7 h-7 text-[#2563EB] mx-auto" />
                <div className="text-xs text-slate-700">
                  <strong>Langkah 2:</strong> Pilih file Excel (.xlsx / .xls) yang sudah diisi sesuai template untuk diperiksa sebelum disimpan ke{' '}
                  <strong>{activePeriode.nama_periode}</strong>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isParsingExcel}
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#2563EB] rounded-xl hover:bg-[#1D4ED8] transition-colors cursor-pointer"
                  >
                    {isParsingExcel
                      ? 'Memproses & Memvalidasi File Excel...'
                      : uploadedFileName
                      ? `Ganti File Excel (${uploadedFileName})`
                      : 'Pilih File Excel (.xlsx)'}
                  </button>
                </div>
              </div>

              {/* Box 3: Pratinjau Hasil Baca File Excel (Jika sudah memilih file) atau Contoh Baris Template */}
              {previewExcelRows && previewExcelRows.length > 0 ? (
                <div className="space-y-3 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>
                        Pratinjau Data Valid ({previewExcelRows.length} Baris Siap Diimpor dari &ldquo;{uploadedFileName}&rdquo;)
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      Format Sesuai Standar
                    </span>
                  </div>

                  <div className="bg-white rounded-xl border border-emerald-200/80 overflow-x-auto max-h-52">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                          <th className="py-2 px-3 w-8 text-center">No</th>
                          <th className="py-2 px-3">Strategi OPPKPKE</th>
                          <th className="py-2 px-3">Perangkat Daerah</th>
                          <th className="py-2 px-3">Kode</th>
                          <th className="py-2 px-3">Program & Kegiatan</th>
                          <th className="py-2 px-3">Sub Kegiatan</th>
                          <th className="py-2 px-3 text-right">Alokasi (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {previewExcelRows.slice(0, 10).map((r, i) => (
                          <tr key={i} className="hover:bg-slate-50">
                            <td className="py-2 px-3 text-center font-mono-tabular text-slate-400">
                              {i + 1}
                            </td>
                            <td className="py-2 px-3 text-slate-700 max-w-[150px] truncate">
                              {r.strategi}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 max-w-[160px] truncate">
                              {r.perangkat_daerah}
                            </td>
                            <td className="py-2 px-3 font-mono-tabular text-[#2563EB] font-semibold whitespace-nowrap">
                              {r.kode}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-[180px] truncate">
                              {r.program} — {r.kegiatan}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-900 max-w-[200px] truncate">
                              {r.sub_kegiatan}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tabular font-bold text-slate-900 whitespace-nowrap">
                              {formatRupiah(r.alokasi_anggaran)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-700">
                    Contoh Isi Tabel pada Template Excel Standar:
                  </p>
                  <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-100/80 text-slate-600 font-semibold">
                          <th className="py-2 px-3">Strategi OPPKPKE</th>
                          <th className="py-2 px-3">Perangkat Daerah</th>
                          <th className="py-2 px-3">Kode</th>
                          <th className="py-2 px-3">Program</th>
                          <th className="py-2 px-3">Sub Kegiatan</th>
                          <th className="py-2 px-3 text-right">Alokasi Anggaran (Rp)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60">
                        {EXCEL_TEMPLATE_SAMPLE_ROWS.slice(0, 2).map((s, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 text-slate-600 max-w-[150px] truncate">
                              {s['Strategi OPPKPKE']}
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-medium max-w-[160px] truncate">
                              {s['Perangkat Daerah']}
                            </td>
                            <td className="py-2 px-3 font-mono-tabular font-semibold text-[#2563EB]">
                              {s.Kode}
                            </td>
                            <td className="py-2 px-3 text-slate-600 max-w-[160px] truncate">
                              {s.Program}
                            </td>
                            <td className="py-2 px-3 text-slate-800 font-medium max-w-[180px] truncate">
                              {s['Sub Kegiatan']}
                            </td>
                            <td className="py-2 px-3 text-right font-mono-tabular font-semibold text-slate-800">
                              {s['Alokasi Anggaran (Rp)']}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Footer Modal Import */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                {previewExcelRows && previewExcelRows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleConfirmImport}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Simpan & Import {previewExcelRows.length} Baris ke Matriks</span>
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Penghapusan Baris Matriks */}
      <AnimatePresence>
        {confirmDeleteRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/45 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 10 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 space-y-4 shadow-2xl"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900">
                    Konfirmasi Hapus Data Matriks
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Apakah Anda yakin ingin menghapus baris subkegiatan ini beserta data realisasinya? Tindakan ini tidak dapat dibatalkan.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-xs">
                <p className="font-mono-tabular font-semibold text-[#2563EB]">
                  {confirmDeleteRow.kode} · {confirmDeleteRow.singkatan_opd}
                </p>
                <p className="font-bold text-slate-900 leading-snug">
                  {confirmDeleteRow.sub_kegiatan}
                </p>
                <p className="text-[11px] text-slate-500">
                  Pagu Alokasi: <strong className="text-slate-800">{formatRupiah(confirmDeleteRow.alokasi_anggaran)}</strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteRow(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onDeleteMatrixRow) {
                      onDeleteMatrixRow(confirmDeleteRow.matrix_id);
                    }
                    setConfirmDeleteRow(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus Data</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

