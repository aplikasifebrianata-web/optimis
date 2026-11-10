/**
 * Format angka menjadi Rupiah lengkap (contoh: Rp 5.100.000.000)
 */
export function formatRupiah(value: number | null | undefined, includePrefix = true): string {
  const num = Number(value) || 0;
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(num);
  return includePrefix ? `Rp ${formatted}` : formatted;
}

/**
 * Format angka Rupiah ringkas untuk label grafik / kartu (contoh: Rp 5,10 M atau Rp 680 Jt)
 */
export function formatRupiahCompact(value: number | null | undefined): string {
  const num = Number(value) || 0;
  if (num >= 1_000_000_000_000) {
    return `Rp ${(num / 1_000_000_000_000).toFixed(2).replace('.', ',')} T`;
  }
  if (num >= 1_000_000_000) {
    return `Rp ${(num / 1_000_000_000).toFixed(2).replace('.', ',')} M`;
  }
  if (num >= 1_000_000) {
    return `Rp ${(num / 1_000_000).toFixed(1).replace('.', ',')} Jt`;
  }
  return formatRupiah(num);
}

/**
 * Format angka ribuan biasa (contoh: 48.500)
 */
export function formatNumber(value: number | null | undefined): string {
  const num = Number(value) || 0;
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Parse string berformat ribuan menjadi angka murni (numeric)
 */
export function parseNumericInput(raw: string): number {
  const digitsOnly = raw.replace(/[^\d]/g, '');
  if (!digitsOnly) return 0;
  const parsed = parseInt(digitsOnly, 10);
  return isNaN(parsed) || parsed < 0 ? 0 : parsed;
}

/**
 * Format input kode rekening otomatis dengan titik: _.__.__._.__.____
 * Total 12 digit angka: 1 + 2 + 2 + 1 + 2 + 4 = 12 digit
 * Contoh input numerik "219022010011" -> "2.19.02.2.01.0011"
 */
export function formatKodeRekening(raw: string): string {
  const trimmed = raw.trim().toUpperCase();
  if (trimmed.startsWith('X')) {
    return trimmed.replace(/[^0-9X.]/g, '').slice(0, 20);
  }
  // Ambil maksimal 12 digit angka
  const digits = raw.replace(/[^\d]/g, '').slice(0, 12);
  if (!digits) return '';

  const parts: string[] = [];
  if (digits.length > 0) parts.push(digits.slice(0, 1));
  if (digits.length > 1) parts.push(digits.slice(1, 3));
  if (digits.length > 3) parts.push(digits.slice(3, 5));
  if (digits.length > 5) parts.push(digits.slice(5, 6));
  if (digits.length > 6) parts.push(digits.slice(6, 8));
  if (digits.length > 8) parts.push(digits.slice(8, 12));

  return parts.join('.');
}

/**
 * Format tanggal ISO ke format Indonesia (contoh: 05 Jul 2026, 14:20 WIB)
 */
export function formatDateTimeID(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return isoString;
  }
}

export function formatDateShortID(isoString: string | null | undefined): string {
  if (!isoString) return '-';
  try {
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  } catch {
    return isoString;
  }
}
