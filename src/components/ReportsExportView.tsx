import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  FileSpreadsheet,
  Download,
  Building2,
  CalendarRange,
  TrendingUp,
  ShieldCheck,
  Table2,
} from 'lucide-react';
import {
  EnrichedMatrixRow,
  ExportType,
  OPD,
  PeriodePelaporan,
  UserRole,
} from '../types/oppkpke';
import { exportMatrixToExcel } from '../utils/excelService';
import { formatNumber, formatRupiah } from '../utils/formatters';
import { StatusIndicator } from './ui/StatusIndicator';

interface ReportsExportViewProps {
  rows: EnrichedMatrixRow[];
  allOpds: OPD[];
  activePeriode: PeriodePelaporan;
  userRole: UserRole;
  activeOpd: OPD;
  onShowToast: (type: 'success' | 'error', message: string) => void;
}

export const ReportsExportView: React.FC<ReportsExportViewProps> = ({
  rows,
  allOpds,
  activePeriode,
  userRole,
  activeOpd,
  onShowToast,
}) => {
  const [selectedOpdId, setSelectedOpdId] = useState<string>(
    userRole === 'OPD' ? activeOpd.opd_id : 'ALL'
  );
  const [activePreviewMode, setActivePreviewMode] = useState<ExportType>('all_matrix');

  const selectedOpdObj = useMemo(() => {
    if (selectedOpdId === 'ALL') return null;
    return allOpds.find((o) => o.opd_id === selectedOpdId) || null;
  }, [selectedOpdId, allOpds]);

  const previewRows = useMemo(() => {
    if (selectedOpdId === 'ALL') return rows;
    return rows.filter((r) => r.opd_id === selectedOpdId);
  }, [rows, selectedOpdId]);

  // Rekapitulasi per OPD untuk pratinjau laporan rekap tahunan
  const rekapTahunanOpd = useMemo(() => {
    const map = new Map<
      string,
      {
        nama_opd: string;
        singkatan: string;
        subCount: number;
        sasaran: number;
        alokasi: number;
        sem1: number;
        sem2: number;
        tahunan: number;
      }
    >();

    previewRows.forEach((r) => {
      const cur = map.get(r.opd_id) || {
        nama_opd: r.nama_opd,
        singkatan: r.singkatan_opd,
        subCount: 0,
        sasaran: 0,
        alokasi: 0,
        sem1: 0,
        sem2: 0,
        tahunan: 0,
      };
      cur.subCount += 1;
      cur.sasaran += r.jumlah_sasaran;
      cur.alokasi += r.alokasi_anggaran;
      cur.sem1 += r.sem1.realisasi;
      cur.sem2 += r.sem2.realisasi;
      cur.tahunan += r.total_realisasi_tahunan;
      map.set(r.opd_id, cur);
    });

    return Array.from(map.values());
  }, [previewRows]);

  const handleExport = (type: ExportType) => {
    const fileName = exportMatrixToExcel(
      type,
      previewRows,
      activePeriode.tahun,
      type === 'per_opd' ? selectedOpdObj : null
    );
    onShowToast('success', `Berhasil mengekspor file Excel: ${fileName}`);
  };

  const exportCards: {
    type: ExportType;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    buttonLabel: string;
  }[] = [
    {
      type: 'all_matrix',
      title: '1. Export Seluruh Data Matriks',
      subtitle:
        'Mempertahankan struktur dan urutan 19+ kolom matriks Excel asli beserta kolom Realisasi Semester 1 dan Realisasi Semester 2.',
      icon: <Table2 className="w-5 h-5 text-[#1E3A8A]" />,
      buttonLabel: 'Unduh Matriks Lengkap (.xlsx)',
    },
    {
      type: 'semester_1',
      title: '2. Export Realisasi Semester 1',
      subtitle:
        'Laporan khusus capaian realisasi periode Januari–Juni beserta status dan catatan verifikator Semester 1.',
      icon: <CalendarRange className="w-5 h-5 text-sky-600" />,
      buttonLabel: 'Unduh Laporan Semester 1 (.xlsx)',
    },
    {
      type: 'semester_2',
      title: '3. Export Realisasi Semester 2',
      subtitle:
        'Laporan khusus capaian realisasi periode Juli–Desember beserta pembanding Semester 1 dan status verifikasi Semester 2.',
      icon: <CalendarRange className="w-5 h-5 text-indigo-700" />,
      buttonLabel: 'Unduh Laporan Semester 2 (.xlsx)',
    },
    {
      type: 'rekap_tahunan',
      title: '4. Export Rekapitulasi Tahunan',
      subtitle:
        'Akumulasi realisasi tahunan (Semester 1 + Semester 2), persentase capaian anggaran, dan total sasaran per OPD.',
      icon: <TrendingUp className="w-5 h-5 text-emerald-700" />,
      buttonLabel: 'Unduh Rekapitulasi Tahunan (.xlsx)',
    },
    {
      type: 'status_verifikasi',
      title: '5. Export Status Verifikasi',
      subtitle:
        'Laporan matriks pengawasan status verifikasi independen Semester 1 dan Semester 2 beserta waktu & nama verifikator.',
      icon: <ShieldCheck className="w-5 h-5 text-amber-700" />,
      buttonLabel: 'Unduh Status Verifikasi (.xlsx)',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* Header Laporan & Export */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
        <div>
          <p className="text-xs font-medium text-sky-700 mb-1">
            Pusat Pelaporan & Ekspor Matriks Excel · {activePeriode.nama_periode}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Laporan & Export Excel OPTIMIS (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Seluruh hasil export sesuai dengan data aktual di database, mempertahankan urutan kolom matriks Excel asli dengan penambahan kolom Realisasi Semester 2.
          </p>
        </div>

        {/* Filter Cakupan OPD untuk Export */}
        {userRole === 'ADMIN' && (
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs font-semibold text-slate-700 whitespace-nowrap">
              Filter OPD:
            </label>
            <select
              value={selectedOpdId}
              onChange={(e) => setSelectedOpdId(e.target.value)}
              className="px-3.5 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1E3A8A]"
            >
              <option value="ALL">Seluruh OPD Kabupaten Blora ({allOpds.length} OPD)</option>
              {allOpds.map((opd) => (
                <option key={opd.opd_id} value={opd.opd_id}>
                  {opd.singkatan} — {opd.nama_opd}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* 6 Kartu Jenis Export Excel */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exportCards.map((card) => (
          <div
            key={card.type}
            onClick={() => setActivePreviewMode(card.type)}
            className={`bg-white rounded-xl border p-5 flex flex-col justify-between transition-all cursor-pointer ${
              activePreviewMode === card.type
                ? 'border-[#1E3A8A] shadow-[0_4px_16px_-4px_rgba(30,58,138,0.12)]'
                : 'border-slate-200/80 hover:border-slate-300 shadow-[0_2px_10px_-3px_rgba(15,23,42,0.04)]'
            }`}
          >
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/70 flex items-center justify-center">
                  {card.icon}
                </div>
                <span className="text-[11px] font-medium text-slate-400">
                  Format .XLSX Asli
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900">{card.title}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{card.subtitle}</p>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExport(card.type);
                }}
                className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-[#1E3A8A] hover:bg-slate-900 rounded-lg transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{card.buttonLabel}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Tabel Pratinjau Struktur Kolom Export */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-[0_2px_12px_-3px_rgba(15,23,42,0.05)] overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/60">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Pratinjau Data Laporan ({previewRows.length} Baris Sub Kegiatan)
            </h2>
            <p className="text-xs text-slate-500">
              Urutan kolom mempertahankan format matriks Excel asli dengan pemisahan Realisasi Semester 1 (Jan–Jun) dan Realisasi Semester 2 (Jul–Des)
            </p>
          </div>
          <button
            onClick={() => handleExport(activePreviewMode)}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors self-start sm:self-center whitespace-nowrap cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Download Excel Sesuai Pratinjau Ini</span>
          </button>
        </div>

        {activePreviewMode === 'rekap_tahunan' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Perangkat Daerah (OPD)</th>
                  <th className="py-3 px-4 text-right">Sub Kegiatan</th>
                  <th className="py-3 px-4 text-right">Total Sasaran</th>
                  <th className="py-3 px-4 text-right">Alokasi Anggaran (Rp)</th>
                  <th className="py-3 px-4 text-right">Realisasi Sem 1 (Jan–Jun)</th>
                  <th className="py-3 px-4 text-right">Realisasi Sem 2 (Jul–Des)</th>
                  <th className="py-3 px-4 text-right">Akumulasi Tahunan (Rp)</th>
                  <th className="py-3 px-4 text-right">% Capaian</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {rekapTahunanOpd.map((item, idx) => {
                  const pct = item.alokasi > 0 ? (item.tahunan / item.alokasi) * 100 : 0;
                  return (
                    <tr key={item.singkatan} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono-tabular text-slate-500">{idx + 1}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900">{item.singkatan}</span>
                        <span className="block text-[11px] text-slate-500">{item.nama_opd}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular">{item.subCount}</td>
                      <td className="py-3 px-4 text-right font-mono-tabular">
                        {formatNumber(item.sasaran)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-semibold">
                        {formatRupiah(item.alokasi)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-sky-800">
                        {formatRupiah(item.sem1)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular text-indigo-800">
                        {formatRupiah(item.sem2)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-700">
                        {formatRupiah(item.tahunan)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono-tabular font-bold">
                        {pct.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 whitespace-nowrap">
                  <th className="py-3 px-3">No</th>
                  <th className="py-3 px-3">Strategi OPPKPKE</th>
                  <th className="py-3 px-3">Perangkat Daerah</th>
                  <th className="py-3 px-3">Kode</th>
                  <th className="py-3 px-3">Program</th>
                  <th className="py-3 px-3">Kegiatan</th>
                  <th className="py-3 px-3">Sub Kegiatan</th>
                  <th className="py-3 px-3">Aktivitas Real Langsung</th>
                  <th className="py-3 px-3">Aktivitas Real Tidak Langsung</th>
                  <th className="py-3 px-3">Aktivitas Real Penunjang</th>
                  <th className="py-3 px-3 text-right">Alokasi Anggaran (Rp)</th>
                  <th className="py-3 px-3">Sumber Pembiayaan</th>
                  <th className="py-3 px-3">Sifat Bantuan</th>
                  <th className="py-3 px-3">Lokasi</th>
                  <th className="py-3 px-3 text-right">Jumlah Sasaran</th>
                  <th className="py-3 px-3">Besaran Manfaat</th>
                  <th className="py-3 px-3">Jenis Bantuan</th>
                  <th className="py-3 px-3">Durasi Pemberian</th>
                  <th className="py-3 px-3 text-right bg-sky-50/70 text-sky-900">
                    Realisasi Semester 1 (Januari–Juni)
                  </th>
                  <th className="py-3 px-3 text-right bg-indigo-50/70 text-indigo-900">
                    Realisasi Semester 2 (Juli–Desember)
                  </th>
                  <th className="py-3 px-3 text-right bg-emerald-50/70 text-emerald-900">
                    Total Tahunan (Rp)
                  </th>
                  <th className="py-3 px-3">Status Sem 1</th>
                  <th className="py-3 px-3">Status Sem 2</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {previewRows.map((r, i) => (
                  <tr key={r.matrix_id} className="hover:bg-slate-50/80 align-top">
                    <td className="py-3 px-3 font-mono-tabular text-slate-500">{i + 1}</td>
                    <td className="py-3 px-3 min-w-[180px]">{r.strategi}</td>
                    <td className="py-3 px-3 min-w-[180px] font-medium">{r.nama_opd}</td>
                    <td className="py-3 px-3 font-mono-tabular whitespace-nowrap">{r.kode}</td>
                    <td className="py-3 px-3 min-w-[200px]">{r.program}</td>
                    <td className="py-3 px-3 min-w-[200px]">{r.kegiatan}</td>
                    <td className="py-3 px-3 min-w-[220px] font-semibold text-slate-900">
                      {r.sub_kegiatan}
                    </td>
                    <td className="py-3 px-3 min-w-[220px] text-slate-600">
                      {r.aktivitas_real_langsung || '-'}
                    </td>
                    <td className="py-3 px-3 min-w-[200px] text-slate-600">
                      {r.aktivitas_real_tidak_langsung || '-'}
                    </td>
                    <td className="py-3 px-3 min-w-[200px] text-slate-600">
                      {r.aktivitas_real_penunjang || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap font-semibold">
                      {formatRupiah(r.alokasi_anggaran)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">{r.sumber_pembiayaan}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{r.sifat_bantuan || '-'}</td>
                    <td className="py-3 px-3 min-w-[200px]">{r.lokasi || '-'}</td>
                    <td className="py-3 px-3 text-right font-mono-tabular">
                      {formatNumber(r.jumlah_sasaran)}
                    </td>
                    <td className="py-3 px-3 min-w-[180px]">{r.besaran_manfaat || '-'}</td>
                    <td className="py-3 px-3 whitespace-nowrap">{r.jenis_bantuan || '-'}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {r.durasi_pemberian_bantuan || '-'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap bg-sky-50/30 font-semibold text-sky-900">
                      {formatRupiah(r.sem1.realisasi)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap bg-indigo-50/30 font-semibold text-indigo-900">
                      {formatRupiah(r.sem2.realisasi)}
                    </td>
                    <td className="py-3 px-3 text-right font-mono-tabular whitespace-nowrap bg-emerald-50/30 font-bold text-emerald-800">
                      {formatRupiah(r.total_realisasi_tahunan)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusIndicator status={r.sem1.status_verifikasi} />
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <StatusIndicator status={r.sem2.status_verifikasi} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
};
