import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  BookOpen,
  Search,
  Copy,
  CheckCircle2,
  Plus,
  Edit3,
  Trash2,
  Upload,
  Download,
  FileSpreadsheet,
  RefreshCw,
  Building2,
  Layers,
  FolderTree,
  Table2,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
} from 'lucide-react';
import { KodeSipdItem, OPD, UserRole } from '../types/oppkpke';
import { SipdService, getUploadedSipdMeta } from '../services/sipdService';
import { formatNumber } from '../utils/formatters';

interface KodeSipdViewProps {
  allOpds: OPD[];
  activeOpd: OPD;
  userRole: UserRole;
  onUseSipdInMatrix: (item: KodeSipdItem) => void;
  onShowToast: (type: 'success' | 'error', text: string) => void;
}

export const KodeSipdView: React.FC<KodeSipdViewProps> = ({
  allOpds,
  activeOpd,
  userRole,
  onUseSipdInMatrix,
  onShowToast,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [uniqueRows, setUniqueRows] = useState<KodeSipdItem[]>([]);
  const [allCsvRows, setAllCsvRows] = useState<KodeSipdItem[]>([]);

  // Mode Dataset: 'unique' (2.407 kode unik per Sub Unit + Sub Kegiatan) atau 'all' (20.998 baris CSV)
  const [datasetMode, setDatasetMode] = useState<'unique' | 'all'>('unique');
  // Mode Tampilan: 'table' atau 'hierarchy'
  const [viewMode, setViewMode] = useState<'table' | 'hierarchy'>('table');

  // Filter & Pencarian (Jika userRole === 'OPD', dikunci 100% hanya ke instansi aktif — anti salah kamar)
  const isOpdRole = userRole !== 'ADMIN';
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyMyOpd, setOnlyMyOpd] = useState<boolean>(userRole !== 'ADMIN');
  const [selectedSkpd, setSelectedSkpd] = useState<string>('ALL');
  const [selectedSubUnit, setSelectedSubUnit] = useState<string>('ALL');
  const [selectedBidang, setSelectedBidang] = useState<string>('ALL');
  const [selectedProgram, setSelectedProgram] = useState<string>('ALL');
  const [selectedKegiatan, setSelectedKegiatan] = useState<string>('ALL');
  const [uploadedCsvMeta, setUploadedCsvMeta] = useState<{
    fileName: string;
    totalRawRows: number;
    uniqueCount: number;
    uploadedAt: string;
  } | null>(() => getUploadedSipdMeta());

  // Paginasi Tabel
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Modal Detail, Tambah/Edit, dan Hapus
  const [detailItem, setDetailItem] = useState<KodeSipdItem | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<KodeSipdItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<KodeSipdItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // State Form 13 Kolom SIPD
  const [formNamaUrusan, setFormNamaUrusan] = useState(
    'URUSAN PEMERINTAHAN WAJIB YANG BERKAITAN DENGAN PELAYANAN DASAR'
  );
  const [formKodeSkpd, setFormKodeSkpd] = useState('');
  const [formNamaSkpd, setFormNamaSkpd] = useState('');
  const [formKodeSubUnit, setFormKodeSubUnit] = useState('');
  const [formNamaSubUnit, setFormNamaSubUnit] = useState('');
  const [formKodeBidang, setFormKodeBidang] = useState('');
  const [formNamaBidang, setFormNamaBidang] = useState('');
  const [formKodeProgram, setFormKodeProgram] = useState('');
  const [formNamaProgram, setFormNamaProgram] = useState('');
  const [formKodeKegiatan, setFormKodeKegiatan] = useState('');
  const [formNamaKegiatan, setFormNamaKegiatan] = useState('');
  const [formKodeSubKegiatan, setFormKodeSubKegiatan] = useState('');
  const [formNamaSubKegiatan, setFormNamaSubKegiatan] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isSyncingSipdCloud, setIsSyncingSipdCloud] = useState(false);

  const reloadData = async () => {
    setIsLoading(true);
    try {
      const res = await SipdService.loadSipdDataset();
      setUniqueRows(res.uniqueRows);
      setAllCsvRows(res.allRows);
      setUploadedCsvMeta(getUploadedSipdMeta());
    } catch {
      onShowToast('error', 'Gagal memuat referensi Kode SIPD.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void reloadData();
    const unsub = SipdService.subscribeToSipdCloud(() => {
      void reloadData();
    });
    return () => {
      unsub();
    };
  }, []);

  const handleManualSyncSipdCloud = async () => {
    if (isSyncingSipdCloud) return;
    setIsSyncingSipdCloud(true);
    try {
      const res = await SipdService.syncWithCloud();
      await reloadData();
      if (res.direction === 'pushed') {
        onShowToast(
          'success',
          `Berhasil mengunggah & menyinkronkan ${formatNumber(res.count)} Kode SIPD ke Cloud Firestore (optimis-97d75).`
        );
      } else if (res.direction === 'pulled') {
        onShowToast(
          'success',
          `Berhasil menarik ${formatNumber(res.count)} Kode SIPD dari Cloud Firestore (optimis-97d75).`
        );
      } else {
        onShowToast(
          'success',
          'Sinkronisasi Cloud Firestore selesai (belum ada data Kode SIPD yang diunggah).'
        );
      }
    } catch {
      onShowToast('error', 'Gagal menyinkronkan Kode SIPD dengan Cloud Firestore.');
    } finally {
      setIsSyncingSipdCloud(false);
    }
  };

  useEffect(() => {
    if (isOpdRole) {
      setOnlyMyOpd(true);
      setSelectedSkpd('ALL');
      setSelectedSubUnit('ALL');
    }
  }, [isOpdRole, activeOpd.opd_id]);

  // Basis data yang diizinkan untuk dilihat user saat ini (OPD hanya melihat instansinya sendiri — tidak bisa salah kamar)
  const rawActiveDataset = datasetMode === 'unique' ? uniqueRows : allCsvRows;
  const activeDataset = useMemo(() => {
    if (isOpdRole) {
      return SipdService.getSipdRowsForOpd(rawActiveDataset, activeOpd);
    }
    return rawActiveDataset;
  }, [rawActiveDataset, isOpdRole, activeOpd]);

  const scopedUniqueRows = useMemo(() => {
    if (isOpdRole) {
      return SipdService.getSipdRowsForOpd(uniqueRows, activeOpd);
    }
    return uniqueRows;
  }, [uniqueRows, isOpdRole, activeOpd]);

  const scopedAllCsvRows = useMemo(() => {
    if (isOpdRole) {
      return SipdService.getSipdRowsForOpd(allCsvRows, activeOpd);
    }
    return allCsvRows;
  }, [allCsvRows, isOpdRole, activeOpd]);

  // Statistik Ringkas Master Kode SIPD (Sesuai cakupan akses instansi/admin)
  const stats = useMemo(() => {
    const skpdSet = new Set<string>();
    const subUnitSet = new Set<string>();
    const programSet = new Set<string>();
    const kegiatanSet = new Set<string>();
    const subKegiatanSet = new Set<string>();

    scopedUniqueRows.forEach((r) => {
      if (r.kode_skpd || r.nama_skpd) skpdSet.add(`${r.kode_skpd}|${r.nama_skpd}`);
      if (r.kode_sub_unit || r.nama_sub_unit)
        subUnitSet.add(`${r.kode_sub_unit}|${r.nama_sub_unit}`);
      if (r.kode_program || r.nama_program)
        programSet.add(`${r.kode_program}|${r.nama_program}`);
      if (r.kode_kegiatan || r.nama_kegiatan)
        kegiatanSet.add(`${r.kode_kegiatan}|${r.nama_kegiatan}`);
      if (r.kode_sub_kegiatan || r.nama_sub_kegiatan)
        subKegiatanSet.add(`${r.kode_sub_kegiatan}|${r.nama_sub_kegiatan}`);
    });

    return {
      totalUnique: scopedUniqueRows.length,
      totalAllCsv: scopedAllCsvRows.length,
      skpdCount: skpdSet.size,
      subUnitCount: subUnitSet.size,
      programCount: programSet.size,
      kegiatanCount: kegiatanSet.size,
      subKegiatanCount: subKegiatanSet.size,
    };
  }, [scopedUniqueRows, scopedAllCsvRows]);

  // Opsi Dropdown Filter Bertingkat
  const skpdOptions = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string; count: number }>();
    activeDataset.forEach((r) => {
      if (!r.nama_skpd) return;
      const existing = map.get(r.nama_skpd);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.nama_skpd, { kode: r.kode_skpd, nama: r.nama_skpd, count: 1 });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [activeDataset]);

  const subUnitOptions = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string; count: number }>();
    activeDataset.forEach((r) => {
      if (selectedSkpd !== 'ALL' && r.nama_skpd !== selectedSkpd) return;
      if (!r.nama_sub_unit) return;
      const existing = map.get(r.nama_sub_unit);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(r.nama_sub_unit, {
          kode: r.kode_sub_unit,
          nama: r.nama_sub_unit,
          count: 1,
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [activeDataset, selectedSkpd]);

  const bidangOptions = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string }>();
    activeDataset.forEach((r) => {
      if (selectedSkpd !== 'ALL' && r.nama_skpd !== selectedSkpd) return;
      if (selectedSubUnit !== 'ALL' && r.nama_sub_unit !== selectedSubUnit) return;
      if (!r.nama_bidang_urusan) return;
      const key = `${r.kode_bidang_urusan} - ${r.nama_bidang_urusan}`;
      if (!map.has(key)) {
        map.set(key, { kode: r.kode_bidang_urusan, nama: r.nama_bidang_urusan });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [activeDataset, selectedSkpd, selectedSubUnit]);

  const programOptions = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string }>();
    activeDataset.forEach((r) => {
      if (!isOpdRole && onlyMyOpd && !SipdService.matchesActiveOpd(r, activeOpd)) return;
      if (selectedSkpd !== 'ALL' && r.nama_skpd !== selectedSkpd) return;
      if (selectedSubUnit !== 'ALL' && r.nama_sub_unit !== selectedSubUnit) return;
      if (selectedBidang !== 'ALL' && r.nama_bidang_urusan !== selectedBidang) return;
      if (!r.nama_program) return;
      const key = `${r.kode_program}|${r.nama_program}`;
      if (!map.has(key)) {
        map.set(key, { kode: r.kode_program, nama: r.nama_program });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [activeDataset, isOpdRole, onlyMyOpd, activeOpd, selectedSkpd, selectedSubUnit, selectedBidang]);

  const kegiatanOptions = useMemo(() => {
    const map = new Map<string, { kode: string; nama: string }>();
    activeDataset.forEach((r) => {
      if (!isOpdRole && onlyMyOpd && !SipdService.matchesActiveOpd(r, activeOpd)) return;
      if (selectedSkpd !== 'ALL' && r.nama_skpd !== selectedSkpd) return;
      if (selectedSubUnit !== 'ALL' && r.nama_sub_unit !== selectedSubUnit) return;
      if (selectedBidang !== 'ALL' && r.nama_bidang_urusan !== selectedBidang) return;
      if (selectedProgram !== 'ALL' && r.nama_program !== selectedProgram) return;
      if (!r.nama_kegiatan) return;
      const key = `${r.kode_kegiatan}|${r.nama_kegiatan}`;
      if (!map.has(key)) {
        map.set(key, { kode: r.kode_kegiatan, nama: r.nama_kegiatan });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.kode.localeCompare(b.kode));
  }, [
    activeDataset,
    isOpdRole,
    onlyMyOpd,
    activeOpd,
    selectedSkpd,
    selectedSubUnit,
    selectedBidang,
    selectedProgram,
  ]);

  // Filter Baris Kode SIPD
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return activeDataset.filter((r) => {
      if ((isOpdRole || onlyMyOpd) && !SipdService.matchesActiveOpd(r, activeOpd)) {
        return false;
      }
      if (selectedSkpd !== 'ALL' && r.nama_skpd !== selectedSkpd) {
        return false;
      }
      if (selectedSubUnit !== 'ALL' && r.nama_sub_unit !== selectedSubUnit) {
        return false;
      }
      if (selectedBidang !== 'ALL' && r.nama_bidang_urusan !== selectedBidang) {
        return false;
      }
      if (selectedProgram !== 'ALL' && r.nama_program !== selectedProgram) {
        return false;
      }
      if (selectedKegiatan !== 'ALL' && r.nama_kegiatan !== selectedKegiatan) {
        return false;
      }
      if (q) {
        return (
          r.kode_sub_kegiatan.toLowerCase().includes(q) ||
          r.nama_sub_kegiatan.toLowerCase().includes(q) ||
          r.kode_kegiatan.toLowerCase().includes(q) ||
          r.nama_kegiatan.toLowerCase().includes(q) ||
          r.kode_program.toLowerCase().includes(q) ||
          r.nama_program.toLowerCase().includes(q) ||
          r.nama_skpd.toLowerCase().includes(q) ||
          r.nama_sub_unit.toLowerCase().includes(q) ||
          r.kode_skpd.toLowerCase().includes(q) ||
          r.nama_bidang_urusan.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [
    activeDataset,
    isOpdRole,
    onlyMyOpd,
    activeOpd,
    selectedSkpd,
    selectedSubUnit,
    selectedBidang,
    selectedProgram,
    selectedKegiatan,
    searchQuery,
  ]);

  // Reset halaman ke 1 saat filter berubah
  useEffect(() => {
    setCurrentPage(1);
  }, [
    datasetMode,
    onlyMyOpd,
    selectedSkpd,
    selectedSubUnit,
    selectedBidang,
    selectedProgram,
    selectedKegiatan,
    searchQuery,
    pageSize,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Pengelompokan Hirarki untuk Mode Pohon (SKPD/Sub Unit -> Program -> Kegiatan -> Sub Kegiatan)
  const hierarchyGroups = useMemo(() => {
    if (viewMode !== 'hierarchy') return [];
    const sampleRows = filteredRows.slice(0, 300);
    const skpdMap = new Map<
      string,
      {
        kode_skpd: string;
        nama_skpd: string;
        nama_sub_unit: string;
        programs: Map<
          string,
          {
            kode_program: string;
            nama_program: string;
            kegiatans: Map<
              string,
              {
                kode_kegiatan: string;
                nama_kegiatan: string;
                subKegiatans: KodeSipdItem[];
              }
            >;
          }
        >;
      }
    >();

    sampleRows.forEach((r) => {
      const unitKey = `${r.kode_sub_unit}|${r.nama_sub_unit}`;
      if (!skpdMap.has(unitKey)) {
        skpdMap.set(unitKey, {
          kode_skpd: r.kode_sub_unit || r.kode_skpd,
          nama_skpd: r.nama_skpd,
          nama_sub_unit: r.nama_sub_unit,
          programs: new Map(),
        });
      }
      const unitGroup = skpdMap.get(unitKey)!;

      const progKey = `${r.kode_program}|${r.nama_program}`;
      if (!unitGroup.programs.has(progKey)) {
        unitGroup.programs.set(progKey, {
          kode_program: r.kode_program,
          nama_program: r.nama_program,
          kegiatans: new Map(),
        });
      }
      const progGroup = unitGroup.programs.get(progKey)!;

      const kegKey = `${r.kode_kegiatan}|${r.nama_kegiatan}`;
      if (!progGroup.kegiatans.has(kegKey)) {
        progGroup.kegiatans.set(kegKey, {
          kode_kegiatan: r.kode_kegiatan,
          nama_kegiatan: r.nama_kegiatan,
          subKegiatans: [],
        });
      }
      progGroup.kegiatans.get(kegKey)!.subKegiatans.push(r);
    });

    return Array.from(skpdMap.values());
  }, [filteredRows, viewMode]);

  const handleCopyCodeOnly = (item: KodeSipdItem) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(item.kode_sub_kegiatan);
      setCopiedId(`code-${item.sipd_id}`);
      setTimeout(() => setCopiedId(null), 1800);
      onShowToast('success', `Kode Sub Kegiatan "${item.kode_sub_kegiatan}" berhasil disalin.`);
    }
  };

  const handleCopyFullSipd = (item: KodeSipdItem) => {
    const text = [
      `SKPD: ${item.kode_skpd} - ${item.nama_skpd}`,
      `Sub Unit: ${item.kode_sub_unit} - ${item.nama_sub_unit}`,
      `Bidang Urusan: ${item.kode_bidang_urusan} - ${item.nama_bidang_urusan}`,
      `Program: ${item.kode_program} - ${item.nama_program}`,
      `Kegiatan: ${item.kode_kegiatan} - ${item.nama_kegiatan}`,
      `Sub Kegiatan: ${item.kode_sub_kegiatan} - ${item.nama_sub_kegiatan}`,
    ].join('\n');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(`full-${item.sipd_id}`);
      setTimeout(() => setCopiedId(null), 1800);
      onShowToast(
        'success',
        `Rincian lengkap Kode SIPD "${item.kode_sub_kegiatan}" disalin ke clipboard.`
      );
    }
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormNamaUrusan('URUSAN PEMERINTAHAN WAJIB YANG BERKAITAN DENGAN PELAYANAN DASAR');
    setFormKodeSkpd(selectedSkpd !== 'ALL' ? skpdOptions.find((s) => s.nama === selectedSkpd)?.kode || '' : '1.01.0.00.0.00.01.0000');
    setFormNamaSkpd(selectedSkpd !== 'ALL' ? selectedSkpd : activeOpd.nama_opd);
    setFormKodeSubUnit(selectedSkpd !== 'ALL' ? skpdOptions.find((s) => s.nama === selectedSkpd)?.kode || '' : '1.01.0.00.0.00.01.0000');
    setFormNamaSubUnit(selectedSubUnit !== 'ALL' ? selectedSubUnit : activeOpd.nama_opd);
    setFormKodeBidang('1.01');
    setFormNamaBidang('URUSAN PEMERINTAHAN DAERAH');
    setFormKodeProgram('1.01.02');
    setFormNamaProgram('');
    setFormKodeKegiatan('1.01.02.2.01');
    setFormNamaKegiatan('');
    setFormKodeSubKegiatan('1.01.02.2.01.0001');
    setFormNamaSubKegiatan('');
    setIsFormModalOpen(true);
  };

  const handleOpenEditModal = (item: KodeSipdItem) => {
    setEditingItem(item);
    setFormNamaUrusan(item.nama_urusan);
    setFormKodeSkpd(item.kode_skpd);
    setFormNamaSkpd(item.nama_skpd);
    setFormKodeSubUnit(item.kode_sub_unit);
    setFormNamaSubUnit(item.nama_sub_unit);
    setFormKodeBidang(item.kode_bidang_urusan);
    setFormNamaBidang(item.nama_bidang_urusan);
    setFormKodeProgram(item.kode_program);
    setFormNamaProgram(item.nama_program);
    setFormKodeKegiatan(item.kode_kegiatan);
    setFormNamaKegiatan(item.nama_kegiatan);
    setFormKodeSubKegiatan(item.kode_sub_kegiatan);
    setFormNamaSubKegiatan(item.nama_sub_kegiatan);
    setIsFormModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formKodeSubKegiatan.trim() || !formNamaSubKegiatan.trim()) {
      onShowToast('error', 'Kode Sub Kegiatan dan Nama Sub Kegiatan wajib diisi.');
      return;
    }

    SipdService.saveSipdItem({
      sipd_id: editingItem?.sipd_id || null,
      nama_urusan: formNamaUrusan,
      kode_skpd: formKodeSkpd,
      nama_skpd: formNamaSkpd,
      kode_sub_unit: formKodeSubUnit || formKodeSkpd,
      nama_sub_unit: formNamaSubUnit || formNamaSkpd,
      kode_bidang_urusan: formKodeBidang,
      nama_bidang_urusan: formNamaBidang,
      kode_program: formKodeProgram,
      nama_program: formNamaProgram,
      kode_kegiatan: formKodeKegiatan,
      nama_kegiatan: formNamaKegiatan,
      kode_sub_kegiatan: formKodeSubKegiatan,
      nama_sub_kegiatan: formNamaSubKegiatan,
    });

    setIsFormModalOpen(false);
    await reloadData();
    onShowToast(
      'success',
      editingItem
        ? `Kode SIPD "${formKodeSubKegiatan}" berhasil diperbarui.`
        : `Kode SIPD baru "${formKodeSubKegiatan}" berhasil ditambahkan.`
    );
  };

  const handleConfirmDelete = async () => {
    if (!deletingItem) return;
    SipdService.deleteSipdItem(deletingItem.sipd_id);
    const code = deletingItem.kode_sub_kegiatan;
    setDeletingItem(null);
    await reloadData();
    onShowToast('success', `Kode SIPD "${code}" berhasil dihapus dari daftar.`);
  };

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { importedCount, totalRawRows } = await SipdService.importFromFile(file, 'replace');
      await reloadData();
      if (importedCount > 0) {
        onShowToast(
          'success',
          `Berhasil memperbarui Master Kode SIPD dari "${file.name}" (${formatNumber(totalRawRows)} baris CSV · ${formatNumber(importedCount)} Sub Kegiatan unik).`
        );
      } else {
        onShowToast('error', 'Tidak ditemukan baris Kode SIPD yang valid pada file tersebut.');
      }
    } catch {
      onShowToast('error', 'Gagal membaca file CSV/Excel Kode SIPD.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleResetCustom = async () => {
    SipdService.resetCustomChanges();
    await reloadData();
    onShowToast('success', 'Data Kode SIPD berhasil di-0-kan (dikosongkan).');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    if (!isOpdRole) {
      setOnlyMyOpd(false);
    }
    setSelectedSkpd('ALL');
    setSelectedSubUnit('ALL');
    setSelectedBidang('ALL');
    setSelectedProgram('ALL');
    setSelectedKegiatan('ALL');
  };

  const hasActiveFilters =
    Boolean(searchQuery) ||
    (!isOpdRole && onlyMyOpd) ||
    selectedSkpd !== 'ALL' ||
    selectedSubUnit !== 'ALL' ||
    selectedBidang !== 'ALL' ||
    selectedProgram !== 'ALL' ||
    selectedKegiatan !== 'ALL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.22 }}
      className="space-y-5"
    >
      {/* HEADER BANNER KODE SIPD — 2 BARIS TERSTRUKTUR & RAPI */}
      <div className="rounded-3xl bg-gradient-to-br from-[#1E3A8A] via-[#1D4ED8] to-[#2563EB] text-white p-5 sm:p-6 shadow-[0_14px_34px_-12px_rgba(29,78,216,0.4)] relative overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          onChange={handleImportFileChange}
          className="hidden"
        />

        {/* Baris Atas: Judul & Aksi Utama */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2 max-w-4xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-bold tracking-wider uppercase whitespace-nowrap">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span>
                  {isOpdRole
                    ? `Kode SIPD Instansi · ${activeOpd.singkatan}`
                    : 'Referensi Master Nomenklatur SIPD RI · Kabupaten Blora'}
                </span>
              </span>

              {uploadedCsvMeta && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-400/20 border border-emerald-300/40 text-[11px] font-bold text-emerald-100 whitespace-nowrap">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                  <span>CSV Aktif: {uploadedCsvMeta.fileName}</span>
                </span>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug">
              {isOpdRole
                ? `Katalog Kode SIPD — ${activeOpd.nama_opd}`
                : 'Katalog Kode SIPD (Urusan, SKPD, Program, Kegiatan & Sub Kegiatan)'}
            </h2>

            <p className="text-xs sm:text-sm text-blue-100 leading-relaxed max-w-3xl">
              {isOpdRole
                ? `Daftar resmi Program, Kegiatan, dan Sub Kegiatan milik ${activeOpd.nama_opd}. Terisolasi otomatis per instansi agar tidak salah kamar saat pengisian Matriks.`
                : 'Basis data terpadu seluruh Kode Rekening SKPD, Sub Unit (Puskesmas, RSUD, Kecamatan, Kelurahan), Program, Kegiatan, dan Sub Kegiatan sesuai struktur SIPD Kabupaten Blora.'}
            </p>
          </div>

          {/* Grup Tombol Aksi Utama (Kanan Atas) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {userRole === 'ADMIN' && (
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 rounded-xl bg-white text-[#1D4ED8] hover:bg-blue-50 text-xs font-extrabold inline-flex items-center gap-1.5 shadow-sm transition-all cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span>Tambah Kode SIPD</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Lampirkan / Unggah file CSV atau Excel Kode SIPD terbaru"
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>Unggah CSV / Excel SIPD</span>
            </button>
          </div>
        </div>

        {/* Baris Bawah: Toolbar Sinkronisasi Cloud, Ekspor & Reset Data */}
        <div className="relative z-10 mt-4 pt-3.5 border-t border-white/15 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Layers className="w-3.5 h-3.5 text-blue-200 shrink-0" />
              <span>
                Tersimpan <strong className="text-white tabular-nums">{formatNumber(stats.totalUnique)}</strong> Sub Kegiatan pada{' '}
                <strong className="text-white tabular-nums">{formatNumber(stats.skpdCount)}</strong> SKPD
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleManualSyncSipdCloud}
              disabled={isSyncingSipdCloud}
              className="px-3.5 py-2 rounded-xl bg-amber-400/20 hover:bg-amber-400/30 border border-amber-300/40 text-amber-100 text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              title="Sinkronkan data Kode SIPD antara browser ini dan Cloud Firestore (optimis-97d75) untuk Vercel"
            >
              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncingSipdCloud ? 'animate-spin' : ''}`} />
              <span>{isSyncingSipdCloud ? 'Menyinkronkan...' : 'Sinkronkan Cloud'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                SipdService.exportToExcel(
                  filteredRows,
                  isOpdRole
                    ? activeOpd.singkatan.replace(/\s+/g, '_')
                    : selectedSkpd !== 'ALL'
                    ? selectedSkpd.replace(/\s+/g, '_')
                    : 'Kab_Blora'
                );
                onShowToast(
                  'success',
                  `Mengunduh ${formatNumber(filteredRows.length)} baris Kode SIPD ke Excel (.xlsx).`
                );
              }}
              className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />
              <span>Export Excel ({formatNumber(filteredRows.length)})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                SipdService.exportToCsv(
                  filteredRows,
                  isOpdRole
                    ? activeOpd.singkatan.replace(/\s+/g, '_')
                    : selectedSkpd !== 'ALL'
                    ? selectedSkpd.replace(/\s+/g, '_')
                    : 'Kab_Blora'
                );
                onShowToast(
                  'success',
                  `Mengunduh ${formatNumber(filteredRows.length)} baris Kode SIPD ke CSV (;).`
                );
              }}
              className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 border border-white/25 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
              title="Unduh Format CSV Titik Koma (;)"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>Unduh CSV</span>
            </button>

            {userRole === 'ADMIN' && (
              <button
                type="button"
                onClick={handleResetCustom}
                className="px-3 py-2 rounded-xl bg-rose-500/25 hover:bg-rose-500/40 border border-rose-300/40 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap shrink-0"
                title="Kosongkan / 0-kan Seluruh Data Kode SIPD"
              >
                <Trash2 className="w-3.5 h-3.5 shrink-0" />
                <span>0-kan Data</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 4 KARTU STATISTIK RINGKAS KODE SIPD (Animasi Hover Lift Dashboard V18) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 340, damping: 22 }}
          className="bg-white rounded-3xl border border-slate-200/80 hover:border-blue-300/80 p-4 shadow-xs hover:shadow-[0_18px_34px_-12px_rgba(37,99,235,0.16)] transition-shadow duration-300 flex items-start justify-between gap-3"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500">Master Sub Kegiatan Unik</p>
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 mt-1">
              {formatNumber(stats.totalUnique)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Dari total <strong className="text-slate-700 tabular-nums">{formatNumber(stats.totalAllCsv)}</strong> baris rincian CSV SIPD
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 340, damping: 22, delay: 0.04 }}
          className="bg-white rounded-3xl border border-slate-200/80 hover:border-indigo-300/80 p-4 shadow-xs hover:shadow-[0_18px_34px_-12px_rgba(79,70,229,0.16)] transition-shadow duration-300 flex items-start justify-between gap-3"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500">Cakupan SKPD & Sub Unit</p>
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 mt-1">
              {formatNumber(stats.skpdCount)}{' '}
              <span className="text-sm font-bold text-slate-500">SKPD</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Mencakup <strong className="text-[#2563EB] tabular-nums">{formatNumber(stats.subUnitCount)}</strong> Sub Unit / UPTD / Puskesmas / Kel.
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 340, damping: 22, delay: 0.08 }}
          className="bg-white rounded-3xl border border-slate-200/80 hover:border-emerald-300/80 p-4 shadow-xs hover:shadow-[0_18px_34px_-12px_rgba(16,185,129,0.16)] transition-shadow duration-300 flex items-start justify-between gap-3"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500">Total Program & Kegiatan</p>
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 mt-1">
              {formatNumber(stats.programCount)}{' '}
              <span className="text-sm font-bold text-slate-500">Program</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Terdiri atas <strong className="text-emerald-700 tabular-nums">{formatNumber(stats.kegiatanCount)}</strong> Kegiatan Daerah
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          whileHover={{ y: -5, scale: 1.01 }}
          transition={{ type: 'spring', stiffness: 340, damping: 22, delay: 0.12 }}
          className="bg-white rounded-3xl border border-slate-200/80 hover:border-amber-300/80 p-4 shadow-xs hover:shadow-[0_18px_34px_-12px_rgba(245,158,11,0.16)] transition-shadow duration-300 flex items-start justify-between gap-3"
        >
          <div>
            <p className="text-xs font-semibold text-slate-500">Nomenklatur Sub Kegiatan</p>
            <p className="text-2xl font-extrabold tabular-nums tracking-tight text-slate-900 mt-1">
              {formatNumber(stats.subKegiatanCount)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Siap disalin & dihubungkan langsung ke Matriks
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </motion.div>
      </div>

      {/* PANEL PENCARIAN & FILTER BERTINGKAT */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-xs space-y-4">
        {/* Baris 1: Pencarian Cepat + Kontrol Mode */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Kode Sub Kegiatan (contoh: 1.01.02.2.01.0003), Nama Sub Kegiatan, Program, Kegiatan, atau SKPD..."
              className="w-full pl-10 pr-9 py-2.5 text-xs font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB] focus:bg-white transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                title="Bersihkan kata kunci"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {isOpdRole && (
              <div className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1.5 whitespace-nowrap">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Instansi Aktif: {activeOpd.singkatan}</span>
              </div>
            )}

            {/* Toggle Master Unik vs Semua Baris CSV */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setDatasetMode('unique')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                  datasetMode === 'unique'
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Master Unik ({formatNumber(stats.totalUnique)})
              </button>
              <button
                type="button"
                onClick={() => setDatasetMode('all')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap tabular-nums ${
                  datasetMode === 'all'
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Baris ({formatNumber(stats.totalAllCsv)})
              </button>
            </div>

            {/* Toggle Tabel vs Hirarki */}
            <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'table'
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Table2 className="w-3.5 h-3.5 shrink-0" />
                <span>Tabel</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  viewMode === 'hierarchy'
                    ? 'bg-white text-[#1D4ED8] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FolderTree className="w-3.5 h-3.5 shrink-0" />
                <span>Hirarki</span>
              </button>
            </div>
          </div>
        </div>

        {/* Baris 2: Dropdown Filter Bertingkat */}
        {isOpdRole ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedProgram !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>1. Filter Program ({activeOpd.singkatan})</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {programOptions.length} Program
                </span>
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value);
                  setSelectedKegiatan('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua Program ({activeOpd.singkatan})</option>
                {programOptions.map((p) => (
                  <option key={`${p.kode}-${p.nama}`} value={p.nama}>
                    [{p.kode}] {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedKegiatan !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>2. Filter Kegiatan</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {kegiatanOptions.length} Kegiatan
                </span>
              </label>
              <select
                value={selectedKegiatan}
                onChange={(e) => setSelectedKegiatan(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua Kegiatan</option>
                {kegiatanOptions.map((k) => (
                  <option key={`${k.kode}-${k.nama}`} value={k.nama}>
                    [{k.kode}] {k.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            {/* 1. Filter SKPD Induk */}
            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedSkpd !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>1. SKPD Induk</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {skpdOptions.length} SKPD
                </span>
              </label>
              <select
                value={selectedSkpd}
                onChange={(e) => {
                  setSelectedSkpd(e.target.value);
                  setOnlyMyOpd(false);
                  setSelectedSubUnit('ALL');
                  setSelectedBidang('ALL');
                  setSelectedProgram('ALL');
                  setSelectedKegiatan('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua SKPD Kabupaten Blora</option>
                {skpdOptions.map((s) => (
                  <option key={s.nama} value={s.nama}>
                    {s.nama} ({s.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Filter Sub Unit */}
            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedSubUnit !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>2. Sub Unit / UPTD / Kel</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {subUnitOptions.length} Unit
                </span>
              </label>
              <select
                value={selectedSubUnit}
                onChange={(e) => {
                  setSelectedSubUnit(e.target.value);
                  setSelectedBidang('ALL');
                  setSelectedProgram('ALL');
                  setSelectedKegiatan('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua Sub Unit</option>
                {subUnitOptions.map((su) => (
                  <option key={su.nama} value={su.nama}>
                    {su.nama} ({su.count})
                  </option>
                ))}
              </select>
            </div>

            {/* 3. Filter Program */}
            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedProgram !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>3. Filter Program</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {programOptions.length} Program
                </span>
              </label>
              <select
                value={selectedProgram}
                onChange={(e) => {
                  setSelectedProgram(e.target.value);
                  setSelectedKegiatan('ALL');
                }}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua Program</option>
                {programOptions.map((p) => (
                  <option key={`${p.kode}-${p.nama}`} value={p.nama}>
                    [{p.kode}] {p.nama}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Filter Kegiatan */}
            <div
              className={`p-3 rounded-2xl border transition-colors ${
                selectedKegiatan !== 'ALL'
                  ? 'bg-blue-50/40 border-blue-300'
                  : 'bg-slate-50/70 border-slate-200/80'
              }`}
            >
              <label className="flex items-center justify-between text-[11px] font-bold text-slate-600 mb-1.5">
                <span>4. Filter Kegiatan</span>
                <span className="px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200/80 text-[10px] tabular-nums">
                  {kegiatanOptions.length} Kegiatan
                </span>
              </label>
              <select
                value={selectedKegiatan}
                onChange={(e) => setSelectedKegiatan(e.target.value)}
                className="w-full px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
              >
                <option value="ALL">Semua Kegiatan</option>
                {kegiatanOptions.map((k) => (
                  <option key={`${k.kode}-${k.nama}`} value={k.nama}>
                    [{k.kode}] {k.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Info Bar Hasil Filter & Reset */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-slate-100 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-600">
            <span>
              Menampilkan{' '}
              <strong className="text-slate-900 tabular-nums font-bold">
                {formatNumber(filteredRows.length)}
              </strong>{' '}
              baris Kode SIPD {isOpdRole ? `khusus ${activeOpd.nama_opd}` : ''}
            </span>

            {selectedSkpd !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-blue-50 text-[#1D4ED8] font-bold text-[11px] border border-blue-200/70">
                <span>SKPD: {selectedSkpd}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedSkpd('ALL');
                    setSelectedSubUnit('ALL');
                  }}
                  className="hover:text-blue-900 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 font-bold text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                Reset Semua Filter
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-500">Baris per halaman:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-bold text-slate-800 cursor-pointer"
            >
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
              <option value={100}>100 baris</option>
            </select>
          </div>
        </div>
      </div>

      {/* KONTEN UTAMA: TABEL ATAU HIRARKI */}
      {isLoading ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-[#2563EB] flex items-center justify-center mx-auto animate-spin">
            <RefreshCw className="w-5 h-5" />
          </div>
          <p className="text-sm font-bold text-slate-800">
            Memuat Referensi Kode SIPD Kabupaten Blora...
          </p>
          <p className="text-xs text-slate-500">
            Mengindeks SKPD, Sub Unit, Program, Kegiatan, dan Sub Kegiatan dari CSV SIPD.
          </p>
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
          {uniqueRows.length === 0 ? (
            <>
              <p className="text-sm font-bold text-slate-800">
                Data Kode SIPD Saat Ini Kosong (0 Data)
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Seluruh data Kode SIPD telah di-0-kan. Silakan lampirkan atau unggah file CSV / Excel Kode SIPD untuk mengisi daftar Program, Kegiatan, dan Sub Kegiatan sesuai masing-masing instansi.
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Upload className="w-4 h-4" />
                  <span>Unggah CSV / Excel Kode SIPD</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm font-bold text-slate-800">
                Tidak ditemukan Kode SIPD yang cocok dengan kriteria pencarian
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Coba ubah kata kunci pencarian atau tekan tombol Reset Semua Filter untuk menampilkan seluruh referensi Kode SIPD.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-4 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-bold cursor-pointer"
              >
                Reset Filter Pencarian
              </button>
            </>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#F8FAFF] border-b border-slate-200/90 text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
                  <th className="py-3.5 px-3 w-12 text-center">No</th>
                  <th className="py-3.5 px-4 w-[24%] min-w-[200px]">Instansi / Sub Unit</th>
                  <th className="py-3.5 px-4 w-[33%] min-w-[260px]">Program & Kegiatan</th>
                  <th className="py-3.5 px-4 w-[27%] min-w-[230px]">Kode & Nama Sub Kegiatan</th>
                  <th className="py-3.5 px-4 w-[16%] min-w-[155px] text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedRows.map((row, idx) => {
                  const rowNum = (currentPage - 1) * pageSize + idx + 1;
                  const isDifferentSubUnit =
                    row.nama_sub_unit && row.nama_sub_unit !== row.nama_skpd;

                  return (
                    <tr
                      key={row.sipd_id}
                      className="hover:bg-blue-50/35 transition-colors align-top group/row"
                    >
                      <td className="py-4 px-3 text-center tabular-nums text-slate-400 font-bold">
                        {rowNum}
                      </td>

                      {/* Kolom 1: Instansi / Sub Unit */}
                      <td className="py-4 px-4 space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono text-[10.5px] font-semibold">
                            {row.kode_sub_unit || row.kode_skpd}
                          </span>
                          {row.is_custom && (
                            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold">
                              Kustom
                            </span>
                          )}
                        </div>
                        <p className="font-bold text-slate-900 leading-snug">
                          {row.nama_sub_unit || row.nama_skpd}
                        </p>
                        {isDifferentSubUnit && (
                          <p className="text-[11px] text-slate-500 leading-snug">
                            Induk: <span className="font-medium text-slate-700">{row.nama_skpd}</span>
                          </p>
                        )}
                        <p className="text-[10.5px] text-slate-400 leading-snug">
                          [{row.kode_bidang_urusan}] {row.nama_bidang_urusan}
                        </p>
                      </td>

                      {/* Kolom 2: Program & Kegiatan (Terstruktur 2 Tingkat) */}
                      <td className="py-4 px-4 space-y-2.5">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                              Program
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono text-[10.5px] font-bold border border-indigo-200/60">
                              {row.kode_program}
                            </span>
                          </div>
                          <p className="font-semibold text-slate-800 leading-snug">
                            {row.nama_program}
                          </p>
                        </div>

                        <div className="pl-2.5 border-l-2 border-emerald-200 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                              Kegiatan
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[10.5px] font-bold border border-emerald-200/60">
                              {row.kode_kegiatan}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-snug">{row.nama_kegiatan}</p>
                        </div>
                      </td>

                      {/* Kolom 3: Kode & Nama Sub Kegiatan */}
                      <td className="py-4 px-4 space-y-2">
                        <div>
                          <button
                            type="button"
                            onClick={() => handleCopyCodeOnly(row)}
                            title="Klik untuk menyalin Kode Sub Kegiatan"
                            className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-[#2563EB] text-[#1D4ED8] hover:text-white border border-blue-200/80 font-mono text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap"
                          >
                            <span>{row.kode_sub_kegiatan}</span>
                            {copiedId === `code-${row.sipd_id}` ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-sans font-bold text-emerald-600 group-hover:text-white">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                Tersalin
                              </span>
                            ) : (
                              <Copy className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 shrink-0" />
                            )}
                          </button>
                        </div>
                        <p className="font-bold text-slate-900 text-[13px] leading-snug">
                          {row.nama_sub_kegiatan}
                        </p>
                      </td>

                      {/* Kolom 4: Aksi Cepat */}
                      <td className="py-4 px-4 text-right">
                        <div className="flex flex-col items-end gap-2">
                          <button
                            type="button"
                            onClick={() => onUseSipdInMatrix(row)}
                            className="px-3 py-1.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold inline-flex items-center gap-1 shadow-xs transition-all cursor-pointer whitespace-nowrap shrink-0"
                            title="Gunakan Kode & Nomenklatur ini untuk Input Data Matriks"
                          >
                            <span>Pakai ke Matriks</span>
                            <ArrowUpRight className="w-3.5 h-3.5 shrink-0" />
                          </button>

                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setDetailItem(row)}
                              className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                              title="Lihat Detail 13 Kolom SIPD"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detail</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleCopyFullSipd(row)}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
                              title="Salin Lengkap (SKPD, Program, Kegiatan & Sub Kegiatan)"
                            >
                              {copiedId === `full-${row.sipd_id}` ? (
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {userRole === 'ADMIN' && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditModal(row)}
                                  className="p-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 transition-colors cursor-pointer"
                                  title="Edit Kode SIPD"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingItem(row)}
                                  className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors cursor-pointer"
                                  title="Hapus Kode SIPD"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* FOOTER PAGINASI TABEL */}
          <div className="px-4 py-3.5 bg-[#F8FAFF] border-t border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <p className="text-slate-600">
              Menampilkan baris{' '}
              <strong className="text-slate-900 tabular-nums">
                {formatNumber((currentPage - 1) * pageSize + 1)}
              </strong>{' '}
              –{' '}
              <strong className="text-slate-900 tabular-nums">
                {formatNumber(Math.min(currentPage * pageSize, filteredRows.length))}
              </strong>{' '}
              dari total{' '}
              <strong className="text-[#1D4ED8] tabular-nums">{formatNumber(filteredRows.length)}</strong> data
            </p>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              <span className="px-3 py-1.5 rounded-xl bg-blue-50 text-[#1D4ED8] tabular-nums font-bold border border-blue-200/70 whitespace-nowrap">
                Hal {currentPage} / {formatNumber(totalPages)}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold disabled:opacity-40 hover:bg-slate-50 inline-flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap"
              >
                <span>Berikutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* MODE HIRARKI POHON (SKPD -> PROGRAM -> KEGIATAN -> SUB KEGIATAN) */
        <div className="space-y-4">
          {filteredRows.length > 300 && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200/80 text-xs text-[#1D4ED8] flex items-center justify-between gap-2">
              <span>
                Mode Hirarki menampilkan <strong>300</strong> sub kegiatan pertama agar tetap ringan. Gunakan filter SKPD atau pencarian di atas untuk mempersempit tampilan pohon.
              </span>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className="px-3 py-1 rounded-lg bg-[#2563EB] text-white font-bold shrink-0 cursor-pointer"
              >
                Buka Mode Tabel Penuh
              </button>
            </div>
          )}

          {hierarchyGroups.map((unit) => (
            <div
              key={`${unit.kode_skpd}-${unit.nama_sub_unit}`}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden"
            >
              <div className="px-5 py-3.5 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <span className="font-mono text-[11px] text-blue-300 font-semibold mr-2">
                      {unit.kode_skpd}
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold">
                      {unit.nama_sub_unit}
                    </span>
                    {unit.nama_sub_unit !== unit.nama_skpd && (
                      <span className="text-[11px] text-slate-300 ml-2">
                        (Induk: {unit.nama_skpd})
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-white/15">
                  {unit.programs.size} Program
                </span>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {Array.from(unit.programs.values()).map((prog) => (
                  <div
                    key={`${prog.kode_program}-${prog.nama_program}`}
                    className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-3.5 space-y-3"
                  >
                    <div className="flex items-start gap-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-mono text-[11px] font-bold shrink-0">
                        PROGRAM {prog.kode_program}
                      </span>
                      <p className="text-xs font-extrabold text-slate-900 leading-snug">
                        {prog.nama_program}
                      </p>
                    </div>

                    <div className="space-y-2.5 pl-2 sm:pl-4 border-l-2 border-indigo-200">
                      {Array.from(prog.kegiatans.values()).map((keg) => (
                        <div
                          key={`${keg.kode_kegiatan}-${keg.nama_kegiatan}`}
                          className="bg-white rounded-xl border border-slate-200/80 p-3 space-y-2"
                        >
                          <div className="flex items-start gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono text-[10.5px] font-bold shrink-0">
                              KEGIATAN {keg.kode_kegiatan}
                            </span>
                            <p className="text-xs font-bold text-slate-800 leading-snug">
                              {keg.nama_kegiatan}
                            </p>
                          </div>

                          <div className="divide-y divide-slate-100 pt-1">
                            {keg.subKegiatans.map((sub) => (
                              <div
                                key={sub.sipd_id}
                                className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                              >
                                <div className="flex items-start gap-2 min-w-0">
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCodeOnly(sub)}
                                    className="px-2 py-0.5 rounded-md bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] font-mono text-[11px] font-extrabold border border-blue-200/70 shrink-0 cursor-pointer"
                                    title="Klik untuk salin kode"
                                  >
                                    {sub.kode_sub_kegiatan}
                                  </button>
                                  <span className="font-medium text-slate-800 leading-snug">
                                    {sub.nama_sub_kegiatan}
                                  </span>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                                  <button
                                    type="button"
                                    onClick={() => onUseSipdInMatrix(sub)}
                                    className="px-2.5 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  >
                                    <span>Pakai ke Matriks</span>
                                    <ArrowUpRight className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyFullSipd(sub)}
                                    className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                                    title="Salin lengkap"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DETAIL 13 KOLOM KODE SIPD */}
      <AnimatePresence>
        {detailItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setDetailItem(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-mono uppercase text-blue-200">
                    Detail Referensi 13 Kolom SIPD
                  </span>
                  <h3 className="text-base font-extrabold mt-0.5">
                    {detailItem.kode_sub_kegiatan}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-3 text-xs max-h-[75vh] overflow-y-auto">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    1. Nama Urusan Pemerintahan
                  </span>
                  <p className="font-bold text-slate-900">{detailItem.nama_urusan}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      2–3. Kode & Nama SKPD
                    </span>
                    <p className="font-mono font-bold text-[#1D4ED8]">
                      {detailItem.kode_skpd}
                    </p>
                    <p className="font-bold text-slate-900">{detailItem.nama_skpd}</p>
                  </div>

                  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      4–5. Kode & Nama Sub Unit
                    </span>
                    <p className="font-mono font-bold text-[#1D4ED8]">
                      {detailItem.kode_sub_unit}
                    </p>
                    <p className="font-bold text-slate-900">{detailItem.nama_sub_unit}</p>
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    6–7. Kode & Nama Bidang Urusan
                  </span>
                  <p className="font-bold text-slate-900">
                    <span className="font-mono text-[#1D4ED8] mr-2">
                      [{detailItem.kode_bidang_urusan}]
                    </span>
                    {detailItem.nama_bidang_urusan}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-indigo-50/60 border border-indigo-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-indigo-500 uppercase">
                    8–9. Kode & Nama Program
                  </span>
                  <p className="font-bold text-slate-900">
                    <span className="font-mono text-indigo-700 mr-2">
                      [{detailItem.kode_program}]
                    </span>
                    {detailItem.nama_program}
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/70 space-y-1">
                  <span className="text-[10px] font-bold text-emerald-600 uppercase">
                    10–11. Kode & Nama Kegiatan
                  </span>
                  <p className="font-bold text-slate-900">
                    <span className="font-mono text-emerald-700 mr-2">
                      [{detailItem.kode_kegiatan}]
                    </span>
                    {detailItem.nama_kegiatan}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 space-y-1">
                  <span className="text-[10px] font-bold text-[#2563EB] uppercase">
                    12–13. Kode & Nama Sub Kegiatan
                  </span>
                  <p className="font-mono text-sm font-extrabold text-[#1D4ED8]">
                    {detailItem.kode_sub_kegiatan}
                  </p>
                  <p className="text-sm font-bold text-slate-900">
                    {detailItem.nama_sub_kegiatan}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyFullSipd(detailItem)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-4 h-4" />
                  <span>Salin Rincian SIPD</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const target = detailItem;
                      setDetailItem(null);
                      onUseSipdInMatrix(target);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Gunakan di Input Matriks</span>
                    <ArrowUpRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL TAMBAH / EDIT KODE SIPD (KHUSUS ADMIN) */}
      <AnimatePresence>
        {isFormModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          >
            <motion.form
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onSubmit={handleSubmitForm}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#1E3A8A] to-[#2563EB] text-white flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold">
                    {editingItem ? 'Edit Referensi Kode SIPD' : 'Tambah Referensi Kode SIPD Baru'}
                  </h3>
                  <p className="text-xs text-blue-100">
                    Sesuaikan struktur kode dan nomenklatur SKPD, Program, Kegiatan, serta Sub Kegiatan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Nama Urusan Pemerintahan
                  </label>
                  <input
                    type="text"
                    value={formNamaUrusan}
                    onChange={(e) => setFormNamaUrusan(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kode SKPD</label>
                    <input
                      type="text"
                      value={formKodeSkpd}
                      onChange={(e) => setFormKodeSkpd(e.target.value)}
                      placeholder="1.01.0.00.0.00.01.0000"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama SKPD Induk <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaSkpd}
                      onChange={(e) => setFormNamaSkpd(e.target.value)}
                      placeholder="DINAS PENDIDIKAN"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">Kode Sub Unit</label>
                    <input
                      type="text"
                      value={formKodeSubUnit}
                      onChange={(e) => setFormKodeSubUnit(e.target.value)}
                      placeholder="1.01.0.00.0.00.01.0000"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Sub Unit (UPTD / Puskesmas / Kelurahan)
                    </label>
                    <input
                      type="text"
                      value={formNamaSubUnit}
                      onChange={(e) => setFormNamaSubUnit(e.target.value)}
                      placeholder="Kosongkan jika sama dengan Nama SKPD Induk"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kode Bidang Urusan
                    </label>
                    <input
                      type="text"
                      value={formKodeBidang}
                      onChange={(e) => setFormKodeBidang(e.target.value)}
                      placeholder="1.01"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Bidang Urusan
                    </label>
                    <input
                      type="text"
                      value={formNamaBidang}
                      onChange={(e) => setFormNamaBidang(e.target.value)}
                      placeholder="URUSAN PEMERINTAHAN BIDANG PENDIDIKAN"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kode Program <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formKodeProgram}
                      onChange={(e) => setFormKodeProgram(e.target.value)}
                      placeholder="1.01.02"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Program <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaProgram}
                      onChange={(e) => setFormNamaProgram(e.target.value)}
                      placeholder="PROGRAM PENGELOLAAN PENDIDIKAN"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kode Kegiatan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formKodeKegiatan}
                      onChange={(e) => setFormKodeKegiatan(e.target.value)}
                      placeholder="1.01.02.2.01"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-mono"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Kegiatan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaKegiatan}
                      onChange={(e) => setFormNamaKegiatan(e.target.value)}
                      placeholder="Pengelolaan Pendidikan Sekolah Dasar"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Kode Sub Kegiatan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formKodeSubKegiatan}
                      onChange={(e) => setFormKodeSubKegiatan(e.target.value)}
                      placeholder="1.01.02.2.01.0003"
                      className="w-full px-3.5 py-2 rounded-xl border border-blue-300 bg-blue-50/40 font-mono font-bold text-[#1D4ED8]"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block font-bold text-slate-700 mb-1">
                      Nama Sub Kegiatan <span className="text-rose-600">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={formNamaSubKegiatan}
                      onChange={(e) => setFormNamaSubKegiatan(e.target.value)}
                      placeholder="Pembangunan Ruang Guru/Kepala Sekolah/TU"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-200 font-semibold"
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200/80 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold cursor-pointer"
                >
                  Simpan Kode SIPD
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS KODE SIPD */}
      <AnimatePresence>
        {deletingItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Hapus Baris Kode SIPD?
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {deletingItem.kode_sub_kegiatan}
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Apakah Anda yakin ingin menghapus sub kegiatan{' '}
                <strong className="text-slate-900">"{deletingItem.nama_sub_kegiatan}"</strong> pada{' '}
                <strong>{deletingItem.nama_sub_unit || deletingItem.nama_skpd}</strong>?
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingItem(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer"
                >
                  Ya, Hapus
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
