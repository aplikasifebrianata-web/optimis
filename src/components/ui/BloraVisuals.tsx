import React from 'react';

export const BLORA_LOGO_URL = '/assets/aistudio/Logo_Blora_d75630ab.png';
export const BLORA_BANNER_URL = '/assets/aistudio/image_4ca41c87.png';

/**
 * Lambang Kabupaten Blora / OPD (Sesuai Lampiran Resmi) untuk Sidebar, Header, & Halaman Login
 */
export const BloraShieldLogo: React.FC<{ className?: string }> = ({
  className = 'w-10 h-10',
}) => (
  <img
    src={BLORA_LOGO_URL}
    alt="Lambang Kabupaten Blora"
    width={40}
    height={40}
    className={`${className} object-contain select-none`}
  />
);

/**
 * Siluet Orang (Profil Default) untuk Avatar Pengguna di Header
 */
export const DefaultProfileAvatar: React.FC<{ className?: string }> = ({
  className = 'w-9 h-9',
}) => (
  <div
    className={`${className} rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center overflow-hidden shrink-0`}
    aria-label="Profil Pengguna"
  >
    <svg
      viewBox="0 0 24 24"
      width={20}
      height={20}
      fill="currentColor"
      className="w-4/5 h-4/5 mt-1.5"
      aria-hidden="true"
    >
      <path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5zm0 2c-3.866 0-10 1.933-10 5.8V22h20v-2.2c0-3.867-6.134-5.8-10-5.8z" />
    </svg>
  </div>
);

/**
 * Siluet Halus Tugu Blora di latar belakang bawah Sidebar (Sesuai Lampiran)
 */
export const SidebarMonumentSilhouette: React.FC = () => (
  <svg
    viewBox="0 0 220 260"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-full h-auto pointer-events-none select-none opacity-65"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="tuguGrad" x1="110" y1="20" x2="110" y2="250" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#DBEAFE" stopOpacity="0.08" />
      </linearGradient>
    </defs>
    {/* Awan lembut */}
    <ellipse cx="55" cy="95" rx="38" ry="12" fill="#E0ECFF" fillOpacity="0.6" />
    <ellipse cx="165" cy="120" rx="42" ry="14" fill="#E0ECFF" fillOpacity="0.5" />
    {/* Puncak & Menara Tugu */}
    <path d="M110 22L104 42H116L110 22Z" fill="url(#tuguGrad)" />
    <rect x="102" y="42" width="16" height="10" rx="2" fill="url(#tuguGrad)" />
    <path d="M104 52L96 168H124L116 52H104Z" fill="url(#tuguGrad)" />
    {/* Undakan Dasar Tugu */}
    <rect x="82" y="168" width="56" height="16" rx="3" fill="url(#tuguGrad)" />
    <rect x="68" y="184" width="84" height="20" rx="3" fill="url(#tuguGrad)" />
    <rect x="52" y="204" width="116" height="22" rx="4" fill="url(#tuguGrad)" />
    <path d="M20 226H200V255H20V226Z" fill="url(#tuguGrad)" />
  </svg>
);

/**
 * Gambar Banner Kabupaten Blora pada Banner Sambutan Dashboard (Sesuai Lampiran)
 */
export const HeroGovBuildingArt: React.FC = () => (
  <div className="relative w-full h-full overflow-hidden pointer-events-none select-none">
    <img
      src={BLORA_BANNER_URL}
      alt="Banner Kabupaten Blora"
      className="w-full h-full object-cover object-center"
    />
    {/* Gradasi transisi halus dari kiri agar teks banner tetap terbaca jelas */}
    <div className="absolute inset-0 bg-gradient-to-r from-[#EAF2FF] via-[#DCE9FF]/65 to-transparent" />
  </div>
);

/**
 * Ilustrasi Gelombang Pastel pada Sudut Bawah Kartu KPI (Sesuai Lampiran)
 */
export const CardWaveDecoration: React.FC<{
  color: 'blue' | 'emerald' | 'purple' | 'amber';
}> = ({ color }) => {
  const fills: Record<'blue' | 'emerald' | 'purple' | 'amber', string> = {
    blue: '#3B82F6',
    emerald: '#10B981',
    purple: '#8B5CF6',
    amber: '#F59E0B',
  };

  return (
    <svg
      viewBox="0 0 180 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="absolute bottom-0 right-0 w-36 h-12 pointer-events-none select-none"
      aria-hidden="true"
    >
      <path
        d="M0 56C35 56 48 28 84 28C118 28 138 46 180 12V56H0Z"
        fill={fills[color]}
        fillOpacity="0.12"
      />
      <path
        d="M40 56C72 56 92 36 126 36C150 36 165 44 180 26V56H40Z"
        fill={fills[color]}
        fillOpacity="0.08"
      />
    </svg>
  );
};
