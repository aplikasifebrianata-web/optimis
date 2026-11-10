import React, { useState } from 'react';
import { motion } from 'motion/react';
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
} from 'lucide-react';
import {
  AuditLog,
  EnrichedMatrixRow,
  OPD,
  PeriodePelaporan,
  UserRole,
} from '../types/oppkpke';
import { formatDateTimeID } from '../utils/formatters';

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
  const [auditSemesterFilter, setAuditSemesterFilter] = useState<'ALL' | '1' | '2'>('ALL');
  const [auditSearch, setAuditSearch] = useState('');

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
    const filteredLogs = auditLogs.filter((l) => {
      if (auditSemesterFilter === '1' && l.semester !== 1) return false;
      if (auditSemesterFilter === '2' && l.semester !== 2) return false;
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        return (
          l.aksi.toLowerCase().includes(q) ||
          l.detail_perubahan.toLowerCase().includes(q) ||
          l.user_name.toLowerCase().includes(q)
        );
      }
      return true;
    });

    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200/80">
          <div>
            <p className="text-xs font-medium text-sky-700 mb-1">
              Jejak Audit & Histori Perubahan Per Semester
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Riwayat & Audit Log OPTIMIS (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Seluruh aktivitas pengisian OPD, perubahan anggaran, pengajuan realisasi Semester 1 dan Semester 2, serta keputusan verifikator tercatat secara kronologis.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                placeholder="Cari log perubahan..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <select
              value={auditSemesterFilter}
              onChange={(e) => setAuditSemesterFilter(e.target.value as 'ALL' | '1' | '2')}
              className="px-3 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Aktivitas & Semester</option>
              <option value="1">Khusus Semester 1 (Jan–Jun)</option>
              <option value="2">Khusus Semester 2 (Jul–Des)</option>
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 overflow-hidden shadow-[0_2px_12px_-3px_rgba(15,23,42,0.05)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-3 px-4">Waktu Kejadian</th>
                  <th className="py-3 px-4">Pelaku & Peran</th>
                  <th className="py-3 px-4">Semester</th>
                  <th className="py-3 px-4">Tindakan / Aksi</th>
                  <th className="py-3 px-4">Rincian Perubahan & Nilai</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70">
                {filteredLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50/70 align-top">
                    <td className="py-3.5 px-4 font-mono-tabular whitespace-nowrap text-slate-500">
                      {formatDateTimeID(log.created_at)}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-900">{log.user_name}</span>
                      <span className="block text-[11px] text-slate-400">
                        Peran: {log.user_role}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap font-medium">
                      {log.semester === 1 ? (
                        <span className="text-sky-700">Semester 1 (Jan–Jun)</span>
                      ) : log.semester === 2 ? (
                        <span className="text-indigo-700">Semester 2 (Jul–Des)</span>
                      ) : (
                        <span className="text-slate-500">Data Matriks / Sistem</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{log.aksi}</td>
                    <td className="py-3.5 px-4 space-y-1 text-slate-600">
                      <p>{log.detail_perubahan}</p>
                      {(log.nilai_sebelumnya || log.nilai_baru) && (
                        <p className="text-[11px] font-mono-tabular text-slate-500">
                          Sebelum: <span>{log.nilai_sebelumnya || '-'}</span> → Sesudah:{' '}
                          <strong className="text-slate-800">{log.nilai_baru || '-'}</strong>
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
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
