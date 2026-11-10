import React from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileEdit,
  MinusCircle,
} from 'lucide-react';
import { VerificationStatus } from '../../types/oppkpke';

interface StatusIndicatorProps {
  status: VerificationStatus;
  semesterLabel?: string;
}

/**
 * Menampilkan status verifikasi dengan teks bersih dan ikon semantik
 * (Mengikuti prinsip aksesibilitas warna + label eksplisit)
 */
export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  semesterLabel,
}) => {
  const config: Record<
    VerificationStatus,
    {
      icon: React.ReactNode;
      textColor: string;
      label: string;
    }
  > = {
    Terverifikasi: {
      icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />,
      textColor: 'text-emerald-700 font-medium',
      label: 'Terverifikasi',
    },
    'Menunggu Verifikasi': {
      icon: <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />,
      textColor: 'text-sky-700 font-medium',
      label: 'Menunggu Verifikasi',
    },
    'Perlu Perbaikan': {
      icon: <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />,
      textColor: 'text-amber-700 font-medium',
      label: 'Perlu Perbaikan',
    },
    Draft: {
      icon: <FileEdit className="w-3.5 h-3.5 text-slate-500 shrink-0" />,
      textColor: 'text-slate-600 font-medium',
      label: 'Draft Tersimpan',
    },
    'Belum Diisi': {
      icon: <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" />,
      textColor: 'text-slate-400',
      label: 'Belum Diisi',
    },
  };

  const item = config[status] || config['Belum Diisi'];

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${item.textColor} whitespace-nowrap`}>
      {item.icon}
      {semesterLabel && (
        <>
          <span className="text-slate-500 font-normal">{semesterLabel}</span>
          <span aria-hidden="true" className="text-slate-300">
            ·
          </span>
        </>
      )}
      <span>{item.label}</span>
    </span>
  );
};
