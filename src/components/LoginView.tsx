import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  LogIn,
  BarChart3,
  Check,
  Info,
  X,
} from 'lucide-react';
import { AuthUser } from '../types/oppkpke';
import { BloraShieldLogo } from './ui/BloraVisuals';

interface LoginViewProps {
  users: AuthUser[];
  onLoginCredentials: (username: string, password: string) => {
    success: boolean;
    message: string;
  };
  onQuickDemoLogin: (user: AuthUser) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLoginCredentials,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showForgotInfo, setShowForgotInfo] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const res = onLoginCredentials(username, password);
    if (!res.success) {
      setErrorMsg(res.message);
    }
  };

  return (
    <div className="min-h-screen w-full relative flex flex-col items-center justify-between p-4 sm:p-6 lg:p-10 overflow-hidden select-none">
      {/* Latar Belakang Pemandangan Alam Blora Sesuai Lampiran */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat scale-[1.01]"
        style={{
          backgroundImage: `url('/assets/aistudio/image_5a766d37.png')`,
        }}
      />

      {/* Overlay Atmosfer Langit Biru Lembut agar Kontras Glassmorphism Identik dengan Desain */}
      <div className="fixed inset-0 bg-gradient-to-tr from-[#0B2247]/25 via-[#1E60B8]/15 to-[#3898FF]/25 pointer-events-none" />

      {/* Ornamen Cincin Biru Transparan di Kanan Atas */}
      <div className="fixed -top-28 -right-28 w-[440px] h-[440px] rounded-full border-[52px] border-[#69B4FF]/30 pointer-events-none hidden sm:block" />

      <div className="w-full" />

      {/* KARTU UTAMA GLASSMORPHISM */}
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-[960px] rounded-[34px] bg-gradient-to-br from-white/65 via-white/50 to-white/35 backdrop-blur-md border border-white/65 shadow-[0_28px_80px_-15px_rgba(10,25,55,0.42)] grid grid-cols-1 lg:grid-cols-12 overflow-hidden"
      >
        {/* PANEL KIRI (7/12): Identitas Kabupaten Blora & E - LAMIS BLORA */}
        <div className="lg:col-span-7 p-8 sm:p-11 lg:p-12 flex flex-col justify-between gap-8 relative">
          {/* Atas: Logo Kabupaten Blora */}
          <div className="flex items-center gap-4">
            <BloraShieldLogo className="w-16 h-16 shrink-0 drop-shadow-md" />
            <div className="leading-tight">
              <p className="text-xl sm:text-[22px] font-extrabold text-[#0F2547] tracking-tight">
                Kabupaten
              </p>
              <p className="text-xl sm:text-[22px] font-extrabold text-[#0F2547] tracking-tight">
                Blora
              </p>
            </div>
          </div>

          {/* Tengah: Judul Utama OPTIMIS */}
          <div className="space-y-2.5 my-auto py-2">
            <h1 className="text-3xl sm:text-[42px] font-black tracking-tight text-[#0F2547] leading-none">
              OPTIMIS
            </h1>
            <p className="text-base sm:text-[19px] font-bold text-[#0F2547] tracking-tight leading-snug">
              (Optimalisasi Pelaksanaan Pengentasan Kemiskinan)
            </p>

            {/* Garis Aksen Biru */}
            <div className="pt-2 pb-2 flex items-center">
              <div className="w-20 h-1 bg-[#0052FF] rounded-full" />
              <div className="w-28 h-0.5 bg-white/50 rounded-full" />
            </div>

            <p className="text-sm sm:text-[16px] font-medium text-[#172E54] leading-snug max-w-md">
              Sistem informasi laporan kemiskinan
              <br />
              kabupaten Blora.
            </p>
          </div>

          {/* Bawah: Badge Bersama Membangun Blora */}
          <div className="inline-flex items-center gap-3.5 px-5 py-3.5 rounded-2xl bg-white/45 backdrop-blur-md border border-white/65 shadow-[0_8px_24px_-6px_rgba(15,37,71,0.12)] max-w-sm">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-b from-[#1AA3FF] to-[#0066FF] flex items-center justify-center text-white shadow-sm shrink-0">
              <div className="w-6 h-6 rounded-full border-2 border-white/90 flex items-center justify-center">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </div>
            </div>
            <div className="text-xs sm:text-[13.5px] font-semibold text-[#132A4E] leading-snug">
              <p>Bersama Membangun Blora</p>
              <p>Lebih Maju dan Sejahtera</p>
            </div>
          </div>
        </div>

        {/* PANEL KANAN (5/12): Kartu Form Login Akun (Tanpa Login Google) */}
        <div className="lg:col-span-5 bg-gradient-to-b from-white/85 via-white/75 to-white/65 backdrop-blur-xl lg:rounded-l-[32px] border-t lg:border-t-0 lg:border-l border-white/80 p-8 sm:p-10 flex flex-col justify-center shadow-[-10px_0_30px_rgba(15,37,71,0.06)]">
          <div className="w-full max-w-sm mx-auto space-y-6">
            {/* Ikon Biru & Judul Login Akun */}
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-[#2B7FFF] to-[#0052FF] shadow-[0_10px_25px_-5px_rgba(0,82,255,0.55)] flex items-center justify-center mx-auto text-white mb-3">
                <BarChart3 className="w-7 h-7 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl font-extrabold text-[#0F2547] tracking-tight">
                Login Akun
              </h2>
              <p className="text-xs font-medium text-[#2C456B]">
                Silakan masuk untuk melanjutkan
              </p>
            </div>

            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-rose-50/95 border border-rose-200 text-xs text-rose-700 font-semibold text-center"
              >
                {errorMsg}
              </motion.div>
            )}

            {/* Form Username & Password */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Input Username */}
              <div className="relative flex items-center bg-white/90 hover:bg-white focus-within:bg-white rounded-xl border border-white/95 focus-within:border-[#0052FF] shadow-[0_4px_14px_rgba(15,37,71,0.05)] transition-all">
                <div className="pl-4 pr-2.5 text-[#1E3A63]">
                  <User className="w-4 h-4 stroke-[2.2]" />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username atau Email"
                  className="w-full py-3.5 pr-4 text-xs sm:text-[13px] font-medium text-[#0F2547] placeholder-[#6B82A6] bg-transparent focus:outline-none"
                />
              </div>

              {/* Input Password */}
              <div className="relative flex items-center bg-white/90 hover:bg-white focus-within:bg-white rounded-xl border border-white/95 focus-within:border-[#0052FF] shadow-[0_4px_14px_rgba(15,37,71,0.05)] transition-all">
                <div className="pl-4 pr-2.5 text-[#1E3A63]">
                  <Lock className="w-4 h-4 stroke-[2.2]" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full py-3.5 pr-10 text-xs sm:text-[13px] font-medium text-[#0F2547] placeholder-[#6B82A6] bg-transparent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 text-[#5A7196] hover:text-[#0F2547] cursor-pointer"
                  aria-label="Tampilkan Password"
                >
                  {showPassword ? (
                    <Eye className="w-4 h-4" />
                  ) : (
                    <EyeOff className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Baris Ingat Saya & Lupa Password */}
              <div className="flex items-center justify-between pt-0.5 text-xs">
                <label className="inline-flex items-center gap-2 text-[#1E3A63] font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-[#0052FF] focus:ring-[#0052FF]"
                  />
                  <span>Ingat saya</span>
                </label>

                <button
                  type="button"
                  onClick={() => setShowForgotInfo(true)}
                  className="font-semibold text-[#0052FF] hover:underline cursor-pointer"
                >
                  Lupa Password?
                </button>
              </div>

              {/* Tombol Masuk */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3.5 px-6 rounded-full bg-gradient-to-r from-[#0066FF] via-[#0052FF] to-[#0040D9] hover:from-[#0055E6] hover:to-[#0035B8] text-white text-sm font-bold shadow-[0_10px_25px_-5px_rgba(0,82,255,0.65)] flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Masuk</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </motion.div>

      {/* FOOTER HAK CIPTA */}
      <div className="relative z-10 w-full max-w-xl flex items-center justify-center gap-4 pt-4 text-white/90 text-xs font-medium drop-shadow-xs">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/60" />
        <span>© 2026 Pemerintah Kabupaten Blora. All rights reserved.</span>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/60" />
      </div>

      {/* Modal Informasi Lupa Password / Petunjuk Akun */}
      <AnimatePresence>
        {showForgotInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0052FF] flex items-center justify-center">
                    <Info className="w-5 h-5" />
                  </div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Informasi Akses & Reset Password
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForgotInfo(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
                <p>
                  Pengelolaan akun dan reset password dilakukan oleh <strong>Administrator Bapperida Kabupaten Blora</strong> melalui menu <strong>Manajemen User</strong>.
                </p>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 font-mono text-[11px] text-slate-800">
                  <p className="font-sans font-bold text-slate-900">Kredensial Standar:</p>
                  <p>• Role Admin : user <strong>admin</strong> / pass <strong>admin</strong></p>
                  <p>• Contoh OPD : user <strong>dinporabudpar</strong> / pass <strong>lamis123</strong></p>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowForgotInfo(false)}
                  className="px-4 py-2 rounded-xl bg-[#0052FF] text-white text-xs font-bold cursor-pointer"
                >
                  Mengerti
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
