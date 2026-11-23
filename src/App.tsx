/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutGrid,
  Layers,
  ShieldCheck,
  FileSpreadsheet,
  CalendarCog,
  History,
  Menu,
  CheckCircle2,
  AlertCircle,
  Bell,
  ChevronDown,
  LogOut,
  Users,
  Calendar,
  BookOpen,
  Trash2,
} from 'lucide-react';
import {
  AuditLog,
  AuthUser,
  EnrichedMatrixRow,
  KodeSipdItem,
  NavTab,
  OPD,
  PeriodePelaporan,
  SemesterNumber,
  SifatBantuan,
} from './types/oppkpke';
import { DatabaseService } from './services/databaseService';
import { DashboardView } from './components/DashboardView';
import { MatriksTableView } from './components/MatriksTableView';
import { VerificationView } from './components/VerificationView';
import { ReportsExportView } from './components/ReportsExportView';
import { SystemGovernanceView } from './components/SystemGovernanceView';
import { UserManagementView } from './components/UserManagementView';
import { KodeSipdView } from './components/KodeSipdView';
import { LoginView } from './components/LoginView';
import { MatrixInputModal } from './components/MatrixInputModal';
import { DashboardSkeleton } from './components/ui/SkeletonLoader';
import {
  BloraShieldLogo,
  DefaultProfileAvatar,
  SidebarMonumentSilhouette,
} from './components/ui/BloraVisuals';
import { ParsedExcelBaseRow } from './utils/excelService';
import { formatDateTimeID } from './utils/formatters';
import { auth, onAuthStateChanged, User } from './firebase';

interface ToastMessage {
  id: string;
  type: 'success' | 'error';
  text: string;
}

const FALLBACK_EMPTY_OPD: OPD = {
  opd_id: 'opd-none',
  kode_opd: '-',
  nama_opd: 'Belum Ada Instansi / OPD',
  singkatan: 'BELUM ADA OPD',
  kategori: 'OPD/Dinas/Badan',
  kepala_opd: '-',
};

const FALLBACK_DEFAULT_PERIODE: PeriodePelaporan = {
  periode_id: 'per-2026',
  tahun: 2026,
  nama_periode: 'Tahun Anggaran 2026',
  semester_1_buka: true,
  semester_2_buka: true,
  batas_semester_1: '2026-07-15',
  batas_semester_2: '2027-01-15',
  is_active: true,
  updated_at: '2026-01-01T00:00:00.000Z',
};

export default function App() {
  const [refreshTick, setRefreshTick] = useState(0);
  const allUsers = useMemo(() => DatabaseService.getUsersList(), [refreshTick]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() =>
    DatabaseService.getCurrentSessionUser()
  );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(() => auth.currentUser);

  // State Database Utama
  const [periodes, setPeriodes] = useState<PeriodePelaporan[]>(() =>
    DatabaseService.getPeriodeList()
  );
  const allOpds: OPD[] = useMemo(() => DatabaseService.getOpdList(), [refreshTick]);
  const [activePeriodeId, setActivePeriodeId] = useState<string>(() => {
    const list = DatabaseService.getPeriodeList();
    const active = list.find((p) => p.is_active) || list[0] || FALLBACK_DEFAULT_PERIODE;
    return active.periode_id;
  });
  const [selectedSemesterFilter, setSelectedSemesterFilter] = useState<
    'S1' | 'S2' | 'TAHUNAN'
  >('S1');

  // Navigasi & State Popout Modal Input Matriks
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [editingMatrixRow, setEditingMatrixRow] = useState<EnrichedMatrixRow | null>(null);
  const [prefillSipdItem, setPrefillSipdItem] = useState<KodeSipdItem | null>(null);

  // State UI (Sidebar Show/Hide, Dropdown Profil, Dropdown Notifikasi, Skeleton, Toast)
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [hoveredNavId, setHoveredNavId] = useState<NavTab | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [seenNotifIds, setSeenNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('e_oppkpke_blora_seen_notifs_v1');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [clearedNotifIds, setClearedNotifIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('e_oppkpke_blora_cleared_notifs_v1');
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [isLoadingView, setIsLoadingView] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Listener autentikasi Firebase & langganan real-time Firestore (onSnapshot) lintas sesi/perangkat
  useEffect(() => {
    const handleRealtimeRefresh = () => {
      setPeriodes(DatabaseService.getPeriodeList());
      setRefreshTick((t) => t + 1);
      setCurrentUser((prev) => {
        if (!prev) return null;
        const latestUsers = DatabaseService.getUsersList();
        const updatedSelf = latestUsers.find(
          (u) =>
            u.user_id === prev.user_id ||
            u.username.toLowerCase() === prev.username.toLowerCase()
        );
        if (updatedSelf) {
          DatabaseService.setSessionUser(updatedSelf);
          return updatedSelf;
        }
        if (prev.role !== 'ADMIN') {
          DatabaseService.setSessionUser(null);
          return null;
        }
        return prev;
      });
    };

    let unsubFirestore = DatabaseService.subscribeToFirestore(handleRealtimeRefresh);

    const unsubAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);
      unsubFirestore();
      unsubFirestore = DatabaseService.subscribeToFirestore(handleRealtimeRefresh);
    });

    return () => {
      unsubAuth();
      unsubFirestore();
    };
  }, []);

  const activeSemesterNum: 1 | 2 = selectedSemesterFilter === 'S2' ? 2 : 1;

  const showToast = (type: 'success' | 'error', text: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  };

  const activePeriode = useMemo(() => {
    return (
      periodes.find((p) => p.periode_id === activePeriodeId) ||
      periodes[0] ||
      FALLBACK_DEFAULT_PERIODE
    );
  }, [periodes, activePeriodeId]);

  const userRole = currentUser?.role || 'OPD';

  const activeOpd = useMemo(() => {
    if (currentUser?.opd_id) {
      return (
        allOpds.find((o) => o.opd_id === currentUser.opd_id) ||
        allOpds[0] ||
        FALLBACK_EMPTY_OPD
      );
    }
    return allOpds[0] || FALLBACK_EMPTY_OPD;
  }, [allOpds, currentUser]);

  // Seluruh baris untuk keperluan rekapitulasi lintas OPD pada Dashboard
  const allRowsForRecap: EnrichedMatrixRow[] = useMemo(() => {
    return DatabaseService.getEnrichedMatrixRows(activePeriode.periode_id);
  }, [activePeriode.periode_id, refreshTick]);

  // Baris matriks sesuai hak akses pengguna yang sedang login
  const enrichedRows: EnrichedMatrixRow[] = useMemo(() => {
    const opdFilter = userRole === 'OPD' ? activeOpd.opd_id : undefined;
    return DatabaseService.getEnrichedMatrixRows(activePeriode.periode_id, opdFilter);
  }, [activePeriode.periode_id, userRole, activeOpd.opd_id, refreshTick]);

  const auditLogs: AuditLog[] = useMemo(() => {
    const logs = DatabaseService.getAuditLogs();
    if (userRole === 'OPD') {
      return logs.filter((l) => l.opd_id === activeOpd.opd_id || l.opd_id === 'ALL');
    }
    return logs;
  }, [userRole, activeOpd.opd_id, refreshTick]);

  const visibleNotifLogs = useMemo(() => {
    const clearedSet = new Set(clearedNotifIds);
    return auditLogs.filter((l) => !clearedSet.has(l.log_id));
  }, [auditLogs, clearedNotifIds]);

  const unreadNotifCount = useMemo(() => {
    const seenSet = new Set(seenNotifIds);
    return visibleNotifLogs.filter((l) => !seenSet.has(l.log_id)).length;
  }, [visibleNotifLogs, seenNotifIds]);

  const handleToggleNotifMenu = () => {
    setNotifMenuOpen((prev) => !prev);
    setProfileMenuOpen(false);
    if (auditLogs.length > 0) {
      setSeenNotifIds((prev) => {
        const merged = Array.from(new Set([...prev, ...auditLogs.map((l) => l.log_id)]));
        try {
          localStorage.setItem('e_oppkpke_blora_seen_notifs_v1', JSON.stringify(merged));
        } catch {
          // ignore storage error
        }
        return merged;
      });
    }
  };

  const handleClearNotifications = () => {
    if (auditLogs.length === 0) return;
    const allIds = auditLogs.map((l) => l.log_id);
    setClearedNotifIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('e_oppkpke_blora_cleared_notifs_v1', JSON.stringify(merged));
      } catch {
        // ignore storage error
      }
      return merged;
    });
    setSeenNotifIds((prev) => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      try {
        localStorage.setItem('e_oppkpke_blora_seen_notifs_v1', JSON.stringify(merged));
      } catch {
        // ignore storage error
      }
      return merged;
    });
  };

  const triggerSmoothReload = (callback: () => void) => {
    setIsLoadingView(true);
    callback();
    setTimeout(() => {
      setIsLoadingView(false);
    }, 240);
  };

  const handleSelectTab = (nextTab: NavTab) => {
    if (nextTab === activeTab) return;
    setProfileMenuOpen(false);
    setNotifMenuOpen(false);
    setIsLoadingView(true);
    setActiveTab(nextTab);
    setTimeout(() => {
      setIsLoadingView(false);
    }, 240);
  };

  // Handlers Autentikasi Login & Logout
  const handleLoginCredentials = (username: string, password: string) => {
    const res = DatabaseService.authenticateUser(username, password);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setActiveTab('dashboard');
      showToast('success', res.message);
    }
    return { success: res.success, message: res.message };
  };

  const handleQuickDemoLogin = (user: AuthUser) => {
    const res = DatabaseService.authenticateUser(user.username, user.password_hint);
    const activeUser = res.user || user;
    DatabaseService.setSessionUser(activeUser);
    triggerSmoothReload(() => {
      setCurrentUser(activeUser);
      setActiveTab('dashboard');
    });
    showToast('success', `Masuk sebagai ${activeUser.display_name} (${activeUser.instansi_label}).`);
  };

  const handleLogout = () => {
    DatabaseService.setSessionUser(null);
    setProfileMenuOpen(false);
    setNotifMenuOpen(false);
    setCurrentUser(null);
    showToast('success', 'Anda telah keluar dari sistem OPTIMIS.');
  };

  // Handler Buka Popout Modal Input / Edit Data Matriks
  const handleOpenInputModal = (row: EnrichedMatrixRow | null) => {
    setEditingMatrixRow(row);
    setPrefillSipdItem(null);
    setIsInputModalOpen(true);
  };

  const handleUseSipdInMatrix = (sipdItem: KodeSipdItem) => {
    setEditingMatrixRow(null);
    setPrefillSipdItem(sipdItem);
    setIsInputModalOpen(true);
    showToast(
      'success',
      `Kode SIPD "${sipdItem.kode_sub_kegiatan}" dimuat ke Formulir Input Matriks.`
    );
  };

  const handleSaveMatrixModal = (params: {
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
  }) => {
    const actorName = currentUser?.display_name || `Operator ${activeOpd.singkatan}`;
    const res = DatabaseService.saveOpdMatrixAndRealisasi({
      ...params,
      userRole,
      userName: actorName,
      isAutosave: false,
    });
    setRefreshTick((t) => t + 1);
    showToast(res.success ? 'success' : 'error', res.message);
  };

  const handleVerifySemester = (params: {
    matrix_id: string;
    semester: SemesterNumber;
    decision: 'Terverifikasi' | 'Perlu Perbaikan' | 'Menunggu Verifikasi';
    catatan_verifikator: string;
  }) => {
    const res = DatabaseService.verifySemester({
      ...params,
      verifierName: currentUser?.display_name || 'Tim Verifikasi Bapperida Blora',
    });
    setRefreshTick((t) => t + 1);
    showToast(res.success ? 'success' : 'error', res.message);
  };

  const handleImportExcelRows = (parsedRows: ParsedExcelBaseRow[]) => {
    const { importedCount } = DatabaseService.importBaseMatrixFromExcel(
      activePeriode.periode_id,
      parsedRows,
      currentUser?.display_name || 'Operator Sistem',
      userRole === 'OPD' ? activeOpd.opd_id : undefined
    );
    setRefreshTick((t) => t + 1);
    showToast(
      'success',
      `Berhasil mengimpor ${importedCount} baris program/kegiatan dari Excel.`
    );
  };

  const handleUpdatePeriodeSettings = (
    periodeId: string,
    updates: Partial<
      Pick<
        PeriodePelaporan,
        'semester_1_buka' | 'semester_2_buka' | 'batas_semester_1' | 'batas_semester_2'
      >
    >
  ) => {
    const updatedList = DatabaseService.updatePeriodeSettings(
      periodeId,
      updates,
      currentUser?.display_name || 'Admin Bapperida Blora'
    );
    setPeriodes(updatedList);
    setRefreshTick((t) => t + 1);
    showToast('success', 'Pengaturan periode pelaporan semester berhasil diperbarui.');
  };

  const handleCreateNewYear = (tahunBaru: number, copyFromPeriodeId: string | null) => {
    const res = DatabaseService.createNewYearPeriode(
      tahunBaru,
      copyFromPeriodeId,
      currentUser?.display_name || 'Admin Bapperida Blora'
    );
    if (res.success && res.periode) {
      setPeriodes(DatabaseService.getPeriodeList());
      setActivePeriodeId(res.periode.periode_id);
      setRefreshTick((t) => t + 1);
      showToast('success', res.message);
    } else {
      showToast('error', res.message);
    }
  };

  const handleResetDatabase = () => {
    DatabaseService.resetToSeedData();
    setPeriodes(DatabaseService.getPeriodeList());
    setActivePeriodeId('per-2026');
    setRefreshTick((t) => t + 1);
    showToast('success', 'Database berhasil dikembalikan ke data awal Kabupaten Blora.');
  };

  // Apabila belum login, tampilkan halaman LoginView
  if (!currentUser) {
    return (
      <>
        <LoginView
          users={allUsers}
          onLoginCredentials={handleLoginCredentials}
          onQuickDemoLogin={handleQuickDemoLogin}
        />
        {/* Toast pada layar login */}
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="pointer-events-auto flex items-start gap-2.5 p-4 rounded-2xl bg-white border border-slate-200 shadow-lg text-xs font-medium text-slate-900"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t.text}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </>
    );
  }

  // Urutan Menu Sesuai Instruksi:
  // 1. Dashboard, 2. Data Matriks, 3. Verifikasi, 4. Laporan, 5. Pengaturan Periode, 6. Riwayat & Audit Log, 7. Kode SIPD (di atas Manajemen User), 8. Manajemen User
  const sidebarNavItems: {
    id: NavTab;
    label: string;
    shortLabel: string;
    icon: React.ReactNode;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      shortLabel: 'Dashboard',
      icon: <LayoutGrid className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'matriks',
      label: 'Data Matriks',
      shortLabel: 'Matriks',
      icon: <Layers className="w-5 h-5 shrink-0" />,
    },
    ...(userRole === 'ADMIN'
      ? [
          {
            id: 'verifikasi' as NavTab,
            label: 'Verifikasi',
            shortLabel: 'Verifikasi',
            icon: <ShieldCheck className="w-5 h-5 shrink-0" />,
          },
        ]
      : []),
    {
      id: 'laporan-export',
      label: 'Laporan',
      shortLabel: 'Laporan',
      icon: <FileSpreadsheet className="w-5 h-5 shrink-0" />,
    },
    ...(userRole === 'ADMIN'
      ? [
          {
            id: 'pengaturan-periode' as NavTab,
            label: 'Pengaturan Periode',
            shortLabel: 'Periode',
            icon: <CalendarCog className="w-5 h-5 shrink-0" />,
          },
        ]
      : []),
    {
      id: 'audit-log',
      label: 'Riwayat & Audit Log',
      shortLabel: 'Riwayat',
      icon: <History className="w-5 h-5 shrink-0" />,
    },
    {
      id: 'kode-sipd',
      label: 'Kode SIPD',
      shortLabel: 'Kode SIPD',
      icon: <BookOpen className="w-5 h-5 shrink-0" />,
    },
    ...(userRole === 'ADMIN'
      ? [
          {
            id: 'manajemen-user' as NavTab,
            label: 'Manajemen User',
            shortLabel: 'User',
            icon: <Users className="w-5 h-5 shrink-0" />,
          },
        ]
      : []),
  ];

  const pageHeadingTitle = (() => {
    const menuLabel = (() => {
      if (activeTab === 'dashboard') return 'Dashboard';
      if (activeTab === 'matriks') return 'Data Matriks';
      if (activeTab === 'verifikasi') return 'Verifikasi';
      if (activeTab === 'laporan-export') return 'Laporan';
      if (activeTab === 'pengaturan-periode') return 'Pengaturan Periode';
      if (activeTab === 'audit-log') return 'Riwayat & Audit Log';
      if (activeTab === 'kode-sipd') return 'Kode SIPD';
      if (activeTab === 'manajemen-user') return 'Manajemen User';
      return 'Dashboard';
    })();

    if (userRole === 'OPD') {
      return `${menuLabel} — ${activeOpd.nama_opd}`;
    }
    return menuLabel;
  })();

  const handleToggleSidebar = () => {
    setSidebarExpanded((prev) => !prev);
  };

  return (
    <div className="min-h-screen w-full bg-[#F3F6FD] text-slate-900 flex">
      {/* LEFT SIDEBAR (Desktop & Tablet >= md): Fixed agar selalu terlihat meskipun halaman di-scroll ke bawah */}
      <aside
        className={`hidden md:flex fixed top-0 bottom-0 left-0 z-40 h-screen bg-gradient-to-b from-[#F4F8FF] via-[#F7FAFF] to-[#EBF2FF] border-r border-slate-200/80 flex-col justify-between transition-all duration-200 ease-out overflow-hidden shrink-0 ${
          sidebarExpanded ? 'w-64' : 'w-20'
        }`}
      >
        {/* Siluet Halus Tugu Blora di bagian bawah sidebar (tampil saat sidebar terbuka penuh) */}
        {sidebarExpanded && (
          <div className="absolute bottom-20 inset-x-0 pointer-events-none">
            <SidebarMonumentSilhouette />
          </div>
        )}

        {/* Bagian Atas Sidebar: Logo Pemkab Blora + Nama Aplikasi OPTIMIS + Menu Navigasi */}
        <div
          className={`relative z-10 flex flex-col flex-1 min-h-0 ${
            sidebarExpanded ? 'p-5 space-y-6 w-64' : 'py-5 px-2.5 space-y-6 w-20 items-center'
          }`}
        >
          {/* Identitas Logo Pemkab Blora & OPTIMIS */}
          <div
            className={`flex items-center shrink-0 ${
              sidebarExpanded ? 'gap-3' : 'justify-center w-full'
            }`}
            title="OPTIMIS (Optimalisasi Pengentasan Kemiskinan)"
          >
            <BloraShieldLogo className="w-11 h-11 shrink-0" />
            {sidebarExpanded && (
              <div className="min-w-0">
                <p className="text-base font-extrabold tracking-tight text-slate-900 leading-tight truncate">
                  OPTIMIS
                </p>
                <p
                  className="text-[10.5px] font-semibold text-[#2563EB] leading-snug line-clamp-2"
                  title="Optimalisasi Pengentasan Kemiskinan"
                >
                  Optimalisasi Pengentasan Kemiskinan
                </p>
              </div>
            )}
          </div>

          {/* Daftar Menu Navigasi dengan Animasi Sliding Pill & Pop-out Tooltip (Dashboard V18) */}
          <nav
            className={`space-y-1.5 overflow-y-auto no-scrollbar ${
              sidebarExpanded ? 'w-full' : 'w-full flex flex-col items-center'
            }`}
          >
            {sidebarNavItems.map((item) => {
              const isActive = activeTab === item.id;
              const isHovered = hoveredNavId === item.id;
              return (
                <div
                  key={item.id}
                  className={`relative ${sidebarExpanded ? 'w-full' : 'flex justify-center'}`}
                  onMouseEnter={() => setHoveredNavId(item.id)}
                  onMouseLeave={() => setHoveredNavId(null)}
                >
                  <motion.button
                    type="button"
                    title={sidebarExpanded ? item.label : undefined}
                    onClick={() => handleSelectTab(item.id)}
                    whileHover={{ x: sidebarExpanded ? 4 : 0, scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`relative flex items-center transition-colors cursor-pointer ${
                      sidebarExpanded
                        ? 'w-full gap-3 px-4 py-3 rounded-2xl text-xs font-semibold'
                        : 'w-12 h-12 justify-center rounded-2xl'
                    } ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-600 hover:bg-white/85 hover:text-slate-900'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebarActivePill"
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                        className="absolute inset-0 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)]"
                      />
                    )}
                    <span className="relative z-10 flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    {sidebarExpanded && (
                      <span className="relative z-10 truncate">{item.label}</span>
                    )}
                  </motion.button>

                  {/* Floating Pill Tooltip saat Sidebar Di-minimize (Identik Dashboard V18) */}
                  <AnimatePresence>
                    {!sidebarExpanded && isHovered && (
                      <motion.div
                        initial={{ opacity: 0, x: -8, scale: 0.92 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: -6, scale: 0.92 }}
                        transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                        className="fixed left-[74px] z-50 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold shadow-lg whitespace-nowrap pointer-events-none flex items-center gap-1.5"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        <span>{item.label}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </nav>
        </div>

        {/* Bagian Bawah Sidebar: Ikon Hamburger Show/Hide Saja (Tanpa Teks "Sembunyikan Menu") */}
        <div
          className={`relative z-10 shrink-0 ${
            sidebarExpanded
              ? 'p-4 w-64 flex items-center justify-center'
              : 'py-4 px-2.5 w-20 flex flex-col items-center'
          }`}
        >
          <button
            type="button"
            onClick={handleToggleSidebar}
            title={sidebarExpanded ? 'Sembunyikan Sidebar' : 'Tampilkan Sidebar'}
            aria-label="Toggle Sidebar"
            className="w-12 h-12 rounded-2xl bg-white hover:bg-blue-50 border border-slate-200/90 hover:border-blue-200 text-slate-700 hover:text-[#2563EB] flex items-center justify-center shadow-xs transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5 shrink-0" />
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT VIEWPORT (Menyesuaikan Lebar Sidebar Fixed Secara Dinamis) */}
      <div
        className={`flex-1 min-w-0 w-full flex flex-col transition-all duration-200 ease-out ${
          sidebarExpanded ? 'md:pl-64' : 'md:pl-20'
        }`}
      >
        {/* Top Context Header */}
        <header className="w-full px-3.5 sm:px-6 lg:px-8 pt-3.5 sm:pt-5 pb-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          {/* Baris Identitas Khusus Layar HP (< md): Logo Blora + OPTIMIS di Kiri, Status + Notifikasi + Profil di Kanan */}
          <div className="flex md:hidden items-center justify-between gap-2 pb-2.5 border-b border-slate-200/80">
            <div className="flex items-center gap-2.5 min-w-0">
              <BloraShieldLogo className="w-10 h-10 shrink-0" />
              <div className="min-w-0">
                <p className="text-base font-extrabold tracking-tight text-slate-900 leading-tight truncate">
                  OPTIMIS
                </p>
                <p className="text-[11px] font-semibold text-[#2563EB] leading-tight truncate">
                  Pengentasan Kemiskinan Blora
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Status Koneksi di HP */}
              <div
                className="px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 flex items-center gap-1.5 text-[11px] font-bold select-none"
                aria-label="Status Koneksi"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Terhubung</span>
              </div>

              {/* Lonceng Notifikasi di HP */}
              <button
                type="button"
                onClick={handleToggleNotifMenu}
                className="w-10 h-10 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-center justify-center text-slate-700 active:scale-95 transition-all cursor-pointer relative"
                aria-label="Notifikasi Aktivitas"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4.5 h-4.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F3F6FD]">
                    {Math.min(9, unreadNotifCount)}
                  </span>
                )}
              </button>

              {/* Profil di HP */}
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(!profileMenuOpen);
                  setNotifMenuOpen(false);
                }}
                className="p-1 pr-2 rounded-xl bg-white border border-slate-200/90 shadow-xs flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                aria-label="Menu Akun Pengguna"
              >
                <DefaultProfileAvatar className="w-8 h-8" />
                <ChevronDown className="w-4 h-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Kiri Atas: Judul Menu & Dinas */}
          <div className="min-w-0 flex-1">
            <h1
              className="text-base sm:text-lg lg:text-xl font-extrabold tracking-tight text-slate-900 leading-snug"
              title={pageHeadingTitle}
            >
              {pageHeadingTitle}
            </h1>
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-medium text-slate-600 mt-1.5">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-50 text-[#1D4ED8] font-bold border border-blue-200/70">
                TA {activePeriode.tahun}
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-bold border border-emerald-200/70">
                Semester {activeSemesterNum} ({activeSemesterNum === 1 ? 'Jan–Jun' : 'Jul–Des'}) — Dibuka
              </span>
            </div>
          </div>

          {/* Kanan Atas: Pilihan Tahun/Semester + Lonceng Notifikasi + Akun Pengguna */}
          <div className="flex flex-wrap items-center justify-between md:justify-end gap-2 sm:gap-2.5 shrink-0 w-full lg:w-auto self-end lg:self-center relative">
            {/* Pilihan Tahun (2026 & 2027) dan Semester (Semester 1 & Semester 2) — di HP dibuat proporsional penuh agar mudah dibaca & disentuh */}
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2.5 sm:px-3 sm:py-2 shadow-xs">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#2563EB] shrink-0" />
                  <span className="text-xs font-semibold text-slate-500">Tahun:</span>
                </div>
                <select
                  value={activePeriode.periode_id}
                  onChange={(e) =>
                    triggerSmoothReload(() => {
                      setActivePeriodeId(e.target.value);
                    })
                  }
                  className="text-xs sm:text-xs font-bold text-slate-900 bg-transparent focus:outline-none cursor-pointer"
                >
                  {periodes.map((p) => (
                    <option key={p.periode_id} value={p.periode_id}>
                      {p.tahun}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between sm:justify-start gap-1.5 bg-white border border-slate-200/90 rounded-2xl px-3.5 py-2.5 sm:px-3 sm:py-2 shadow-xs">
                <span className="text-xs font-semibold text-slate-500">Sem:</span>
                <select
                  value={selectedSemesterFilter === 'S2' ? 'S2' : 'S1'}
                  onChange={(e) =>
                    setSelectedSemesterFilter(e.target.value as 'S1' | 'S2')
                  }
                  className="text-xs font-bold text-[#1D4ED8] bg-transparent focus:outline-none cursor-pointer truncate"
                >
                  <option value="S1">Semester 1 (Buka)</option>
                  <option value="S2">Semester 2 (Buka)</option>
                </select>
              </div>
            </div>

            <div className="h-7 w-px bg-slate-200/90 hidden md:block mx-0.5" />

            {/* Indikator Status Koneksi Saja (Desktop >= md) */}
            <div
              className="hidden md:flex px-3 py-2 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-emerald-700 items-center gap-1.5 text-xs font-bold select-none"
              aria-label="Status Koneksi"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  firebaseUser ? 'bg-emerald-500' : 'bg-emerald-500'
                }`}
              />
              <span>Terhubung</span>
            </div>

            {/* Lonceng Notifikasi (Tombol Desktop + Popover Responsif HP & Desktop) */}
            <div className="relative">
              <button
                type="button"
                onClick={handleToggleNotifMenu}
                className="hidden md:flex w-11 h-11 rounded-2xl bg-white border border-slate-200/80 shadow-xs items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer relative"
                aria-label="Notifikasi Aktivitas"
              >
                <Bell className="w-5 h-5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-[#F3F6FD]">
                    {Math.min(9, unreadNotifCount)}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-80 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-900">
                        Notifikasi Sistem Terbaru
                      </span>
                      <div className="flex items-center gap-2.5">
                        {visibleNotifLogs.length > 0 && (
                          <button
                            type="button"
                            onClick={handleClearNotifications}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 px-2 py-1 rounded-lg transition-colors cursor-pointer"
                            title="Bersihkan seluruh daftar notifikasi"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear Notifikasi</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setNotifMenuOpen(false);
                            setActiveTab('audit-log');
                          }}
                          className="text-xs font-semibold text-[#2563EB] hover:underline cursor-pointer"
                        >
                          Lihat Semua
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2.5 max-h-64 overflow-y-auto">
                      {visibleNotifLogs.length === 0 ? (
                        <div className="py-6 px-3 text-center space-y-1.5">
                          <div className="w-9 h-9 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-4.5 h-4.5" />
                          </div>
                          <p className="text-xs font-bold text-slate-700">
                            Tidak Ada Notifikasi
                          </p>
                          <p className="text-[11px] text-slate-400 leading-relaxed">
                            Seluruh log notifikasi telah dibersihkan.
                          </p>
                        </div>
                      ) : (
                        visibleNotifLogs.slice(0, 4).map((log) => (
                          <div
                            key={log.log_id}
                            className="p-3 rounded-xl bg-[#F8FAFF] border border-slate-100 text-xs space-y-1"
                          >
                            <p className="font-semibold text-slate-800 line-clamp-1">
                              {log.aksi}
                            </p>
                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {log.detail_perubahan}
                            </p>
                            <p className="text-[11px] text-slate-400 pt-0.5">
                              {formatDateTimeID(log.created_at)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Kartu Profil Pengguna (Tombol Desktop + Popover Responsif HP & Desktop) */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setProfileMenuOpen(!profileMenuOpen);
                  setNotifMenuOpen(false);
                }}
                title={`${currentUser.display_name} (${currentUser.instansi_label})`}
                className="hidden md:flex pl-2 pr-3 py-1.5 rounded-2xl bg-white border border-slate-200/80 shadow-xs items-center gap-2.5 hover:bg-slate-50 transition-colors cursor-pointer max-w-[220px] xl:max-w-[250px] 2xl:max-w-[300px]"
              >
                <DefaultProfileAvatar className="w-9 h-9 shrink-0" />
                <div className="text-left hidden sm:block min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900 leading-tight truncate">
                    {currentUser.display_name}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-tight truncate">
                    {currentUser.instansi_label}
                  </p>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
              </button>

              <AnimatePresence>
                {profileMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    className="fixed inset-x-3 top-16 md:absolute md:inset-x-auto md:right-0 md:top-auto md:mt-2 md:w-76 bg-white rounded-2xl border border-slate-200 shadow-2xl p-4 z-50 space-y-3"
                  >
                    <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                      <DefaultProfileAvatar className="w-10 h-10 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {currentUser.display_name}
                        </p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-snug">
                          {currentUser.instansi_lengkap}
                        </p>
                        <span className="inline-block mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2563EB] border border-blue-200/60">
                          {currentUser.role === 'ADMIN' ? 'Administrator Bapperida' : 'Operator OPD Terverifikasi'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Username:</span>
                        <span className="font-mono text-slate-800 font-semibold">{currentUser.username}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="text-slate-500 shrink-0">Email:</span>
                        <span className="font-mono text-[#1D4ED8] font-semibold truncate">
                          {currentUser.email || `${currentUser.username}@oppkpke.com`}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Hak Akses:</span>
                        <span className="font-semibold text-emerald-700">Aktif ({currentUser.role})</span>
                      </div>
                    </div>

                    <div className="pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 bg-rose-50/70 hover:bg-rose-100 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Keluar Sistem (Logout)</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main Content Body (Di HP diberi ruang bawah pb-28 agar tidak tertutup Bottom Dock) */}
        <main className="flex-1 px-3.5 sm:px-6 lg:px-8 pb-28 md:pb-10 pt-1.5 sm:pt-2 w-full max-w-none">
          {isLoadingView ? (
            <DashboardSkeleton activeTab={activeTab} />
          ) : (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
            >
              {activeTab === 'dashboard' && (
                <DashboardView
                  rows={enrichedRows}
                  allRowsForRecap={allRowsForRecap}
                  allOpds={allOpds}
                  periodes={periodes}
                  activePeriode={activePeriode}
                  userRole={userRole}
                  activeOpd={activeOpd}
                  auditLogs={auditLogs}
                  selectedSemesterFilter={selectedSemesterFilter}
                  onChangeSemesterFilter={setSelectedSemesterFilter}
                  onChangePeriode={(id) =>
                    triggerSmoothReload(() => {
                      setActivePeriodeId(id);
                    })
                  }
                  onOpenInputModal={handleOpenInputModal}
                  onNavigateTab={(t) => handleSelectTab(t)}
                />
              )}

              {activeTab === 'matriks' && (
                <MatriksTableView
                  rows={enrichedRows}
                  allOpds={allOpds}
                  activePeriode={activePeriode}
                  userRole={userRole}
                  activeOpd={activeOpd}
                  selectedSemester={activeSemesterNum}
                  onOpenInputModal={handleOpenInputModal}
                  onDeleteMatrixRow={(matrixId) => {
                    const actorName =
                      currentUser?.display_name || `Operator ${activeOpd.singkatan}`;
                    const res = DatabaseService.deleteMatrixRow({
                      matrix_id: matrixId,
                      userRole,
                      userName: actorName,
                    });
                    setRefreshTick((t) => t + 1);
                    showToast(res.success ? 'success' : 'error', res.message);
                  }}
                  onImportExcelRows={handleImportExcelRows}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'verifikasi' && (
                <VerificationView
                  rows={enrichedRows}
                  allOpds={allOpds}
                  activePeriode={activePeriode}
                  selectedSemester={activeSemesterNum}
                  userRole={userRole}
                  onVerifySemester={handleVerifySemester}
                />
              )}

              {activeTab === 'laporan-export' && (
                <ReportsExportView
                  rows={enrichedRows}
                  allOpds={allOpds}
                  activePeriode={activePeriode}
                  userRole={userRole}
                  activeOpd={activeOpd}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'kode-sipd' && (
                <KodeSipdView
                  allOpds={allOpds}
                  activeOpd={activeOpd}
                  userRole={userRole}
                  onUseSipdInMatrix={handleUseSipdInMatrix}
                  onShowToast={showToast}
                />
              )}

              {activeTab === 'manajemen-user' && userRole === 'ADMIN' && (
                <UserManagementView
                  users={allUsers}
                  onSaveUser={(params) => {
                    const res = DatabaseService.saveUserAccount({
                      ...params,
                      adminName: currentUser?.display_name || 'Admin Bapperida Blora',
                    });
                    setRefreshTick((t) => t + 1);
                    showToast(res.success ? 'success' : 'error', res.message);
                  }}
                  onDeleteUser={(userId) => {
                    const res = DatabaseService.deleteUserAccount(
                      userId,
                      currentUser?.display_name || 'Admin Bapperida Blora'
                    );
                    setRefreshTick((t) => t + 1);
                    showToast(res.success ? 'success' : 'error', res.message);
                  }}
                  onResetAndReplaceAllUsers={(params) => {
                    const res = DatabaseService.resetAndReplaceAllUsers({
                      ...params,
                      adminName: currentUser?.display_name || 'Admin Bapperida Blora',
                    });
                    setRefreshTick((t) => t + 1);
                    showToast(res.success ? 'success' : 'error', res.message);
                  }}
                  onShowToast={showToast}
                />
              )}

              {(activeTab === 'pengaturan-periode' ||
                activeTab === 'audit-log') && (
                <SystemGovernanceView
                  mode={activeTab}
                  periodes={periodes}
                  activePeriode={activePeriode}
                  allOpds={allOpds}
                  auditLogs={auditLogs}
                  rows={enrichedRows}
                  userRole={userRole}
                  onSelectPeriode={(id) =>
                    triggerSmoothReload(() => {
                      setActivePeriodeId(id);
                    })
                  }
                  onUpdatePeriode={handleUpdatePeriodeSettings}
                  onCreateNewYear={handleCreateNewYear}
                  onResetDatabase={handleResetDatabase}
                />
              )}
            </motion.div>
          )}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Otomatis muncul di bawah saat dibuka di HP < md) */}
      <nav
        aria-label="Navigasi Utama Mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 shadow-[0_-10px_30px_-6px_rgba(15,23,42,0.14)] px-2 pt-1.5 pb-safe-dock"
      >
        <div className="flex items-stretch justify-between gap-1 overflow-x-auto no-scrollbar">
          {sidebarNavItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <motion.button
                key={item.id}
                type="button"
                whileTap={{ scale: 0.93 }}
                onClick={() => handleSelectTab(item.id)}
                className={`relative flex-1 min-w-[60px] min-h-[56px] py-1.5 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                  isActive
                    ? 'text-white'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="mobileDockActivePill"
                    transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    className="absolute inset-0 rounded-2xl bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] shadow-[0_6px_16px_-4px_rgba(37,99,235,0.55)]"
                  />
                )}
                <span className="relative z-10">{item.icon}</span>
                <span className="relative z-10 text-[11px] font-bold leading-none tracking-tight whitespace-nowrap">
                  {item.shortLabel}
                </span>
              </motion.button>
            );
          })}

          {/* Tombol Keluar Cepat di Ujung Kanan Dock Mobile */}
          <button
            type="button"
            onClick={handleLogout}
            title="Keluar Sistem"
            className="min-w-[56px] min-h-[56px] py-1.5 px-1.5 rounded-2xl flex flex-col items-center justify-center gap-1 text-rose-600 bg-rose-50/80 active:scale-95 transition-all cursor-pointer shrink-0"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="text-[11px] font-bold leading-none tracking-tight whitespace-nowrap">
              Keluar
            </span>
          </button>
        </div>
      </nav>

      {/* POPOUT MODAL INPUT & EDIT MATRIKS (4 LANGKAH LENGKAP DARI REKENING S.D. REALISASI) */}
      <MatrixInputModal
        isOpen={isInputModalOpen}
        initialRow={editingMatrixRow}
        initialSipdItem={prefillSipdItem}
        allOpds={allOpds}
        activeOpd={activeOpd}
        activePeriode={activePeriode}
        userRole={userRole}
        selectedSemester={activeSemesterNum}
        auditLogs={auditLogs}
        onClose={() => {
          setIsInputModalOpen(false);
          setPrefillSipdItem(null);
        }}
        onSave={handleSaveMatrixModal}
      />

      {/* Notifikasi Toast Sukses & Gagal dengan Transisi Halus (Di HP naik di atas Bottom Dock) */}
      <div className="fixed bottom-24 md:bottom-5 right-3 sm:right-5 left-3 sm:left-auto z-50 flex flex-col gap-2 max-w-sm w-auto sm:w-full pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className={`pointer-events-auto flex items-start gap-2.5 p-4 rounded-2xl border shadow-lg text-xs font-medium ${
                t.type === 'success'
                  ? 'bg-white border-emerald-200 text-slate-900'
                  : 'bg-white border-rose-200 text-slate-900'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{t.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
