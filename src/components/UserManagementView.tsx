import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Plus,
  Search,
  Edit3,
  Trash2,
  KeyRound,
  Building2,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Copy,
  ShieldCheck,
  AlertTriangle,
  X,
  FileText,
  Layers,
  Mail,
} from 'lucide-react';
import { AuthUser, InstansiKategori } from '../types/oppkpke';
import { INSTANSI_KATEGORI_LIST } from '../data/bloraSeedData';
import { DatabaseService, formatOpdEmail } from '../services/databaseService';

interface UserManagementViewProps {
  users: AuthUser[];
  onSaveUser: (params: {
    user_id?: string | null;
    kategori: InstansiKategori;
    nama_instansi: string;
    username: string;
    email?: string;
    password: string;
  }) => void;
  onDeleteUser: (userId: string) => void;
  onResetAndReplaceAllUsers: (params: {
    newAccounts: {
      kategori: InstansiKategori;
      nama_instansi: string;
      username: string;
      email?: string;
      password: string;
    }[];
    resetMatrixData?: boolean;
  }) => void;
  onShowToast: (type: 'success' | 'error', text: string) => void;
}

interface BulkDraftRow {
  id: string;
  kategori: InstansiKategori;
  nama_instansi: string;
  username: string;
  password: string;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users,
  onSaveUser,
  onDeleteUser,
  onResetAndReplaceAllUsers,
  onShowToast,
}) => {
  const [selectedKategori, setSelectedKategori] = useState<'ALL' | InstansiKategori>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [showAllPasswords, setShowAllPasswords] = useState(true);

  // Modal Tambah / Edit User Tunggal
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);
  const [formKategori, setFormKategori] = useState<InstansiKategori>('OPD/Dinas/Badan');
  const [formNamaInstansi, setFormNamaInstansi] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('lamis123');

  // Modal Konfirmasi Hapus User Tunggal
  const [deletingUser, setDeletingUser] = useState<AuthUser | null>(null);

  // State Sinkronisasi Massal ke Firebase Authentication
  const [isSyncingAuth, setIsSyncingAuth] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    current: number;
    total: number;
    email: string;
  } | null>(null);

  // Modal Reset Semua Akun / Input Massal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetMode, setResetMode] = useState<'EMPTY_WITH_SAMPLE' | 'EMPTY_ALL' | 'BULK_TABLE'>(
    'BULK_TABLE'
  );
  const [resetMatrixToo, setResetMatrixToo] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkDraftRow[]>([
    {
      id: 'row-admin',
      kategori: 'Admin',
      nama_instansi: 'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
      username: 'admin',
      password: 'admin',
    },
    {
      id: 'row-1',
      kategori: 'OPD/Dinas/Badan',
      nama_instansi: 'DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA',
      username: 'dinporabudpar',
      password: 'lamis123',
    },
  ]);
  const [pasteText, setPasteText] = useState('');
  const [pasteKategori, setPasteKategori] = useState<InstansiKategori>('OPD/Dinas/Badan');

  // Normalisasi kategori & email [namaopd]@oppkpke.com setiap user
  const normalizedUsers = useMemo(() => {
    return users.map((u) => ({
      ...u,
      resolvedEmail: formatOpdEmail(u.email || u.username),
      resolvedKategori: (u.role === 'ADMIN'
        ? 'Admin'
        : u.kategori || 'OPD/Dinas/Badan') as InstansiKategori,
    }));
  }, [users]);

  // Hitung jumlah user per kategori (termasuk Admin)
  const categoryCounts = useMemo(() => {
    const counts: Record<InstansiKategori, number> = {
      Admin: 0,
      'OPD/Dinas/Badan': 0,
      RSUD: 0,
      Puskesmas: 0,
      Kecamatan: 0,
      Kelurahan: 0,
    };
    normalizedUsers.forEach((u) => {
      counts[u.resolvedKategori] = (counts[u.resolvedKategori] || 0) + 1;
    });
    return counts;
  }, [normalizedUsers]);

  // Filter daftar user berdasarkan kategori & kata kunci pencarian
  const filteredUsers = useMemo(() => {
    return normalizedUsers.filter((u) => {
      if (selectedKategori !== 'ALL' && u.resolvedKategori !== selectedKategori) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.instansi_lengkap.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.resolvedEmail.toLowerCase().includes(q) ||
          u.resolvedKategori.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [normalizedUsers, selectedKategori, searchQuery]);

  // Grupkan user per kategori untuk tampilan terstruktur
  const groupedByKategori = useMemo(() => {
    const targetCategories: InstansiKategori[] =
      selectedKategori === 'ALL' ? INSTANSI_KATEGORI_LIST : [selectedKategori];

    return targetCategories.map((kat) => ({
      kategori: kat,
      items: filteredUsers.filter((u) => u.resolvedKategori === kat),
    }));
  }, [filteredUsers, selectedKategori]);

  const handleOpenAddModal = (defaultKat?: InstansiKategori) => {
    const targetKat =
      defaultKat || (selectedKategori !== 'ALL' ? selectedKategori : 'OPD/Dinas/Badan');
    setEditingUser(null);
    setFormKategori(targetKat);
    setFormNamaInstansi(
      targetKat === 'Admin'
        ? 'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA'
        : ''
    );
    setFormUsername(targetKat === 'Admin' ? 'admin' : '');
    setFormPassword(targetKat === 'Admin' ? 'admin' : 'lamis123');
    setIsUserModalOpen(true);
  };

  const handleOpenEditModal = (user: AuthUser) => {
    const kat: InstansiKategori =
      user.role === 'ADMIN' ? 'Admin' : user.kategori || 'OPD/Dinas/Badan';
    setEditingUser(user);
    setFormKategori(kat);
    setFormNamaInstansi(user.instansi_lengkap);
    setFormUsername(user.username);
    setFormPassword(user.password_hint);
    setIsUserModalOpen(true);
  };

  const handleSubmitSingleUser = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = formUsername.trim().toLowerCase().replace(/\s+/g, '_');
    onSaveUser({
      user_id: editingUser?.user_id || null,
      kategori: formKategori,
      nama_instansi: formNamaInstansi,
      username: cleanUser,
      email: formatOpdEmail(cleanUser),
      password: formPassword,
    });
    setIsUserModalOpen(false);
  };

  const handleCopyCredentials = (u: AuthUser) => {
    const kat = u.role === 'ADMIN' ? 'Admin' : u.kategori || 'OPD/Dinas/Badan';
    const userEmail = formatOpdEmail(u.email || u.username);
    const text = `Kategori : ${kat}\nRole : ${u.role}\nNama Instansi : ${u.instansi_lengkap}\nUser name : ${u.username}\nEmail : ${userEmail}\nPassword : ${u.password_hint}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      onShowToast('success', `Kredensial "${u.username}" (${userEmail}) disalin ke clipboard.`);
    }
  };

  const handleSyncAllToFirebaseAuth = async () => {
    if (isSyncingAuth) return;
    setIsSyncingAuth(true);
    setSyncProgress({
      current: 0,
      total: normalizedUsers.length,
      email: 'Memulai sinkronisasi...',
    });
    try {
      const result = await DatabaseService.syncAllUsersToFirebaseAuth(
        (current, total, email) => {
          setSyncProgress({ current, total, email });
        }
      );
      onShowToast(
        'success',
        `Sinkronisasi selesai: ${result.total} akun diproses (${result.created} baru didaftarkan ke Firebase Auth, ${result.alreadyExists} sudah terdaftar).`
      );
    } catch {
      onShowToast(
        'error',
        'Terjadi kendala saat menyinkronkan sebagian akun ke Firebase Authentication.'
      );
    } finally {
      setIsSyncingAuth(false);
      setSyncProgress(null);
    }
  };

  const handleOpenResetModal = () => {
    if (normalizedUsers.length > 0) {
      setBulkRows(
        normalizedUsers.map((u, idx) => ({
          id: `row-${idx}-${Date.now()}`,
          kategori: u.resolvedKategori,
          nama_instansi: u.instansi_lengkap,
          username: u.username,
          password: u.password_hint,
        }))
      );
    } else {
      setBulkRows([
        {
          id: 'row-admin',
          kategori: 'Admin',
          nama_instansi:
            'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
          username: 'admin',
          password: 'admin',
        },
        {
          id: 'row-1',
          kategori: 'OPD/Dinas/Badan',
          nama_instansi: 'DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA',
          username: 'dinporabudpar',
          password: 'lamis123',
        },
      ]);
    }
    setIsResetModalOpen(true);
  };

  const handleAddBulkRow = (kat?: InstansiKategori) => {
    const targetKat = kat || 'OPD/Dinas/Badan';
    setBulkRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        kategori: targetKat,
        nama_instansi: '',
        username: '',
        password: targetKat === 'Admin' ? 'admin' : 'lamis123',
      },
    ]);
  };

  const handleUpdateBulkRow = (
    id: string,
    field: keyof Omit<BulkDraftRow, 'id'>,
    value: string
  ) => {
    setBulkRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleRemoveBulkRow = (id: string) => {
    setBulkRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleParsePasteText = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const parsed: BulkDraftRow[] = [];
    lines.forEach((line, idx) => {
      const parts = line.includes('\t')
        ? line.split('\t').map((p) => p.trim())
        : line.includes(';')
        ? line.split(';').map((p) => p.trim())
        : line.includes('|')
        ? line.split('|').map((p) => p.trim())
        : [line];

      if (parts.length >= 4) {
        const matchedKat =
          INSTANSI_KATEGORI_LIST.find(
            (k) => k.toLowerCase() === parts[0].toLowerCase()
          ) || pasteKategori;
        parsed.push({
          id: `paste-${Date.now()}-${idx}`,
          kategori: matchedKat,
          nama_instansi: parts[1].toUpperCase(),
          username: parts[2].toLowerCase().replace(/\s+/g, '_'),
          password: parts[3] || (matchedKat === 'Admin' ? 'admin' : 'lamis123'),
        });
      } else if (parts.length === 3) {
        parsed.push({
          id: `paste-${Date.now()}-${idx}`,
          kategori: pasteKategori,
          nama_instansi: parts[0].toUpperCase(),
          username: parts[1].toLowerCase().replace(/\s+/g, '_'),
          password: parts[2] || (pasteKategori === 'Admin' ? 'admin' : 'lamis123'),
        });
      } else if (parts.length === 2) {
        parsed.push({
          id: `paste-${Date.now()}-${idx}`,
          kategori: pasteKategori,
          nama_instansi: parts[0].toUpperCase(),
          username: parts[1].toLowerCase().replace(/\s+/g, '_'),
          password: pasteKategori === 'Admin' ? 'admin' : 'lamis123',
        });
      }
    });

    if (parsed.length > 0) {
      setBulkRows((prev) => [...prev, ...parsed]);
      setPasteText('');
      onShowToast(
        'success',
        `Berhasil menambahkan ${parsed.length} baris user ke daftar input massal.`
      );
    } else {
      onShowToast(
        'error',
        'Format teks tidak dikenali. Gunakan pemisah Tab (Excel), titik koma (;), atau pipa (|).'
      );
    }
  };

  const handleConfirmResetAccounts = () => {
    if (resetMode === 'EMPTY_ALL') {
      onResetAndReplaceAllUsers({
        newAccounts: [
          {
            kategori: 'Admin',
            nama_instansi:
              'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
            username: 'admin',
            email: 'admin@oppkpke.com',
            password: 'admin',
          },
        ],
        resetMatrixData: resetMatrixToo,
      });
      setIsResetModalOpen(false);
      return;
    }

    if (resetMode === 'EMPTY_WITH_SAMPLE') {
      onResetAndReplaceAllUsers({
        newAccounts: [
          {
            kategori: 'Admin',
            nama_instansi:
              'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
            username: 'admin',
            email: 'admin@oppkpke.com',
            password: 'admin',
          },
          {
            kategori: 'OPD/Dinas/Badan',
            nama_instansi:
              'DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA',
            username: 'dinporabudpar',
            email: 'dinporabudpar@oppkpke.com',
            password: 'lamis123',
          },
        ],
        resetMatrixData: resetMatrixToo,
      });
      setIsResetModalOpen(false);
      return;
    }

    const validRows = bulkRows.filter(
      (r) => r.nama_instansi.trim() && r.username.trim()
    );
    onResetAndReplaceAllUsers({
      newAccounts: validRows.map((r) => {
        const cleanUname = r.username.trim().toLowerCase().replace(/\s+/g, '_');
        return {
          kategori: r.kategori,
          nama_instansi: r.nama_instansi.trim(),
          username: cleanUname,
          email: formatOpdEmail(cleanUname),
          password: r.password.trim() || (r.kategori === 'Admin' ? 'admin' : 'lamis123'),
        };
      }),
      resetMatrixData: resetMatrixToo,
    });
    setIsResetModalOpen(false);
  };

  const getCategoryBadgeStyle = (kat: InstansiKategori) => {
    switch (kat) {
      case 'Admin':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'OPD/Dinas/Badan':
        return 'bg-blue-50 text-[#1D4ED8] border-blue-200';
      case 'RSUD':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Puskesmas':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'Kecamatan':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Kelurahan':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const previewModalEmail = formatOpdEmail(
    formUsername || (formKategori === 'Admin' ? 'admin' : 'namaopd')
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      {/* HEADER BANNER MANAJEMEN USER */}
      <div className="bg-white rounded-3xl border border-slate-200/85 p-6 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-blue-50 text-[#1D4ED8] text-xs font-bold border border-blue-200/60">
            <Users className="w-3.5 h-3.5" />
            <span>Manajemen User & Kredensial OPTIMIS</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Daftar User per Kategori (Admin, OPD/Dinas/Badan, RSUD, Puskesmas, Kecamatan & Kelurahan)
          </h2>
          <p className="text-xs text-slate-500 max-w-3xl leading-relaxed">
            Kelola akun login beserta email autentikasi Firestore (format otomatis:{' '}
            <code>[namaopd]@oppkpke.com</code>) untuk kategori <strong>Admin</strong> maupun
            masing-masing instansi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isSyncingAuth}
            onClick={() => void handleSyncAllToFirebaseAuth()}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              isSyncingAuth
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300 cursor-wait'
                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200 cursor-pointer'
            }`}
            title="Daftarkan seluruh akun OPD yang ada di tabel ini ke Firebase Console > Authentication > Users"
          >
            <RefreshCw
              className={`w-4 h-4 text-emerald-600 ${
                isSyncingAuth ? 'animate-spin' : ''
              }`}
            />
            <span>
              {isSyncingAuth && syncProgress
                ? `Menyinkronkan Auth (${syncProgress.current}/${syncProgress.total})...`
                : 'Sinkronkan ke Firebase Auth'}
            </span>
          </button>

          <button
            type="button"
            onClick={handleOpenResetModal}
            className="px-4 py-2.5 rounded-2xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-amber-600" />
            <span>Reset / Input Massal Semua Akun</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenAddModal()}
            className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#2563EB] to-[#1D4ED8] hover:from-[#1D4ED8] hover:to-[#1E40AF] text-white text-xs font-bold shadow-[0_8px_20px_-6px_rgba(37,99,235,0.55)] flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah User Baru</span>
          </button>
        </div>
      </div>

      {/* BANNER PROGRES SINKRONISASI FIREBASE AUTHENTICATION */}
      {isSyncingAuth && syncProgress && (
        <div className="bg-emerald-50/90 border border-emerald-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <RefreshCw className="w-5 h-5 text-emerald-600 animate-spin shrink-0" />
            <div>
              <p className="text-xs font-bold text-emerald-950">
                Menyinkronkan Akun User ke Firebase Authentication ({syncProgress.current} dari{' '}
                {syncProgress.total} akun)
              </p>
              <p className="text-[11px] text-emerald-800 font-mono-tabular mt-0.5">
                Memproses: {syncProgress.email}
              </p>
            </div>
          </div>
          <div className="w-full sm:w-56 h-2.5 bg-emerald-200/70 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-emerald-600 transition-all duration-200 rounded-full"
              style={{
                width: `${
                  syncProgress.total > 0
                    ? Math.round((syncProgress.current / syncProgress.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
        </div>
      )}

      {/* KARTU RINGKASAN KATEGORI (TERMASUK KATEGORI ADMIN) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        <button
          type="button"
          onClick={() => setSelectedKategori('ALL')}
          className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
            selectedKategori === 'ALL'
              ? 'bg-[#1D4ED8] text-white border-[#1D4ED8] shadow-md'
              : 'bg-white text-slate-800 border-slate-200/80 hover:border-blue-300'
          }`}
        >
          <p
            className={`text-[11px] font-semibold ${
              selectedKategori === 'ALL' ? 'text-blue-100' : 'text-slate-500'
            }`}
          >
            Semua Kategori
          </p>
          <p className="text-2xl font-extrabold font-mono-tabular mt-1">
            {normalizedUsers.length}
          </p>
          <p
            className={`text-[10px] mt-1 ${
              selectedKategori === 'ALL' ? 'text-blue-100' : 'text-slate-400'
            }`}
          >
            Total Akun User
          </p>
        </button>

        {INSTANSI_KATEGORI_LIST.map((kat) => {
          const isSelected = selectedKategori === kat;
          return (
            <button
              key={kat}
              type="button"
              onClick={() => setSelectedKategori(kat)}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-md'
                  : 'bg-white text-slate-800 border-slate-200/80 hover:border-blue-300'
              }`}
            >
              <p
                className={`text-[11px] font-bold truncate ${
                  isSelected ? 'text-blue-100' : 'text-slate-600'
                }`}
              >
                {kat}
              </p>
              <p className="text-2xl font-extrabold font-mono-tabular mt-1">
                {categoryCounts[kat] || 0}
              </p>
              <p
                className={`text-[10px] mt-1 ${
                  isSelected ? 'text-blue-100' : 'text-slate-400'
                }`}
              >
                {kat === 'Admin' ? 'Role Admin' : 'Role Instansi'}
              </p>
            </button>
          );
        })}
      </div>

      {/* BAR FILTER, PENCARIAN & TOGGLE PASSWORD */}
      <div className="bg-white rounded-2xl border border-slate-200/85 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSelectedKategori('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedKategori === 'ALL'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({normalizedUsers.length})
          </button>
          {INSTANSI_KATEGORI_LIST.map((kat) => (
            <button
              key={kat}
              type="button"
              onClick={() => setSelectedKategori(kat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                selectedKategori === kat
                  ? 'bg-[#2563EB] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {kat} ({categoryCounts[kat] || 0})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari instansi, username, atau email..."
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAllPasswords((prev) => !prev)}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            {showAllPasswords ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                <span>Sembunyikan Password</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Tampilkan Semua Password</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* DAFTAR USER PER KATEGORI */}
      <div className="space-y-6">
        {groupedByKategori.map(({ kategori, items }) => (
          <div
            key={kategori}
            className="bg-white rounded-3xl border border-slate-200/85 shadow-xs overflow-hidden"
          >
            {/* Header Kategori */}
            <div className="px-6 py-4 bg-gradient-to-r from-[#F8FAFF] to-white border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold ${
                    kategori === 'Admin'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-blue-50 text-[#2563EB]'
                  }`}
                >
                  {kategori === 'Admin' ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <Building2 className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Kategori {kategori}
                    </h3>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold border ${getCategoryBadgeStyle(
                        kategori
                      )}`}
                    >
                      {items.length} User
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold">
                      Role: {kategori === 'Admin' ? 'Admin' : 'OPD / Instansi'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {kategori === 'Admin'
                      ? 'Daftar akun Administrator Utama OPTIMIS (Role: Admin)'
                      : `Daftar akun login instansi untuk kategori ${kategori}`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleOpenAddModal(kategori)}
                className="px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200/80 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah User {kategori}</span>
              </button>
            </div>

            {/* Tabel User dalam Kategori Ini */}
            {items.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <p className="text-xs font-semibold text-slate-500">
                  Belum ada akun user pada kategori <strong>{kategori}</strong>.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAddModal(kategori)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#2563EB] text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Isi User {kategori} Sekarang</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      <th className="py-3 px-4 w-12 text-center">No</th>
                      <th className="py-3 px-4 w-36">Kategori</th>
                      <th className="py-3 px-4">Nama Instansi / Unit</th>
                      <th className="py-3 px-4 w-36">User Name</th>
                      <th className="py-3 px-4 w-56">Email Autentikasi</th>
                      <th className="py-3 px-4 w-40">Password</th>
                      <th className="py-3 px-4 w-24">Role</th>
                      <th className="py-3 px-4 w-44 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 text-xs">
                    {items.map((u, idx) => {
                      const isPassVisible =
                        showAllPasswords || Boolean(showPasswords[u.user_id]);
                      const isRoleAdmin = u.role === 'ADMIN' || u.resolvedKategori === 'Admin';
                      return (
                        <tr
                          key={u.user_id}
                          className="hover:bg-blue-50/30 transition-colors"
                        >
                          <td className="py-3.5 px-4 text-center font-mono-tabular font-semibold text-slate-400">
                            {idx + 1}
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold border ${getCategoryBadgeStyle(
                                u.resolvedKategori
                              )}`}
                            >
                              {u.resolvedKategori}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">
                              {u.instansi_lengkap}
                            </p>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 font-mono text-xs font-bold border border-slate-200">
                              {u.username}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 text-[#1D4ED8] font-mono text-xs font-bold border border-blue-200/80">
                              <Mail className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                              <span>{u.resolvedEmail}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/80 text-amber-900 font-mono text-xs font-bold border border-amber-200/80">
                              <KeyRound className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              <span>
                                {isPassVisible ? u.password_hint : '••••••••'}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  setShowPasswords((prev) => ({
                                    ...prev,
                                    [u.user_id]: !isPassVisible,
                                  }))
                                }
                                className="ml-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                                title="Tampilkan/Sembunyikan Password"
                              >
                                {isPassVisible ? (
                                  <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                  <Eye className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${
                                isRoleAdmin
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {isRoleAdmin ? 'Admin' : 'OPD'}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleCopyCredentials(u)}
                                title="Salin User, Email & Password"
                                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(u)}
                                className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-[#1D4ED8] border border-blue-200/80 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingUser(u)}
                                className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Hapus</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* MODAL TAMBAH / EDIT USER TUNGGAL */}
      <AnimatePresence>
        {isUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden"
            >
              <div className="px-6 py-4 bg-gradient-to-r from-[#F8FAFF] to-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#2563EB] flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      {editingUser ? 'Edit Akun User' : 'Tambah Akun User Baru'}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Isikan Kategori, Nama Instansi, User name, Email, dan Password
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitSingleUser} className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Kategori *
                    </label>
                    <select
                      value={formKategori}
                      onChange={(e) => {
                        const nextKat = e.target.value as InstansiKategori;
                        setFormKategori(nextKat);
                        if (!editingUser && nextKat === 'Admin') {
                          setFormPassword('admin');
                        }
                      }}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    >
                      {INSTANSI_KATEGORI_LIST.map((kat) => (
                        <option key={kat} value={kat}>
                          {kat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Role Hak Akses (Otomatis)
                    </label>
                    <div
                      className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                        formKategori === 'Admin'
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                          : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 shrink-0" />
                      <span>
                        {formKategori === 'Admin' ? 'Role: Admin' : 'Role: OPD / Instansi'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Instansi / Unit *
                  </label>
                  <input
                    type="text"
                    required
                    value={formNamaInstansi}
                    onChange={(e) => setFormNamaInstansi(e.target.value)}
                    placeholder="Contoh: DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      User name (Nama OPD) *
                    </label>
                    <input
                      type="text"
                      required
                      value={formUsername}
                      onChange={(e) =>
                        setFormUsername(
                          e.target.value
                            .toLowerCase()
                            .replace(/@.*$/, '')
                            .replace(/\s+/g, '_')
                        )
                      }
                      placeholder={formKategori === 'Admin' ? 'Contoh: admin' : 'Contoh: dinporabudpar'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Password *
                    </label>
                    <input
                      type="text"
                      required
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      placeholder={formKategori === 'Admin' ? 'Contoh: admin' : 'Contoh: lamis123'}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                    />
                  </div>
                </div>

                {/* Email Autentikasi Firestore [namaopd]@oppkpke.com */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Email Autentikasi Firestore (Otomatis)
                  </label>
                  <div className="w-full px-3.5 py-2.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs font-mono font-bold text-[#1D4ED8] flex items-center gap-2">
                    <Mail className="w-4 h-4 text-[#2563EB] shrink-0" />
                    <span>{previewModalEmail}</span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-0.5">
                  <p className="font-bold text-slate-800">Contoh Format Sesuai Standar:</p>
                  <p>
                    • Kategori Admin : User <strong>admin</strong> · Email{' '}
                    <strong>admin@oppkpke.com</strong> · Password <strong>admin</strong>
                  </p>
                  <p>
                    • Kategori OPD : User <strong>dinporabudpar</strong> · Email{' '}
                    <strong>dinporabudpar@oppkpke.com</strong> · Password{' '}
                    <strong>lamis123</strong>
                  </p>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsUserModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{editingUser ? 'Simpan Perubahan' : 'Simpan User'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS USER */}
      <AnimatePresence>
        {deletingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Konfirmasi Hapus Akun User
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Apakah Anda yakin ingin menghapus akun{' '}
                    <strong className="text-slate-800">{deletingUser.username}</strong> (
                    {formatOpdEmail(deletingUser.email || deletingUser.username)} —{' '}
                    {deletingUser.instansi_lengkap})?
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteUser(deletingUser.user_id);
                    setDeletingUser(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Ya, Hapus User</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL RESET SEMUA AKUN & INPUT MASSAL PER KATEGORI */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/55 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header Modal Reset */}
              <div className="px-6 py-4 bg-gradient-to-r from-amber-50 via-white to-blue-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <RefreshCw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Reset Semua Akun & Pengisian Daftar User Baru
                    </h3>
                    <p className="text-xs text-slate-500">
                      Seluruh user otomatis dibuatkan email autentikasi{' '}
                      <code>[namaopd]@oppkpke.com</code> untuk Firestore.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body Modal Reset */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Pilihan Mode Reset */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setResetMode('BULK_TABLE')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      resetMode === 'BULK_TABLE'
                        ? 'bg-blue-50/80 border-[#2563EB] ring-2 ring-[#2563EB]/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        1. Isi / Edit Tabel & Reset Semua Akun
                      </span>
                      <Layers className="w-4 h-4 text-[#2563EB]" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Susun daftar user per kategori pada tabel di bawah (atau paste dari Excel), lalu simpan untuk mereset semua akun.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetMode('EMPTY_WITH_SAMPLE')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      resetMode === 'EMPTY_WITH_SAMPLE'
                        ? 'bg-amber-50/80 border-amber-500 ring-2 ring-amber-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        2. Reset & Sisakan Admin + 1 Contoh OPD
                      </span>
                      <FileText className="w-4 h-4 text-amber-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Sisakan akun Admin (<strong>admin@oppkpke.com</strong>) dan 1 contoh OPD (<strong>dinporabudpar@oppkpke.com</strong>).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResetMode('EMPTY_ALL')}
                    className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                      resetMode === 'EMPTY_ALL'
                        ? 'bg-rose-50/80 border-rose-500 ring-2 ring-rose-500/20'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900">
                        3. Kosongkan Semua Akun Instansi
                      </span>
                      <Trash2 className="w-4 h-4 text-rose-600" />
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Hapus seluruh akun instansi hingga kosong (hanya menyisakan akun <strong>admin@oppkpke.com</strong>).
                    </p>
                  </button>
                </div>

                {resetMode === 'BULK_TABLE' && (
                  <div className="space-y-4">
                    {/* Kotak Paste Cepat dari Excel / Teks */}
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/90 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-slate-800">
                            Tambah Cepat via Copy-Paste Baris (Opsional)
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Format per baris: <code>Nama Instansi ; username ; password</code> (Email{' '}
                            <code>[namaopd]@oppkpke.com</code> dibuat otomatis).
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-600">
                            Kategori Default:
                          </span>
                          <select
                            value={pasteKategori}
                            onChange={(e) =>
                              setPasteKategori(e.target.value as InstansiKategori)
                            }
                            className="px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-bold bg-white"
                          >
                            {INSTANSI_KATEGORI_LIST.map((k) => (
                              <option key={k} value={k}>
                                {k}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <textarea
                          rows={2}
                          value={pasteText}
                          onChange={(e) => setPasteText(e.target.value)}
                          placeholder="Contoh: DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA ; dinporabudpar ; lamis123"
                          className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono bg-white focus:outline-none focus:ring-2 focus:ring-[#2563EB]"
                        />
                        <button
                          type="button"
                          onClick={handleParsePasteText}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer"
                        >
                          + Masukkan ke Tabel
                        </button>
                      </div>
                    </div>

                    {/* Tabel Interaktif Penyusunan Akun */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          Daftar Akun yang Akan Disimpan ({bulkRows.length} Baris)
                        </span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setBulkRows([
                                {
                                  id: `row-admin-${Date.now()}`,
                                  kategori: 'Admin',
                                  nama_instansi:
                                    'BADAN PERENCANAAN PEMBANGUNAN, RISET DAN INOVASI DAERAH KAB. BLORA',
                                  username: 'admin',
                                  password: 'admin',
                                },
                                {
                                  id: `row-${Date.now()}`,
                                  kategori: 'OPD/Dinas/Badan',
                                  nama_instansi:
                                    'DINAS KEPEMUDAAN, OLAH RAGA, KEBUDAYAAN DAN PARIWISATA',
                                  username: 'dinporabudpar',
                                  password: 'lamis123',
                                },
                              ])
                            }
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold cursor-pointer"
                          >
                            Bersihkan Tabel (Sisakan Admin & Contoh DINPORABUDPAR)
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddBulkRow()}
                            className="px-3 py-1 rounded-lg bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Tambah Baris</span>
                          </button>
                        </div>
                      </div>

                      <div className="max-h-72 overflow-y-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500">
                              <th className="py-2.5 px-3 w-10 text-center">No</th>
                              <th className="py-2.5 px-3 w-40">Kategori</th>
                              <th className="py-2.5 px-3">Nama Instansi / Unit</th>
                              <th className="py-2.5 px-3 w-36">User name</th>
                              <th className="py-2.5 px-3 w-48">Email ([namaopd]@oppkpke.com)</th>
                              <th className="py-2.5 px-3 w-32">Password</th>
                              <th className="py-2.5 px-3 w-12 text-center">Hapus</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200/70 text-xs">
                            {bulkRows.map((row, index) => (
                              <tr key={row.id}>
                                <td className="py-2 px-3 text-center font-mono text-slate-400">
                                  {index + 1}
                                </td>
                                <td className="py-2 px-3">
                                  <select
                                    value={row.kategori}
                                    onChange={(e) =>
                                      handleUpdateBulkRow(
                                        row.id,
                                        'kategori',
                                        e.target.value
                                      )
                                    }
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                                  >
                                    {INSTANSI_KATEGORI_LIST.map((k) => (
                                      <option key={k} value={k}>
                                        {k}
                                      </option>
                                    ))}
                                  </select>
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={row.nama_instansi}
                                    onChange={(e) =>
                                      handleUpdateBulkRow(
                                        row.id,
                                        'nama_instansi',
                                        e.target.value
                                      )
                                    }
                                    placeholder="Nama Instansi Lengkap..."
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={row.username}
                                    onChange={(e) =>
                                      handleUpdateBulkRow(
                                        row.id,
                                        'username',
                                        e.target.value
                                          .toLowerCase()
                                          .replace(/@.*$/, '')
                                          .replace(/\s+/g, '_')
                                      )
                                    }
                                    placeholder="namaopd"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold"
                                  />
                                </td>
                                <td className="py-2 px-3">
                                  <div className="px-2.5 py-1.5 rounded-lg bg-blue-50/70 border border-blue-200/80 text-[#1D4ED8] font-mono text-[11px] font-bold truncate">
                                    {formatOpdEmail(row.username || 'namaopd')}
                                  </div>
                                </td>
                                <td className="py-2 px-3">
                                  <input
                                    type="text"
                                    value={row.password}
                                    onChange={(e) =>
                                      handleUpdateBulkRow(
                                        row.id,
                                        'password',
                                        e.target.value
                                      )
                                    }
                                    placeholder="lamis123"
                                    className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-mono font-bold"
                                  />
                                </td>
                                <td className="py-2 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBulkRow(row.id)}
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Opsi Reset Data Matriks */}
                <label className="flex items-center gap-2.5 p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={resetMatrixToo}
                    onChange={(e) => setResetMatrixToo(e.target.checked)}
                    className="w-4 h-4 rounded text-[#2563EB]"
                  />
                  <span className="text-xs font-semibold text-amber-950">
                    Sekalian kosongkan/reset seluruh baris data Matriks OPTIMIS saat mereset semua akun user
                  </span>
                </label>
              </div>

              {/* Footer Modal Reset */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
                <p className="text-[11px] text-slate-500">
                  Catatan: Akun kategori Admin (<code>admin@oppkpke.com</code>) tetap aktif.
                </p>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsResetModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmResetAccounts}
                    className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-2 shadow-sm cursor-pointer"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Konfirmasi Reset Semua Akun</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
