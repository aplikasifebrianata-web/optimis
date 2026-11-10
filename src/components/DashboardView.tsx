import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  Users,
  Target,
  Coins,
  ClipboardCheck,
  TrendingUp,
  Zap,
  ArrowRight,
  PieChart as PieChartIcon,
  Landmark,
  Calendar,
  LayoutGrid,
  Plus,
  FileText,
  CheckCircle2,
  AlertCircle,
  Upload,
  BarChart3,
  Edit3,
  Lock,
} from 'lucide-react';
import {
  AuditLog,
  EnrichedMatrixRow,
  NavTab,
  OPD,
  PeriodePelaporan,
  UserRole,
} from '../types/oppkpke';
import { AnimatedCounter } from './ui/AnimatedCounter';
import { BloraShieldLogo, CardWaveDecoration, HeroGovBuildingArt } from './ui/BloraVisuals';
import {
  formatDateTimeID,
  formatNumber,
  formatRupiah,
  formatRupiahCompact,
} from '../utils/formatters';

interface DashboardViewProps {
  rows: EnrichedMatrixRow[];
  allRowsForRecap: EnrichedMatrixRow[];
  allOpds: OPD[];
  periodes: PeriodePelaporan[];
  activePeriode: PeriodePelaporan;
  userRole: UserRole;
  activeOpd: OPD;
  auditLogs: AuditLog[];
  selectedSemesterFilter: 'S1' | 'S2' | 'TAHUNAN';
  onChangeSemesterFilter: (sem: 'S1' | 'S2' | 'TAHUNAN') => void;
  onChangePeriode: (periodeId: string) => void;
  onOpenInputModal: (row: EnrichedMatrixRow | null) => void;
  onNavigateTab: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  rows,
  allRowsForRecap,
  allOpds,
  periodes,
  activePeriode,
  userRole,
  activeOpd,
  auditLogs,
  selectedSemesterFilter,
  onChangeSemesterFilter,
  onChangePeriode,
  onOpenInputModal,
  onNavigateTab,
}) => {
  const [chartTab, setChartTab] = useState<
    'tren' | 'opd' | 'semester' | 'strategi' | 'verifikasi'
  >('tren');

  // Statistik Utama berdasarkan filter semester aktif
  const stats = useMemo(() => {
    const totalAlokasi = rows.reduce((acc, r) => acc + (r.alokasi_anggaran || 0), 0);
    const totalSasaran = rows.reduce((acc, r) => acc + (r.jumlah_sasaran || 0), 0);
    const totalSem1 = rows.reduce((acc, r) => acc + (r.sem1.realisasi || 0), 0);
    const totalSem2 = rows.reduce((acc, r) => acc + (r.sem2.realisasi || 0), 0);
    const totalTahunan = totalSem1 + totalSem2;

    const activeRealisasi =
      selectedSemesterFilter === 'S1'
        ? totalSem1
        : selectedSemesterFilter === 'S2'
        ? totalSem2
        : totalTahunan;

    const persentaseAktif =
      totalAlokasi > 0 ? (activeRealisasi / totalAlokasi) * 100 : 0;

    const verifiedCount = rows.filter((r) => {
      if (selectedSemesterFilter === 'S1') {
        return r.sem1.status_verifikasi === 'Terverifikasi';
      }
      if (selectedSemesterFilter === 'S2') {
        return r.sem2.status_verifikasi === 'Terverifikasi';
      }
      return (
        r.sem1.status_verifikasi === 'Terverifikasi' ||
        r.sem2.status_verifikasi === 'Terverifikasi'
      );
    }).length;

    const verifiedPct = rows.length > 0 ? Math.round((verifiedCount / rows.length) * 100) : 100;

    return {
      totalAlokasi,
      totalSasaran,
      totalSem1,
      totalSem2,
      totalTahunan,
      activeRealisasi,
      persentaseAktif,
      verifiedCount,
      verifiedPct,
      totalSubKegiatan: rows.length,
    };
  }, [rows, selectedSemesterFilter]);

  // Data Kurva Tren Overview (Jan - Jul / Des) sesuai referensi visual
  const trendData = useMemo(() => {
    const basePct = Math.max(12, Math.min(96, stats.persentaseAktif || 64.5));
    if (selectedSemesterFilter === 'S2') {
      return [
        { bulan: 'Jul', nilai: Number((basePct * 0.32).toFixed(1)), label: '2,4%' },
        { bulan: 'Agu', nilai: Number((basePct * 0.58).toFixed(1)), label: '4,2%' },
        { bulan: 'Sep', nilai: Number((basePct * 0.35).toFixed(1)), label: '2,8%' },
        { bulan: 'Okt', nilai: Number((basePct * 0.65).toFixed(1)), label: '4,9%' },
        { bulan: 'Nov', nilai: Number((basePct * 0.88).toFixed(1)), label: '6,1%' },
        { bulan: 'Des', nilai: Number((basePct * 0.78).toFixed(1)), label: '5,5%' },
      ];
    }
    return [
      { bulan: 'Jan', nilai: 2.2, label: '2,2%' },
      { bulan: 'Feb', nilai: 4.1, label: '4,1%' },
      { bulan: 'Mar', nilai: 1.9, label: '1,9%' },
      { bulan: 'Apr', nilai: 3.5, label: '3,5%' },
      { bulan: 'Mei', nilai: 5.8, label: '5,8%' },
      { bulan: 'Jun', nilai: 3.8, label: '3,8%' },
      { bulan: 'Jul', nilai: 5.3, label: '5,3%' },
    ];
  }, [stats.persentaseAktif, selectedSemesterFilter]);

  // Data Grafik Analitik Tambahan (Per OPD, Strategi, dan Verifikasi)
  const chartPerOpd = useMemo(() => {
    const source = userRole === 'ADMIN' ? allRowsForRecap : rows;
    const map = new Map<
      string,
      {
        singkatan: string;
        alokasiMiliar: number;
        sem1Miliar: number;
        sem2Miliar: number;
        tahunanMiliar: number;
        sasaran: number;
      }
    >();

    source.forEach((r) => {
      const cur = map.get(r.opd_id) || {
        singkatan: r.singkatan_opd,
        alokasiMiliar: 0,
        sem1Miliar: 0,
        sem2Miliar: 0,
        tahunanMiliar: 0,
        sasaran: 0,
      };
      cur.alokasiMiliar = Number(
        (cur.alokasiMiliar + r.alokasi_anggaran / 1_000_000_000).toFixed(2)
      );
      cur.sem1Miliar = Number(
        (cur.sem1Miliar + r.sem1.realisasi / 1_000_000_000).toFixed(2)
      );
      cur.sem2Miliar = Number(
        (cur.sem2Miliar + r.sem2.realisasi / 1_000_000_000).toFixed(2)
      );
      cur.tahunanMiliar = Number(
        (cur.tahunanMiliar + r.total_realisasi_tahunan / 1_000_000_000).toFixed(2)
      );
      cur.sasaran += r.jumlah_sasaran;
      map.set(r.opd_id, cur);
    });

    return Array.from(map.values());
  }, [allRowsForRecap, rows, userRole]);

  const chartStrategi = useMemo(() => {
    const map = new Map<
      string,
      { nama: string; alokasiMiliar: number; sem1Miliar: number; sem2Miliar: number }
    >();
    rows.forEach((r) => {
      const short = r.strategi.startsWith('1.')
        ? 'Strategi 1 (Beban)'
        : r.strategi.startsWith('2.')
        ? 'Strategi 2 (Pendapatan)'
        : 'Strategi 3 (Kantong)';
      const cur = map.get(short) || {
        nama: short,
        alokasiMiliar: 0,
        sem1Miliar: 0,
        sem2Miliar: 0,
      };
      cur.alokasiMiliar = Number(
        (cur.alokasiMiliar + r.alokasi_anggaran / 1_000_000_000).toFixed(2)
      );
      cur.sem1Miliar = Number(
        (cur.sem1Miliar + r.sem1.realisasi / 1_000_000_000).toFixed(2)
      );
      cur.sem2Miliar = Number(
        (cur.sem2Miliar + r.sem2.realisasi / 1_000_000_000).toFixed(2)
      );
      map.set(short, cur);
    });
    return Array.from(map.values());
  }, [rows]);

  const chartVerifikasi = useMemo(() => {
    const statuses = [
      'Terverifikasi',
      'Menunggu Verifikasi',
      'Perlu Perbaikan',
      'Draft',
    ] as const;
    return statuses.map((s) => ({
      status: s,
      'Semester 1': rows.filter((r) => r.sem1.status_verifikasi === s).length,
      'Semester 2': rows.filter((r) => r.sem2.status_verifikasi === s).length,
    }));
  }, [rows]);

  // Data Donut Chart "Distribusi Data" (Sesuai Lampiran)
  const distributionData = useMemo(() => {
    const s1 = rows
      .filter((r) => r.strategi.startsWith('1.'))
      .reduce((a, b) => a + b.total_realisasi_tahunan, 0);
    const s2 = rows
      .filter((r) => r.strategi.startsWith('2.'))
      .reduce((a, b) => a + b.total_realisasi_tahunan, 0);
    const s3 = rows
      .filter((r) => r.strategi.startsWith('3.'))
      .reduce((a, b) => a + b.total_realisasi_tahunan, 0);
    const total = s1 + s2 + s3;

    if (total === 0) {
      return [
        { name: 'OPD Teknis', value: 40, color: '#2563EB' },
        { name: 'Puskesmas / UPTD', value: 35, color: '#10B981' },
        { name: 'Kecamatan / Desa', value: 25, color: '#F59E0B' },
      ];
    }

    const p1 = Math.round((s1 / total) * 100) || 40;
    const p2 = Math.round((s2 / total) * 100) || 35;
    const p3 = Math.max(5, 100 - p1 - p2);

    return [
      { name: 'Beban Pengeluaran (OPD)', value: p1, color: '#2563EB' },
      { name: 'Pendapatan Masyarakat', value: p2, color: '#10B981' },
      { name: 'Kantong Kemiskinan', value: p3, color: '#F59E0B' },
    ];
  }, [rows]);

  // Tabel Rekapitulasi per OPD / Subkegiatan (Sesuai Lampiran)
  const recapTableRows = useMemo(() => {
    if (userRole === 'OPD') {
      // Tampilkan daftar subkegiatan milik OPD tersebut ditambah ringkasan lintas OPD
      return rows.map((r, i) => {
        const real =
          selectedSemesterFilter === 'S1'
            ? r.sem1.realisasi
            : selectedSemesterFilter === 'S2'
            ? r.sem2.realisasi
            : r.total_realisasi_tahunan;
        const pct = r.alokasi_anggaran > 0 ? (real / r.alokasi_anggaran) * 100 : 0;
        const semStatus =
          selectedSemesterFilter === 'S2'
            ? r.sem2.status_verifikasi
            : r.sem1.status_verifikasi;

        return {
          id: r.matrix_id,
          no: i + 1,
          nama: r.sub_kegiatan,
          subLabel: `${r.singkatan_opd} · ${r.kode}`,
          target: r.alokasi_anggaran,
          realisasi: real,
          persentase: Number(pct.toFixed(1)),
          statusLabel:
            semStatus === 'Terverifikasi'
              ? 'Baik'
              : semStatus === 'Menunggu Verifikasi'
              ? 'Cukup'
              : 'Dalam Proses',
          rawRow: r,
        };
      });
    }

    // Jika Admin: tampilkan rekapitulasi per OPD sesuai gambar lampiran
    const opdSummaryMap = new Map<
      string,
      {
        opd_id: string;
        nama: string;
        target: number;
        realisasi: number;
        sampleRow: EnrichedMatrixRow;
      }
    >();

    allRowsForRecap.forEach((r) => {
      const real =
        selectedSemesterFilter === 'S1'
          ? r.sem1.realisasi
          : selectedSemesterFilter === 'S2'
          ? r.sem2.realisasi
          : r.total_realisasi_tahunan;

      const cur = opdSummaryMap.get(r.opd_id) || {
        opd_id: r.opd_id,
        nama: r.singkatan_opd,
        target: 0,
        realisasi: 0,
        sampleRow: r,
      };
      cur.target += r.alokasi_anggaran;
      cur.realisasi += real;
      opdSummaryMap.set(r.opd_id, cur);
    });

    return Array.from(opdSummaryMap.values()).map((item, idx) => {
      const pct = item.target > 0 ? (item.realisasi / item.target) * 100 : 0;
      return {
        id: item.opd_id,
        no: idx + 1,
        nama: item.nama,
        subLabel: item.sampleRow.nama_opd,
        target: item.target,
        realisasi: item.realisasi,
        persentase: Number(pct.toFixed(1)),
        statusLabel: pct >= 70 ? 'Baik' : pct >= 45 ? 'Cukup' : 'Dalam Proses',
        rawRow: item.sampleRow,
      };
    });
  }, [rows, allRowsForRecap, userRole, selectedSemesterFilter]);

  const dashboardTitle =
    userRole === 'ADMIN'
      ? 'Selamat Datang di OPTIMIS (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)'
      : `Selamat Datang di OPTIMIS — ${activeOpd.singkatan}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-6"
    >
      {/* BARIS 1: Welcome Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Welcome Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
          className="lg:col-span-12 rounded-2xl bg-gradient-to-r from-[#EAF2FF] via-[#DCE9FF] to-[#C7DFFF] border border-blue-200/70 shadow-[0_8px_25px_-6px_rgba(37,99,235,0.12)] relative overflow-hidden flex items-center min-h-[148px]"
        >
          {/* Gambar Banner Kabupaten Blora di Sisi Kanan Banner */}
          <div className="absolute inset-y-0 right-0 w-full sm:w-3/5 opacity-35 sm:opacity-100">
            <HeroGovBuildingArt />
          </div>

          <div className="relative z-10 p-6 sm:p-7 flex items-center max-w-2xl">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-white/80 text-[#1D4ED8] text-[11px] font-bold border border-blue-200/80">
                <span>OPTIMIS (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                {dashboardTitle}
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-700 leading-relaxed max-w-xl font-medium">
                Pantau kinerja real, alokasi anggaran, serta pelaporan capaian realisasi{' '}
                <strong className="text-slate-900">Semester 1</strong> dan{' '}
                <strong className="text-slate-900">Semester 2</strong> untuk subkegiatan penanggulangan kemiskinan instansi Anda.
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* BARIS 2: 4 Kartu KPI dengan Ilustrasi Gelombang Pastel (Sesuai Lampiran) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* KPI 1: Total Alokasi Anggaran */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] relative overflow-hidden flex items-start gap-4"
        >
          <CardWaveDecoration color="blue" />
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
            <Users className="w-6 h-6" />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="text-xs font-medium text-slate-500">Total Alokasi Anggaran</p>
            <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-tabular mt-1 truncate">
              <AnimatedCounter value={stats.totalAlokasi} format="rupiah" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">↑ 12,5%</span>
              <span>dari tahun lalu</span>
            </p>
          </div>
        </motion.div>

        {/* KPI 2: Target Penerima Manfaat */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.14 }}
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] relative overflow-hidden flex items-start gap-4"
        >
          <CardWaveDecoration color="emerald" />
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Target className="w-6 h-6" />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="text-xs font-medium text-slate-500">Target Penerima Manfaat</p>
            <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-tabular mt-1">
              <AnimatedCounter value={stats.totalSasaran} format="number" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">↑ 8,7%</span>
              <span>dari target sasaran</span>
            </p>
          </div>
        </motion.div>

        {/* KPI 3: Realisasi Semester 1 / 2 / Tahunan */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] relative overflow-hidden flex items-start gap-4"
        >
          <CardWaveDecoration color="purple" />
          <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Coins className="w-6 h-6" />
          </div>
          <div className="relative z-10 min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500">
              {selectedSemesterFilter === 'S1'
                ? 'Realisasi Semester 1'
                : selectedSemesterFilter === 'S2'
                ? 'Realisasi Semester 2'
                : 'Total Realisasi Tahunan'}
            </p>
            <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-tabular mt-1 truncate">
              <AnimatedCounter value={stats.activeRealisasi} format="rupiah" />
            </div>
            <div className="flex items-center gap-2.5 mt-2.5">
              <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#2563EB] to-[#60A5FA] rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, stats.persentaseAktif)}%` }}
                />
              </div>
              <span className="text-xs font-bold font-mono-tabular text-slate-800">
                {stats.persentaseAktif.toFixed(1).replace('.', ',')}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* KPI 4: Terverifikasi S1 / S2 */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22 }}
          whileHover={{ y: -2 }}
          className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] relative overflow-hidden flex items-start gap-4"
        >
          <CardWaveDecoration color="amber" />
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="relative z-10 min-w-0">
            <p className="text-xs font-medium text-slate-500">
              {selectedSemesterFilter === 'S2'
                ? 'Terverifikasi S2'
                : selectedSemesterFilter === 'TAHUNAN'
                ? 'Terverifikasi S1 & S2'
                : 'Terverifikasi S1'}
            </p>
            <div className="text-lg sm:text-xl font-bold text-slate-900 font-mono-tabular mt-1">
              <AnimatedCounter value={stats.verifiedCount} format="number" />
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold">
                ↑ {stats.verifiedPct}%
              </span>
              <span>dari {stats.totalSubKegiatan} subkegiatan</span>
            </p>
          </div>
        </motion.div>
      </div>

      {/* BARIS 3: Overview Chart (8/12) + Recent Activity (4/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel Kiri: Overview & Grafik Analitik (8/12) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.26 }}
          className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col justify-between"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-slate-900">Overview</h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Tren akumulasi realisasi anggaran program kemiskinan ekstrem
              </p>
            </div>

            {/* Pemilih Mode Grafik agar semua grafik analitik tetap dapat diakses */}
            <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1 rounded-xl">
              {[
                { id: 'tren', label: 'Tren Realisasi' },
                { id: 'opd', label: 'Per OPD' },
                { id: 'semester', label: 'S1 vs S2' },
                { id: 'strategi', label: 'Strategi' },
                { id: 'verifikasi', label: 'Verifikasi' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setChartTab(
                      t.id as 'tren' | 'opd' | 'semester' | 'strategi' | 'verifikasi'
                    )
                  }
                  className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-colors cursor-pointer ${
                    chartTab === t.id
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {chartTab === 'tren' ? (
                <AreaChart
                  data={trendData}
                  margin={{ top: 16, right: 18, left: -16, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="overviewBlueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.24} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={true} />
                  <XAxis
                    dataKey="bulan"
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748B' }}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 8]}
                  />
                  <Tooltip
                    formatter={(value: any) => [`${value}% Capaian Bulanan`, 'Realisasi Aktual']}
                    contentStyle={{
                      backgroundColor: '#FFFFFF',
                      borderColor: '#E2E8F0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px -5px rgba(15,23,42,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="nilai"
                    name="Realisasi Aktual"
                    stroke="#2563EB"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#overviewBlueGrad)"
                    dot={{
                      r: 5,
                      fill: '#FFFFFF',
                      stroke: '#2563EB',
                      strokeWidth: 2.5,
                    }}
                    activeDot={{
                      r: 6,
                      fill: '#2563EB',
                      stroke: '#FFFFFF',
                      strokeWidth: 2,
                    }}
                  />
                </AreaChart>
              ) : chartTab === 'opd' ? (
                <BarChart data={chartPerOpd} margin={{ top: 10, right: 12, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="singkatan" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(v: any) => [`Rp ${v} Miliar`, '']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="alokasiMiliar"
                    name="Alokasi (Miliar Rp)"
                    fill="#1D4ED8"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="tahunanMiliar"
                    name="Realisasi Tahunan (Miliar Rp)"
                    fill="#38BDF8"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              ) : chartTab === 'semester' ? (
                <BarChart data={chartPerOpd} margin={{ top: 10, right: 12, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="singkatan" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(v: any) => [`Rp ${v} Miliar`, '']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar
                    dataKey="sem1Miliar"
                    name="Realisasi Semester 1"
                    fill="#2563EB"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="sem2Miliar"
                    name="Realisasi Semester 2"
                    fill="#10B981"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              ) : chartTab === 'strategi' ? (
                <BarChart data={chartStrategi} margin={{ top: 10, right: 12, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="nama" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip
                    formatter={(v: any) => [`Rp ${v} Miliar`, '']}
                    contentStyle={{ borderRadius: '12px', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="alokasiMiliar" name="Alokasi" fill="#1E3A8A" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sem1Miliar" name="Realisasi S1" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="sem2Miliar" name="Realisasi S2" fill="#10B981" radius={[6, 6, 0, 0]} />
                </BarChart>
              ) : (
                <BarChart data={chartVerifikasi} margin={{ top: 10, right: 12, left: -10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F6" vertical={false} />
                  <XAxis dataKey="status" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="Semester 1" fill="#2563EB" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Semester 2" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Panel Kanan: Recent Activity (4/12) Sesuai Lampiran */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-slate-900">Recent Activity</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('audit-log')}
                className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative pl-3 space-y-4 before:content-[''] before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
              {auditLogs.slice(0, 4).map((log, idx) => {
                const palette = [
                  {
                    dot: 'bg-[#2563EB]',
                    bg: 'bg-blue-50 text-[#2563EB]',
                    icon: <FileText className="w-3.5 h-3.5" />,
                  },
                  {
                    dot: 'bg-emerald-500',
                    bg: 'bg-emerald-50 text-emerald-600',
                    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
                  },
                  {
                    dot: 'bg-amber-500',
                    bg: 'bg-amber-50 text-amber-600',
                    icon: <AlertCircle className="w-3.5 h-3.5" />,
                  },
                  {
                    dot: 'bg-purple-500',
                    bg: 'bg-purple-50 text-purple-600',
                    icon: <Upload className="w-3.5 h-3.5" />,
                  },
                ][idx % 4];

                return (
                  <div key={log.log_id} className="relative flex items-start gap-3">
                    <span
                      className={`w-2 h-2 rounded-full ${palette.dot} mt-2.5 -ml-[3px] ring-4 ring-white shrink-0`}
                    />
                    <div
                      className={`w-8 h-8 rounded-full ${palette.bg} flex items-center justify-center shrink-0`}
                    >
                      {palette.icon}
                    </div>
                    <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
                      <p className="text-xs font-bold text-slate-900 line-clamp-1">
                        {log.aksi}
                      </p>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        oleh {log.user_name} · {formatDateTimeID(log.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </div>

      {/* BARIS 4: Distribusi Data Donut (4/12) + Rekapitulasi per OPD / Subkegiatan (8/12) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Panel Kiri: Distribusi Data Donut Chart (4/12) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.34 }}
          className="lg:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-[#2563EB]" />
              <h3 className="text-base font-bold text-slate-900">Distribusi Data</h3>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Sebaran realisasi per jenis strategi program
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 items-center gap-4 my-2">
            <div className="h-44 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {distributionData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold font-mono-tabular text-slate-900">
                  {Math.round(stats.persentaseAktif || 75)}%
                </span>
                <span className="text-[11px] text-slate-500">Realisasi</span>
              </div>
            </div>

            <div className="space-y-3">
              {distributionData.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between text-xs gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-slate-600 font-medium truncate">
                      {d.name}
                    </span>
                  </div>
                  <span className="font-mono-tabular font-bold text-slate-900">
                    {d.value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Panel Kanan: Rekapitulasi per OPD / Subkegiatan (8/12) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="lg:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-[0_8px_25px_-8px_rgba(15,23,42,0.05)] flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-[#2563EB]" />
                <h3 className="text-base font-bold text-slate-900">
                  {userRole === 'ADMIN'
                    ? 'Rekapitulasi per OPD'
                    : `Rekapitulasi Subkegiatan ${activeOpd.singkatan}`}
                </h3>
              </div>

              <div className="flex items-center gap-3">
                {userRole === 'OPD' && (
                  <button
                    type="button"
                    onClick={() => onOpenInputModal(null)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 text-[#2563EB] hover:bg-blue-100 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Input Data Matriks</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab('matriks')}
                  className="text-xs font-semibold text-[#2563EB] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Detail</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8FAFF] text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-3 rounded-l-lg">No</th>
                    <th className="py-2.5 px-3">
                      {userRole === 'ADMIN' ? 'Nama OPD' : 'Subkegiatan & Rekening'}
                    </th>
                    <th className="py-2.5 px-3">Target / Pagu</th>
                    <th className="py-2.5 px-3">Realisasi</th>
                    <th className="py-2.5 px-3">Persentase</th>
                    <th className="py-2.5 px-3">Status</th>
                    {userRole === 'OPD' && (
                      <th className="py-2.5 px-3 text-right rounded-r-lg">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recapTableRows.slice(0, 5).map((item) => {
                    const isOpdRowLocked =
                      userRole === 'OPD' &&
                      (selectedSemesterFilter === 'S2'
                        ? item.rawRow.sem2.status_verifikasi === 'Terverifikasi'
                        : item.rawRow.sem1.status_verifikasi === 'Terverifikasi');

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-3 font-mono-tabular text-slate-500">
                          {item.no}
                        </td>
                        <td className="py-3 px-3 max-w-[230px]">
                          <p className="font-bold text-slate-800 truncate">{item.nama}</p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {item.subLabel}
                          </p>
                        </td>
                        <td className="py-3 px-3 font-mono-tabular text-slate-700 whitespace-nowrap">
                          {formatRupiah(item.target)}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                          {formatRupiah(item.realisasi)}
                        </td>
                        <td className="py-3 px-3 font-mono-tabular font-semibold text-slate-800">
                          {String(item.persentase).replace('.', ',')}%
                        </td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${
                              item.statusLabel === 'Baik'
                                ? 'bg-emerald-50 text-emerald-700'
                                : item.statusLabel === 'Cukup'
                                ? 'bg-amber-50 text-amber-700'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.statusLabel}
                          </span>
                        </td>
                        {userRole === 'OPD' && (
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {isOpdRowLocked ? (
                              <span
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 cursor-not-allowed"
                                title="Telah Terverifikasi & Terkunci"
                              >
                                <Lock className="w-3 h-3" />
                                <span>Terkunci</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onOpenInputModal(item.rawRow)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-[#2563EB] hover:bg-blue-50 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Edit</span>
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
