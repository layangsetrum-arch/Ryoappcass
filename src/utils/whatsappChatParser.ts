/**
 * Parser cerdas untuk teks format chat pemesanan WhatsApp Ryoko Rent Malang & Batu
 * Disesuaikan dengan 13 Template Baku:
 * 1. Nama
 * 2. Alamat sesuai ktp
 * 3. Id pendukung
 * 4. Alamat saat ini : alamat rumah/kos/hotel
 * 5. Id sosmed
 * 6. No telp
 * 7. No telp darurat
 * 8. Jadwal mulai
 * 9. Jadwal selesai
 * 10. Lokasi pengantaran
 * 11. Lokasi penjemputan
 * 12. Model unit
 * 13. Jumlah helm
 */

import { SupportIdType } from '../types/ryoko';

export interface ParsedBookingChat {
  nama: string;
  alamatKtp: string;
  idPendukung: SupportIdType;
  alamatSaatIni: string;
  idSosmed: string;
  nomorWa: string;
  teleponDarurat: string;
  jamTanggalMulai: string; // Format ISO: YYYY-MM-DDTHH:mm
  jamTanggalSelesai: string; // Format ISO: YYYY-MM-DDTHH:mm
  lokasiDelivery: string;
  lokasiPengembalian: string;
  jenisMotorKeyword: string;
  jumlahHelm: number;
  catatanRapi: string;
}

export const STANDARD_BOOKING_TEMPLATE_TEXT = `*FORM PEMESANAN SEWA MOTOR RYOKO RENT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Silakan salin & lengkapi data pemesanan di bawah ini:

1. Nama :
2. Alamat sesuai KTP :
3. Id pendukung (SIM C/KTM/KTP/Paspor/NPWP) :
4. Alamat saat ini (Rumah/Kos/Hotel) :
5. Id sosmed (Instagram/TikTok/FB) :
6. No telp :
7. No telp darurat :
8. Jadwal mulai (Tgl & Jam Mulai) :
9. Jadwal selesai (Tgl & Jam Pengembalian) :
10. Lokasi pengantaran :
11. Lokasi penjemputan :
12. Model unit :
13. Jumlah helm (1 / 2 Helm) :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Kirimkan format yang sudah diisi ke nomor admin Ryoko Rent_`;

const MONTHS_ID: Record<string, string> = {
  januari: '01', jan: '01',
  februari: '02', feb: '02',
  maret: '03', mar: '03',
  april: '04', apr: '04',
  mei: '05',
  juni: '06', jun: '06',
  juli: '07', jul: '07',
  agustus: '08', agu: '08', ags: '08',
  september: '09', sep: '09',
  oktober: '10', okt: '10',
  november: '11', nov: '11',
  desember: '12', des: '12',
};

export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('08')) {
    return '628' + digits.slice(2);
  }
  if (digits.startsWith('62')) {
    return digits;
  }
  return digits;
}

export function parseIndonesianDate(text: string, defaultYear = 2026): string {
  if (!text) return '';
  const clean = text.toLowerCase().trim();

  // Pattern: 24 Oktober 2026 or 24 Oktober or 24/10/2026 or 24-10
  const monthMatch = clean.match(/(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/i);
  if (monthMatch) {
    const day = parseInt(monthMatch[1], 10);
    const monthKey = monthMatch[2].toLowerCase();
    const year = monthMatch[3] ? parseInt(monthMatch[3], 10) : defaultYear;

    const monthStr = MONTHS_ID[monthKey];
    if (monthStr && day >= 1 && day <= 31) {
      const dayStr = day.toString().padStart(2, '0');
      return `${year}-${monthStr}-${dayStr}`;
    }
  }

  // Pattern: 24/10 or 24/10/2026 or 2026-10-24
  const numericMatch = clean.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?/);
  if (numericMatch) {
    const day = parseInt(numericMatch[1], 10).toString().padStart(2, '0');
    const month = parseInt(numericMatch[2], 10).toString().padStart(2, '0');
    let year = numericMatch[3] ? parseInt(numericMatch[3], 10) : defaultYear;
    if (year < 100) year += 2000;
    return `${year}-${month}-${day}`;
  }

  return '';
}

export function parseTime(text: string): string {
  if (!text) return '09:00';
  const clean = text.trim().toLowerCase();

  // Pattern: 15.40, 15:40
  const colonDotMatch = clean.match(/(\d{1,2})[.:](\d{2})/);
  if (colonDotMatch) {
    let hour = parseInt(colonDotMatch[1], 10);
    const minute = colonDotMatch[2];
    if (hour < 24) {
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
  }

  // Pattern: standalone number like "3", "3 sore", "15"
  const singleMatch = clean.match(/(\d{1,2})/);
  if (singleMatch) {
    let hour = parseInt(singleMatch[1], 10);
    // Rental context: hour <= 6 without AM/PM is usually afternoon (e.g. jam 3 = 15:00)
    if (clean.includes('sore') || clean.includes('pm') || (hour <= 6 && !clean.includes('pagi'))) {
      hour += 12;
    }
    if (hour >= 24) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }

  return '09:00';
}

function cleanLocation(loc: string): string {
  const trimmed = loc.trim();
  if (!trimmed) return '';
  if (trimmed.toLowerCase().includes('begawan')) {
    return 'Apartemen Begawan Malang';
  }
  return trimmed;
}

export function parseWhatsAppBookingChat(rawText: string): ParsedBookingChat {
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);

  let nama = '';
  let alamatKtp = '';
  let idPendukung: SupportIdType = 'SIM_C';
  let alamatSaatIni = '';
  let idSosmed = '';
  let nomorWa = '';
  let teleponDarurat = '';

  let startDateRaw = '';
  let startTimeRaw = '';
  let lokasiDelivery = '';

  let endDateRaw = '';
  let endTimeRaw = '';
  let lokasiPengembalian = '';

  let jenisMotorKeyword = '';
  let jumlahHelm = 2;

  for (const line of lines) {
    const lower = line.toLowerCase();

    // 1. Nama
    if (lower.startsWith('1.') || lower.includes('nama :') || lower.includes('nama:')) {
      const parts = line.split(/(?:1\.\s*nama\s*:|nama\s*:)/i);
      if (parts[1]) nama = parts[1].trim();
    }
    // 2. Alamat sesuai KTP
    else if (lower.includes('alamat sesuai ktp') || lower.includes('alamat ktp') || lower.startsWith('2.')) {
      const parts = line.split(/(?:alamat sesuai ktp\s*:|alamat ktp\s*:|2\.\s*alamat[a-z\s]*:)/i);
      if (parts[1]) alamatKtp = parts[1].trim();
    }
    // 3. ID Pendukung
    else if (lower.includes('id pendukung') || lower.startsWith('3.')) {
      const parts = line.split(/(?:id pendukung[a-z\s()\/]*:|3\.\s*id[a-z\s()\/]*:)/i);
      if (parts[1]) {
        const val = parts[1].trim().toUpperCase();
        if (val.includes('KTM')) idPendukung = 'KTM';
        else if (val.includes('PASPOR')) idPendukung = 'Paspor';
        else if (val.includes('NPWP')) idPendukung = 'NPWP';
        else if (val.includes('BPJS')) idPendukung = 'BPJS';
        else if (val.includes('KARYAWAN') || val.includes('PEGAWAI')) idPendukung = 'Kartu_Pegawai';
        else idPendukung = 'SIM_C';
      }
    }
    // 4. Alamat saat ini (rumah/kos/hotel)
    else if (lower.includes('alamat saat ini') || lower.includes('rumah/kos/hotel') || lower.startsWith('4.')) {
      const parts = line.split(/(?:alamat saat ini[a-z\s:/]*:|4\.\s*alamat[a-z\s:/]*:)/i);
      if (parts[1]) alamatSaatIni = parts[1].trim();
    }
    // 5. ID Sosmed
    else if (lower.includes('id sosmed') || lower.includes('sosmed') || lower.includes('instagram') || lower.includes('facebook') || lower.startsWith('5.')) {
      const parts = line.split(/(?:id sosmed[a-z\s()\/]*:|5\.\s*id[a-z\s()\/]*:|instagram\s*:|facebook\s*:)/i);
      if (parts[1]) {
        idSosmed = parts[1].trim();
      }
    }
    // 6. No telp utama
    else if ((lower.includes('no telp') || lower.includes('nomor telepon') || lower.includes('no wa')) && !lower.includes('darurat') && !lower.startsWith('7.')) {
      const parts = line.split(/(?:no telp\s*:|nomor telepon\s*:|no wa\s*:|6\.\s*no[a-z\s]*:)/i);
      if (parts[1]) nomorWa = parts[1].trim();
    }
    // 7. No telp darurat
    else if (lower.includes('darurat') || lower.startsWith('7.')) {
      const parts = line.split(/(?:darurat\s*:|7\.\s*no[a-z\s]*:)/i);
      if (parts[1]) teleponDarurat = parts[1].trim();
    }

    // 8. Jadwal mulai (Tgl & Jam Ambil)
    else if (lower.includes('jadwal mulai') || lower.startsWith('8.') || lower.includes('mulai sewa') || lower.includes('tgl/bln (mulai')) {
      const parts = line.split(/(?:jadwal mulai[a-z\s()\/]*:|8\.\s*jadwal[a-z\s()\/]*:|:\s*)/i);
      if (parts.length > 1) {
        const text = parts[parts.length - 1].trim();
        // Check if both date and time are in text (e.g. 24 Oktober 15.40)
        startDateRaw = text;
        const timePart = text.match(/\b\d{1,2}[.:]\d{2}\b/);
        if (timePart) {
          startTimeRaw = timePart[0];
        }
      }
    }
    else if (lower.includes('jam ambil') || (lower.includes('↗️') && lower.includes('jam'))) {
      const parts = line.split(/:\s*/);
      if (parts[1]) startTimeRaw = parts[1].trim();
    }

    // 9. Jadwal selesai (Tgl & Jam Kembali)
    else if (lower.includes('jadwal selesai') || lower.startsWith('9.') || (lower.includes('pengembalian') && (lower.includes('hari/tgl') || lower.includes('tgl/bln')))) {
      const parts = line.split(/(?:jadwal selesai[a-z\s()\/]*:|9\.\s*jadwal[a-z\s()\/]*:|:\s*)/i);
      if (parts.length > 1) {
        const text = parts[parts.length - 1].trim();
        endDateRaw = text;
        const timePart = text.match(/\b\d{1,2}[.:]\d{2}\b/);
        if (timePart) {
          endTimeRaw = timePart[0];
        }
      }
    }
    else if (lower.includes('jam pengembalian') || (lower.includes('↙️') && lower.includes('jam'))) {
      const parts = line.split(/(?:jam[a-z\s]*[:\s]|:\s*)/i);
      if (parts.length > 1) {
        endTimeRaw = parts[parts.length - 1].trim();
      }
    }

    // 10. Lokasi pengantaran
    else if (lower.includes('lokasi pengantaran') || lower.startsWith('10.') || lower.includes('lokasi delivery')) {
      const parts = line.split(/(?:lokasi pengantaran\s*:|10\.\s*lokasi[a-z\s]*:|lokasi delivery\s*:|:\s*)/i);
      if (parts.length > 1) lokasiDelivery = parts[parts.length - 1].trim();
    }

    // 11. Lokasi penjemputan
    else if (lower.includes('lokasi penjemputan') || lower.startsWith('11.') || lower.includes('lokasi pengembalian')) {
      const parts = line.split(/(?:lokasi penjemputan\s*:|11\.\s*lokasi[a-z\s]*:|lokasi pengembalian[a-z\s]*:|:\s*)/i);
      if (parts.length > 1) lokasiPengembalian = parts[parts.length - 1].trim();
    }

    // 12. Model unit
    else if (lower.includes('model unit') || lower.startsWith('12.') || lower.includes('type unit') || lower.includes('jenis motor')) {
      const parts = line.split(/(?:model unit\s*:|12\.\s*model[a-z\s]*:|type unit[a-z\s()]*:|jenis motor\s*:|:\s*)/i);
      if (parts.length > 1) jenisMotorKeyword = parts[parts.length - 1].trim();
    }

    // 13. Jumlah helm
    else if (lower.includes('jumlah helm') || lower.startsWith('13.') || lower.includes('helm')) {
      const parts = line.split(/(?:jumlah helm\s*:|13\.\s*jumlah[a-z\s]*:|helm\s*:|:\s*)/i);
      if (parts.length > 1) {
        const count = parseInt(parts[parts.length - 1].replace(/[^0-9]/g, ''), 10);
        if (!isNaN(count) && count > 0) jumlahHelm = count;
      }
    }
  }

  // Current year fallback
  const currentYear = new Date().getFullYear() || 2026;
  const parsedStartDate = parseIndonesianDate(startDateRaw, currentYear) || `${currentYear}-10-24`;
  const parsedStartTime = parseTime(startTimeRaw || '15:40');

  const parsedEndDate = parseIndonesianDate(endDateRaw, currentYear) || `${currentYear}-10-25`;
  const parsedEndTime = parseTime(endTimeRaw || '15:00');

  const jamTanggalMulai = `${parsedStartDate}T${parsedStartTime}`;
  const jamTanggalSelesai = `${parsedEndDate}T${parsedEndTime}`;

  // Build clean notes
  const noteParts: string[] = [];
  if (alamatKtp) noteParts.push(`KTP: ${alamatKtp}`);
  if (alamatSaatIni) noteParts.push(`Alamat Saat Ini: ${alamatSaatIni}`);
  if (idSosmed && idSosmed !== '-') noteParts.push(`Sosmed: ${idSosmed}`);
  if (teleponDarurat) noteParts.push(`Kontak Darurat: ${teleponDarurat}`);
  noteParts.push(`${jumlahHelm} Helm SNI`);

  const catatanRapi = noteParts.join(' | ');

  return {
    nama: nama || '',
    alamatKtp: alamatKtp || '',
    idPendukung,
    alamatSaatIni: cleanLocation(alamatSaatIni || lokasiDelivery || ''),
    idSosmed: idSosmed || '',
    nomorWa: normalizePhoneNumber(nomorWa || ''),
    teleponDarurat: teleponDarurat || '',
    jamTanggalMulai,
    jamTanggalSelesai,
    lokasiDelivery: cleanLocation(lokasiDelivery || alamatSaatIni || 'Apartemen Begawan Malang'),
    lokasiPengembalian: cleanLocation(lokasiPengembalian || lokasiDelivery || 'Apartemen Begawan Malang'),
    jenisMotorKeyword: jenisMotorKeyword || 'scoopy',
    jumlahHelm,
    catatanRapi,
  };
}

/**
 * Format teks resmi WhatsApp untuk konfirmasi order / serah terima berbasis 13 field
 */
export function formatOfficialBookingResponse(booking: {
  noBooking: string;
  nama: string;
  alamatKtp?: string;
  idPendukung?: string;
  alamatSaatIni?: string;
  idSosmed?: string;
  nomorWa: string;
  noTelpDarurat?: string;
  motorNama: string;
  kodeUnit?: string;
  tglMulai: string;
  jamMulai: string;
  tglSelesai: string;
  jamSelesai: string;
  lokasiAntar: string;
  lokasiJemput: string;
  totalHarga: number;
  jumlahHelm?: number;
}): string {
  const helm = booking.jumlahHelm || 2;
  const unitInfo = booking.kodeUnit ? `${booking.motorNama} [${booking.kodeUnit}]` : booking.motorNama;

  return `🛵 *KONFIRMASI BOOKING RYOKO RENT MOTOR MALANG & BATU* 🛵
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Halo Kak *${booking.nama}*, terima kasih telah memesan di Ryoko Rent!
Berikut rekap rincian pemesanan resmi Anda:

📋 *DETAIL PEMESANAN (13 POIN BAKU):*
1. Nama              : *${booking.nama}*
2. Alamat KTP        : ${booking.alamatKtp || '-'}
3. ID Pendukung      : ${booking.idPendukung || 'SIM C'}
4. Alamat Saat Ini   : 🏠 *${booking.alamatSaatIni || booking.lokasiAntar}*
5. ID Sosmed         : ${booking.idSosmed || '-'}
6. No. Telp / WA     : *${booking.nomorWa}*
7. No. Telp Darurat  : ${booking.noTelpDarurat || '-'}
8. Jadwal Mulai      : ↗️ *${booking.tglMulai}*, Pukul *${booking.jamMulai} WIB*
9. Jadwal Selesai    : ↙️ *${booking.tglSelesai}*, Pukul *${booking.jamSelesai} WIB*
10. Lokasi Antar     : 📍 *${booking.lokasiAntar}*
11. Lokasi Jemput    : 📍 *${booking.lokasiJemput}*
12. Model Unit       : 🏍️ *${unitInfo}*
13. Jumlah Helm      : 🪖 *${helm} Helm SNI* (+ Jas Hujan & Phone Holder)

💰 *RINCIAN BIAYA & STATUS:*
• Total Biaya : *Rp ${booking.totalHarga.toLocaleString('id-ID')}*
• Status Sewa : *TERJADWAL / SIAP ANTAR*

⚠️ *KETENTUAN:*
• Tunjukkan E-KTP asli & dokumen pendukung saat kurir menyerahkan unit di lokasi.
• Terima kasih dan selamat beraktivitas di Malang & Batu bersama Ryoko Rent! 🌟`;
}
