import {
  BookingRecord,
  UnitExchangeLog,
  OvertimePenaltyResult,
  ServiceRecord,
} from '../types/ryoko';
import { formatRupiah } from './bookingEngine';

/**
 * Normalisasi nomor HP ke format internasional WhatsApp (628xxx)
 */
export function normalizeWhatsAppNumber(phone: string): string {
  if (!phone) return '6281234567890';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('08')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62') && clean.length > 5) {
    clean = '62' + clean;
  }
  return clean || '6281234567890';
}

/**
 * Tautan WhatsApp generik dari nomor dan teks
 */
export function generateWhatsAppLink(phone: string, text: string): string {
  const target = normalizeWhatsAppNumber(phone);
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(target)}&text=${encodeURIComponent(text)}`;
}

/**
 * 1. Tautan WhatsApp untuk Konfirmasi Booking Baru (D-03, D-09, Bagian 10)
 */
export function generateBookingConfirmationWhatsAppUrl(
  booking: BookingRecord,
  adminPhone: string
): string {
  const targetPhone = normalizeWhatsAppNumber(adminPhone);
  const poolLabel = booking.pool === 'batu' ? 'Pool Batu (Diponegoro)' : 'Pool Malang (Dinoyo)';
  const customerTypeLabel = booking.tandaPelanggan === 'langganan' ? 'Pelanggan Langganan' : 'Pelanggan Baru';

  const lines = [
    'Halo Admin *Ryokourent Malang & Batu*, berikut rincian pemesanan sewa motor (Format Baku 13 Poin):',
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `1. *Nama:* ${booking.nama}`,
    `2. *Alamat KTP:* ${booking.alamatKtp || '-'}`,
    `3. *ID Pendukung:* ${booking.jenisIdPendukung || 'SIM C'}`,
    `4. *Alamat Saat Ini (Rumah/Kos/Hotel):* ${booking.alamatSaatIni || booking.alamatPengantaran || '-'}`,
    `5. *ID Sosmed:* ${booking.idSosmed || '-'}`,
    `6. *No. Telp:* ${booking.nomorWa || '-'}`,
    `7. *No. Telp Darurat:* ${booking.noTelpDarurat || '-'}`,
    `8. *Jadwal Mulai:* ${booking.jamTanggalMulai.replace('T', ' ')} WIB`,
    `9. *Jadwal Selesai:* ${booking.jamTanggalSelesai.replace('T', ' ')} WIB`,
    `10. *Lokasi Pengantaran:* ${booking.alamatPengantaran || poolLabel}`,
    `11. *Lokasi Penjemputan:* ${booking.alamatPenjemputan || poolLabel}`,
    `12. *Model Unit:* ${booking.snapshotNamaMotor}`,
    `13. *Jumlah Helm:* ${booking.jumlahHelm || 2} Helm SNI`,
    '',
    `*Paket / Durasi:* ${booking.labelDurasi}`,
    `*Estimasi Total Sewa:* ${formatRupiah(booking.totalHargaEstimasi)}`,
    '*Fasilitas Termasuk:* Helm SNI + Jas Hujan + Phone Holder',
  ];

  if (booking.snapshotKodeUnit) {
    lines.push(`*Unit Fisik Terkunci:* ${booking.snapshotKodeUnit}`);
  }

  if (booking.kurirPengantar) {
    lines.push(`*Kurir Pengantar:* ${booking.kurirPengantar}`);
  }

  if (booking.kategoriTarif === 'jam') {
    lines.push('');
    lines.push('_*Ketentuan ShortRent (D-27): Keterlambatan >= 60 menit otomatis masuk kategori paket jam di atasnya (3j->6j->9j->12j). Paket 12 jam telat >= 60 mnt dikenakan denda harian._');
  }

  if (booking.luarJamOperasional) {
    lines.push('');
    lines.push('_*Catatan Jam Operasional (D-06): Jadwal ambil/kembali di luar jam reguler (07.00-23.00 WIB). Layanan siap diantar sesuai konfirmasi._');
  }

  lines.push('');
  lines.push('Mohon konfirmasi kesiapan unit. Terima kasih!');

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 2. Tautan WhatsApp Kirim ke Penyewa: Pemberitahuan Unit Siap & Disetujui
 */
export function generateApprovalNoticeToCustomerWhatsAppUrl(booking: BookingRecord): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);
  const poolLabel = booking.pool === 'batu' ? 'Pool Batu (Diponegoro)' : 'Pool Malang (Dinoyo)';

  const lines = [
    `Halo Kak *${booking.nama}*,`,
    'Kabar gembira! Pemesanan sewa motor Anda di *Ryokourent Malang & Batu* telah *DISETUJUI & UNIT TERKUNCI*. 🛵✨',
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Model Motor:* ${booking.snapshotNamaMotor}`,
    `*Kode Unit:* ${booking.snapshotKodeUnit || 'Telah Dialokasikan'}`,
    `*Durasi Sewa:* ${booking.labelDurasi}`,
    `*Jadwal Ambil:* ${booking.jamTanggalMulai.replace('T', ' ')} WIB`,
    `*Lokasi Serah Terima:* ${booking.alamatPengantaran || poolLabel}`,
    `*Total Sewa:* ${formatRupiah(booking.totalHargaEstimasi)}`,
    '',
    'Tim kami akan menghubungi saat pengantaran unit. Sampai jumpa di Malang & Batu! 😊',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 3. Tautan WhatsApp Kirim ke Penyewa: Berita Acara Serah Terima Unit (Mulai Sewa)
 */
export function generateHandoverNoticeToCustomerWhatsAppUrl(booking: BookingRecord): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);

  const lines = [
    `*BUKTI SERAH TERIMA UNIT — RYOKOURENT* 🛵`,
    `Halo Kak *${booking.nama}*, unit motor telah resmi diserahterimakan:`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Unit Motor:* ${booking.snapshotNamaMotor} (Kode: *${booking.snapshotKodeUnit}*)`,
    `*Waktu Mulai Sewa:* ${booking.jamTanggalMulai.replace('T', ' ')} WIB`,
    `*Tenggat Waktu Kembali:* ${booking.jamTanggalSelesai.replace('T', ' ')} WIB`,
    `*Lokasi Penjemputan:* ${booking.alamatPenjemputan || 'Pool Ryokourent'}`,
    '*Kelengkapan Diterima:* 2 Helm SNI + Jas Hujan + STNK Asli',
    '',
    '⚠️ _Tips: Hubungi kami jika membutuhkan bantuan darurat di jalan. Selamat menikmati perjalanan!_',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 4. Tautan WhatsApp Kirim ke Penyewa: Kwitansi Selesai Sewa & Denda (D-27)
 */
export function generateReturnReceiptWhatsAppUrl(
  booking: BookingRecord,
  denda: OvertimePenaltyResult,
  returnPoolLabel: string
): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);
  const totalAkhir = booking.totalHargaEstimasi + (denda.terlambat ? denda.nominalDenda : 0);

  const lines = [
    `*BUKTI PENGEMBALIAN & SELESAI SEWA — RYOKOURENT* ✅`,
    `Terima kasih Kak *${booking.nama}* telah mempercayakan perjalanan bersama Ryokourent!`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Unit Motor:* ${booking.snapshotNamaMotor} (${booking.snapshotKodeUnit})`,
    `*Durasi Sewa:* ${booking.labelDurasi}`,
    `*Tarif Sewa Pokok:* ${formatRupiah(booking.totalHargaEstimasi)}`,
    `*Lokasi Pengembalian:* ${returnPoolLabel}`,
  ];

  if (denda.terlambat && denda.nominalDenda > 0) {
    lines.push(`*Denda Keterlambatan (D-27):* ${formatRupiah(denda.nominalDenda)} (${denda.menitTelat} menit telat)`);
    lines.push(`*Rincian Denda:* ${denda.keterangan}`);
    lines.push(`*TOTAL PEMBAYARAN AKHIR:* ${formatRupiah(totalAkhir)}`);
  } else {
    lines.push('*Status Keterlambatan:* Tepat Waktu (Tidak Ada Denda)');
    lines.push(`*TOTAL SEWA:* ${formatRupiah(booking.totalHargaEstimasi)} (LUNAS)`);
  }

  lines.push('');
  lines.push('Unit dan perlengkapan telah diperiksa dan diterima dalam kondisi baik.');
  lines.push('Sampai jumpa di liburan Anda berikutnya di Malang & Kota Batu! 🙏⭐');

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 5. Tautan WhatsApp Pemberitahuan Tukar Unit (D-19)
 */
export function generateUnitExchangeNoticeWhatsAppUrl(
  booking: BookingRecord,
  exchange: UnitExchangeLog
): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);

  const lines = [
    `*PEMBERITAHUAN TUKAR UNIT MOTOR — RYOKOURENT* 🔄`,
    `Halo Kak *${booking.nama}*, proses pertukaran armada telah dicatat:`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Unit Semula:* ${exchange.unitLamaKode}`,
    `*Unit Pengganti:* *${exchange.unitBaruKode}*`,
    `*Waktu Pertukaran:* ${exchange.waktu}`,
    `*Alasan:* ${exchange.alasan}`,
    `*Operator Penanggung Jawab:* ${exchange.operator}`,
    '',
    'Semua perlengkapan (STNK, helm, jas hujan) telah disesuaikan dengan unit baru.',
    'Terima kasih atas pengertian dan kerjasamanya!',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 6. Tautan WhatsApp: Surat Tugas / Penugasan Kurir Pengantar & Penjemput (Bagian 10 Baru)
 */
export function generateCourierTaskWhatsAppUrl(
  booking: BookingRecord,
  courierPhone: string,
  courierName: string
): string {
  const targetPhone = normalizeWhatsAppNumber(courierPhone);

  const lines = [
    `*SURAT TUGAS PENGANTARAN / PENJEMPUTAN MOTOR* 🛵📦`,
    `Kepada Rekan Kurir: *${courierName}*`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Penyewa:* ${booking.nama}`,
    `*No. HP Penyewa:* ${booking.nomorWa || '-'}`,
    `*Unit Motor:* ${booking.snapshotNamaMotor} (Kode: *${booking.snapshotKodeUnit || 'Siapkan di Pool'}*)`,
    `*Jadwal:* ${booking.jamTanggalMulai.replace('T', ' ')} WIB`,
    `*Lokasi Pengantaran:* ${booking.alamatPengantaran}`,
    `*Lokasi Penjemputan:* ${booking.alamatPenjemputan}`,
    `*Durasi Sewa:* ${booking.labelDurasi}`,
    '',
    'Harap cek kelengkapan unit (2 Helm SNI + Jas Hujan + STNK Asli) sebelum diserahterimakan.',
    'Semangat dan utamakan keselamatan berkendara! 🛵💨',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 7. Tautan WhatsApp: Tagihan Sewa Bulanan (1 Bulan) (Bagian 10 Baru)
 */
export function generateMonthlyInvoiceWhatsAppUrl(booking: BookingRecord): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);

  const lines = [
    `*INVOICE SEWA BULANAN (30 HARI) — RYOKOURENT* 📄🏍️`,
    `Yth. Kak *${booking.nama}*, rincian tagihan sewa bulanan Anda:`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Model Motor:* ${booking.snapshotNamaMotor} (Kode: *${booking.snapshotKodeUnit}*)`,
    `*Paket Durasi:* 1 Bulan (30 Hari Penuh)`,
    `*Periode Sewa:* ${booking.jamTanggalMulai.replace('T', ' ')} s/d ${booking.jamTanggalSelesai.replace('T', ' ')} WIB`,
    `*Total Tarif Bulanan:* ${formatRupiah(booking.totalHargaEstimasi)}`,
    '',
    '✨ *Benefit Sewa Bulanan:* Termasuk gratis ganti oli mesin 1x per bulan di bengkel rekanan resmi kami.',
    'Pembayaran dapat dilakukan melalui transfer atau kasir pool kami. Terima kasih!',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 8. Tautan WhatsApp: Pengingat Jatuh Tempo Pengembalian (H-2 Jam) (Bagian 10 Baru)
 */
export function generateDueReminderWhatsAppUrl(booking: BookingRecord): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);

  const lines = [
    `*PENGINGAT WAKTU PENGEMBALIAN MOTOR — RYOKOURENT* ⏰`,
    `Halo Kak *${booking.nama}*, mengingatkan masa sewa motor Anda akan segera berakhir:`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Unit:* ${booking.snapshotKodeUnit} (${booking.snapshotNamaMotor})`,
    `*Tenggat Waktu Kembali:* *${booking.jamTanggalSelesai.replace('T', ' ')} WIB*`,
    `*Lokasi Pengembalian:* ${booking.alamatPenjemputan || 'Pool Ryokourent'}`,
    '',
    'Jika Kakak ingin memperpanjang masa sewa, mohon segera hubungi kami sebelum waktu sewa berakhir agar unit dapat diperpanjang tanpa denda keterlambatan.',
    'Terima kasih dan hati-hati di jalan! 🙏',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 8b. Tautan WhatsApp: Pengingat Jatuh Tempo Real-Time Bergradasi (TASK-008: Aman, H-2 Jam, H-1 Jam, Overdue)
 */
export function generateGradedDueReminderWhatsAppUrl(
  booking: BookingRecord,
  urgency: 'aman' | 'h_2_jam' | 'h_1_jam' | 'overdue',
  remainingOrLateText: string,
  penaltyInfo?: { nominalDenda: number; dendaFormat: string; menitTelat: number }
): string {
  const customerPhone = normalizeWhatsAppNumber(booking.nomorWa);
  const lokasiKembali = booking.alamatPenjemputan || (booking.pool === 'batu' ? 'Pool Batu (Diponegoro)' : 'Pool Malang (Dinoyo)');

  let headerTitle = '*PENGINGAT JADWAL PENGEMBALIAN MOTOR — RYOKOURENT* ⏰';
  let urgencyNote = '';

  if (urgency === 'h_2_jam') {
    headerTitle = '*PENGINGAT JATUH TEMPO SEWA (H-2 JAM) — RYOKOURENT* ⏳';
    urgencyNote = `Waktu sewa Anda tersisa sekitar *${remainingOrLateText}* lagi. Mohon persiapkan unit atau beri kabar jika berencana memperpanjang masa sewa.`;
  } else if (urgency === 'h_1_jam') {
    headerTitle = '⚠️ *PERINGATAN SEWA AKAN BERAKHIR (< 1 JAM) — RYOKOURENT* ⚠️';
    urgencyNote = `Perhatian: Masa sewa Anda tersisa *${remainingOrLateText}* lagi! Harap segera menuju lokasi pengembalian atau hubungi kami untuk konfirmasi perpanjangan agar terhindar dari denda toleransi (D-27).`;
  } else if (urgency === 'overdue') {
    headerTitle = '🚨 *ALERT TENGGAT WAKTU TERLEWATI (OVERDUE) — RYOKOURENT* 🚨';
    const dendaStr = penaltyInfo && penaltyInfo.nominalDenda > 0
      ? `Denda berjalan saat ini: *${penaltyInfo.dendaFormat}* (${penaltyInfo.menitTelat} menit terlambat).`
      : 'Unit telah melewati batas toleransi pengembalian.';
    urgencyNote = `PERHATIAN: Masa sewa Anda telah terlewat *${remainingOrLateText}* (${dendaStr}). Mohon segera serahkan unit ke petugas/pool atau segera konfirmasi ke kasir kami!`;
  } else {
    urgencyNote = `Waktu sewa Anda masih aktif (${remainingOrLateText} tersisa). Selamat menikmati perjalanan Anda bersama Ryokourent!`;
  }

  const lines = [
    headerTitle,
    `Halo Kak *${booking.nama}*, berikut konfirmasi status sewa armada motor Anda:`,
    '',
    `*No. Booking:* ${booking.noBooking}`,
    `*Unit Motor:* ${booking.snapshotNamaMotor} (Kode: *${booking.snapshotKodeUnit}*)`,
    `*Tenggat Waktu Kembali:* *${booking.jamTanggalSelesai.replace('T', ' ')} WIB*`,
    `*Lokasi Pengembalian:* ${lokasiKembali}`,
    '',
    urgencyNote,
    '',
    'Jika membutuhkan penjemputan unit di lokasi atau perpanjangan sewa, silakan langsung balas pesan ini.',
    'Terima kasih dan salam aman berkendara! 🛵💨',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(customerPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 9. Tautan WhatsApp: Notifikasi Unit Selesai Servis (Bagian 10 Baru)
 */
export function generateServiceDoneWhatsAppUrl(service: ServiceRecord, adminPhone: string): string {
  const targetPhone = normalizeWhatsAppNumber(adminPhone);

  const lines = [
    `*NOTIFIKASI UNIT SELESAI SERVIS — RYOKOURENT* 🔧✅`,
    `Laporan pemeliharaan armada:`,
    '',
    `*Kode Unit:* ${service.kodeUnit}`,
    `*Kategori Servis:* ${service.kategoriServis.toUpperCase().replace('_', ' ')}`,
    `*Tanggal Servis:* ${service.tanggal}`,
    `*Kilometer (KM):* ${service.kmMotor.toLocaleString('id-ID')} KM`,
    `*Biaya:* ${formatRupiah(service.biaya)}`,
    `*Bengkel / Mekanik:* ${service.bengkelMekanik}`,
    `*Keterangan:* ${service.keterangan}`,
    '',
    'Unit telah siap kembali beroperasi dan diparkir di Pool.',
  ];

  const message = lines.join('\n');
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(message)}`;
}

/**
 * 10. Tautan WhatsApp: Kirim Template Form Kosong 13 Poin ke Calon Pelanggan
 */
export function generateStandardBookingTemplateText(): string {
  return `*FORM PEMESANAN SEWA MOTOR RYOKO RENT*
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Silakan lengkapi data pemesanan di bawah ini:

1. Nama :
2. Alamat sesuai KTP :
3. ID pendukung (SIM C/KTM/Paspor/NPWP) :
4. Alamat saat ini (Rumah/Kos/Hotel) :
5. ID sosmed (Instagram/TikTok/FB) :
6. No telp :
7. No telp darurat :
8. Jadwal mulai (Tgl & Jam Ambil) :
9. Jadwal selesai (Tgl & Jam Kembali) :
10. Lokasi pengantaran :
11. Lokasi penjemputan :
12. Model unit :
13. Jumlah helm (1 / 2 Helm) :

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_Kirimkan format yang sudah diisi ke admin Ryoko Rent Malang & Batu_`;
}

export function generateEmptyBookingFormWhatsAppUrl(phone: string): string {
  const targetPhone = normalizeWhatsAppNumber(phone);
  const text = generateStandardBookingTemplateText();
  return `https://api.whatsapp.com/send?phone=${encodeURIComponent(targetPhone)}&text=${encodeURIComponent(text)}`;
}

