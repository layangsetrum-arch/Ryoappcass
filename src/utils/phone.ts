/**
 * Utility untuk normalisasi nomor telepon ke format WhatsApp (62xxx)
 */
export function toWaNumber(phone?: string | null): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('08')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62') && clean.length > 5) {
    clean = '62' + clean;
  }
  return clean;
}
