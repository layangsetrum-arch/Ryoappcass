import {
  BookingRecord,
  BookingStatus,
  MotorModel,
  OvertimePenaltyResult,
  RyokoDatabase,
  PhysicalUnit,
  TariffCategory,
  DurationOption,
  RentalPackage,
} from '../types/ryoko';

export const TURNAROUND_BUFFER_SECONDS = 60 * 60; // 60 menit = 3600 detik (BR-04 revisi)

/**
 * Pembersih teks standar (BR-06: sistem offline dan tidak memerlukan sensor NIK ketat)
 */
export function sanitizeTextNoNik(text: string): string {
  if (!text) return '';
  // Redact 16-digit numeric pattern into masked asterisks (TASK-020 & F-14)
  return text.replace(/\b(\d{4})\d{8}(\d{4})\b/g, '$1********$2').trim();
}

/**
 * Deteksi NIK (opsional / non-blocking)
 */
export function containsNikPattern(text: string): boolean {
  if (!text) return false;
  return /(?:\d[\s\-]?){16}/.test(text);
}

/**
 * Format string tanggal ke Epoch detik WIB
 */
export function parseWibToEpoch(dateTimeStr: string): number {
  if (!dateTimeStr) return 0;
  // Pastikan timezone Asia/Jakarta (+07:00) dipatuhi
  if (!dateTimeStr.includes('+') && !dateTimeStr.endsWith('Z')) {
    // If format YYYY-MM-DDTHH:mm, append +07:00
    const normalized = dateTimeStr.length === 16 ? `${dateTimeStr}:00+07:00` : `${dateTimeStr}+07:00`;
    const dt = new Date(normalized);
    if (!isNaN(dt.getTime())) {
      return Math.floor(dt.getTime() / 1000);
    }
  }
  const date = new Date(dateTimeStr);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Konversi epoch detik ke string input datetime-local berzona waktu Asia/Jakarta (WIB)
 */
export function epochToWibInput(epoch: number): string {
  if (!epoch) return '';
  const d = new Date(epoch * 1000);
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(d);
  const map: Record<string, string> = {};
  parts.forEach(p => {
    map[p.type] = p.value;
  });
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

/**
 * Helper ID numerik terurut berikutnya bebas tabrakan (F-02 & TASK-020)
 */
export function nextId<T extends { id: number }>(items: T[]): number {
  if (!items || items.length === 0) return 1;
  const max = items.reduce((m, item) => (item.id > m ? item.id : m), 0);
  return max + 1;
}

/**
 * Format epoch detik ke tampilan tanggal WIB
 */
export function formatEpochToWib(epoch: number): string {
  if (!epoch) return '-';
  const d = new Date(epoch * 1000);
  return (
    d.toLocaleDateString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }) +
    ' ' +
    d.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }) +
    ' WIB'
  );
}

/**
 * Periksa apakah jadwal berada di luar jam operasional 07:00 - 23:00 WIB (D-06)
 */
export function isOutsideOperationalHours(dateTimeStr: string): boolean {
  if (!dateTimeStr) return false;
  const epoch = parseWibToEpoch(dateTimeStr);
  const d = new Date(epoch * 1000);
  const hourStr = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: 'numeric',
    hour12: false,
  }).format(d);
  const hours = parseInt(hourStr, 10);
  return hours < 7 || hours >= 23;
}

/**
 * Generator Nomor Booking Atomik RYK-YYYYMMDD-XXX (Max Sequence Safe)
 */
export function generateBookingNumber(db: RyokoDatabase): string {
  const now = new Date();
  const ymdFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const ymd = ymdFormatter.format(now).replace(/-/g, '');
  const prefix = `RYK-${ymd}-`;

  const maxSeq = db.bookings.reduce((max, b) => {
    if (b.noBooking && b.noBooking.startsWith(prefix)) {
      const seqStr = b.noBooking.slice(prefix.length);
      const seq = parseInt(seqStr, 10);
      if (!isNaN(seq) && seq > max) return seq;
    }
    return max;
  }, 0);

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

/**
 * Format mata uang Rupiah
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Kalkulator Denda Keterlambatan Cerdas (D-27 & BR-04/05 Revisi)
 */
export function calculateOvertimePenalty(
  booking: BookingRecord,
  motor: MotorModel,
  actualReturnEpoch?: number
): OvertimePenaltyResult {
  const endEpoch = booking.endEpoch || parseWibToEpoch(booking.jamTanggalSelesai);
  const returnEpoch =
    actualReturnEpoch ||
    booking.actualReturnEpoch ||
    (booking.selesaiAt ? parseWibToEpoch(booking.selesaiAt) : Math.floor(Date.now() / 1000));

  const dendaHarian = motor.dendaHarianPerJam || 20000;

  if (!endEpoch || returnEpoch <= endEpoch) {
    return {
      terlambat: false,
      menitTelat: 0,
      nominalDenda: 0,
      dendaFormat: 'Rp 0 (Tepat Waktu)',
      keterangan: 'Tepat waktu / belum melewati jadwal kembali.',
    };
  }

  const lateSeconds = returnEpoch - endEpoch;
  const lateMinutes = Math.floor(lateSeconds / 60);

  // KASUS A: Kategori ShortRent Jam (D-27)
  if (booking.kategoriTarif === 'jam' || ['3_jam', '6_jam', '9_jam', '12_jam'].includes(booking.pilihanDurasi)) {
    if (lateMinutes < 60) {
      return {
        terlambat: false,
        menitTelat: lateMinutes,
        nominalDenda: 0,
        dendaFormat: 'Rp 0 (Toleransi < 60 mnt)',
        keterangan: `Terlambat ${lateMinutes} menit (masih dalam toleransi < 60 menit ShortRent D-27).`,
      };
    }

    const p3 = motor.harga3Jam;
    const p6 = motor.harga6Jam;
    const p9 = motor.harga9Jam;
    const p12 = motor.harga12Jam;

    // ShortRent 12 Jam -> Denda sama dengan denda harian per jam
    if (booking.pilihanDurasi === '12_jam') {
      const lateHours = Math.ceil(lateMinutes / 60);
      const nominal = lateHours * dendaHarian;
      return {
        terlambat: true,
        menitTelat: lateMinutes,
        nominalDenda: nominal,
        dendaFormat: formatRupiah(nominal),
        keterangan: `ShortRent 12 Jam telat ${lateMinutes} menit (${lateHours} jam) x ${formatRupiah(dendaHarian)}/jam.`,
      };
    }

    // ShortRent 9 Jam -> Step Up ke 12 Jam
    if (booking.pilihanDurasi === '9_jam') {
      const selisihStepUp = p12 - p9;
      const extraMinutes = lateMinutes - 60;
      let nominal = selisihStepUp;
      let ket = `ShortRent 9 Jam telat >= 60 mnt: Otomatis Step-Up ke paket 12 Jam (+${formatRupiah(selisihStepUp)}).`;

      if (extraMinutes > 0) {
        const extraHours = Math.ceil(extraMinutes / 60);
        const dendaTambahan = extraHours * dendaHarian;
        nominal += dendaTambahan;
        ket += ` Ditambah keterlambatan di atas 12 Jam (${extraHours} jam x ${formatRupiah(dendaHarian)}).`;
      }

      return {
        terlambat: true,
        menitTelat: lateMinutes,
        nominalDenda: nominal,
        dendaFormat: formatRupiah(nominal),
        keterangan: ket,
      };
    }

    // ShortRent 6 Jam -> Step Up ke 9 Jam
    if (booking.pilihanDurasi === '6_jam') {
      const selisihStepUp = p9 - p6;
      const extraMinutes = lateMinutes - 60;
      let nominal = selisihStepUp;
      let ket = `ShortRent 6 Jam telat >= 60 mnt: Otomatis Step-Up ke paket 9 Jam (+${formatRupiah(selisihStepUp)}).`;

      if (extraMinutes > 0) {
        const extraHours = Math.ceil(extraMinutes / 60);
        const dendaTambahan = extraHours * dendaHarian;
        nominal += dendaTambahan;
        ket += ` Ditambah ekstra ${extraHours} jam x ${formatRupiah(dendaHarian)}.`;
      }

      return {
        terlambat: true,
        menitTelat: lateMinutes,
        nominalDenda: nominal,
        dendaFormat: formatRupiah(nominal),
        keterangan: ket,
      };
    }

    // ShortRent 3 Jam -> Step Up ke 6 Jam
    if (booking.pilihanDurasi === '3_jam') {
      const selisihStepUp = p6 - p3;
      const extraMinutes = lateMinutes - 60;
      let nominal = selisihStepUp;
      let ket = `ShortRent 3 Jam telat >= 60 mnt: Otomatis Step-Up ke paket 6 Jam (+${formatRupiah(selisihStepUp)}).`;

      if (extraMinutes > 0) {
        const extraHours = Math.ceil(extraMinutes / 60);
        const dendaTambahan = extraHours * dendaHarian;
        nominal += dendaTambahan;
        ket += ` Ditambah ekstra ${extraHours} jam x ${formatRupiah(dendaHarian)}.`;
      }

      return {
        terlambat: true,
        menitTelat: lateMinutes,
        nominalDenda: nominal,
        dendaFormat: formatRupiah(nominal),
        keterangan: ket,
      };
    }
  }

  // KASUS B: Sewa Harian, Mingguan, Bulanan, Paket Promo
  if (lateMinutes <= 60) {
    return {
      terlambat: false,
      menitTelat: lateMinutes,
      nominalDenda: 0,
      dendaFormat: 'Rp 0 (Toleransi <= 60 mnt)',
      keterangan: `Terlambat ${lateMinutes} menit (masih dalam toleransi garasi 60 menit).`,
    };
  }

  const lateHours = Math.ceil(lateMinutes / 60);
  const nominal = lateHours * dendaHarian;

  return {
    terlambat: true,
    menitTelat: lateMinutes,
    nominalDenda: nominal,
    dendaFormat: formatRupiah(nominal),
    keterangan: `Sewa Harian/Bulanan telat ${lateMinutes} mnt (${lateHours} jam) x ${formatRupiah(dendaHarian)}/jam.`,
  };
}

/**
 * Cek Ketersediaan 1 Unit Fisik Tertentu pada Rentang Waktu (Buffer 60 Menit)
 */
export function isUnitAvailableForRange(
  unitId: number,
  reqStartEpoch: number,
  reqEndEpoch: number,
  db: RyokoDatabase,
  excludeBookingId?: number
): boolean {
  if (!unitId || reqEndEpoch <= reqStartEpoch) return false;

  const unit = db.units.find(u => u.id === unitId);
  if (!unit || unit.statusServis === 'servis') return false;

  // Cek tracking status
  const track = db.tracking.find(t => t.unitId === unitId);
  if (track && (track.statusPosisi === 'servis' || track.statusPosisi === 'kurir')) {
    return false;
  }

  const nowEpoch = Math.floor(Date.now() / 1000);

  // Periksa semua transaksi aktif yang mengunci unit ini
  const activeBookings = db.bookings.filter(
    b =>
      b.unitId === unitId &&
      (b.status === 'ryokou_approved' || b.status === 'ryokou_disewa' || b.status === 'ryokou_diservis') &&
      (!excludeBookingId || b.id !== excludeBookingId)
  );

  for (const b of activeBookings) {
    const bStart = b.startEpoch || parseWibToEpoch(b.jamTanggalMulai);
    const bEnd = b.endEpoch || parseWibToEpoch(b.jamTanggalSelesai);
    const effectiveEnd = b.status === 'ryokou_disewa' ? Math.max(bEnd, nowEpoch) : bEnd;

    const bufferedStart = bStart - TURNAROUND_BUFFER_SECONDS;
    const bufferedEnd = effectiveEnd + TURNAROUND_BUFFER_SECONDS;

    if (reqStartEpoch < bufferedEnd && reqEndEpoch > bufferedStart) {
      return false;
    }
  }

  return true;
}

/**
 * Ambil Daftar Seluruh Unit Fisik yang Tersedia Bebas Bentrok untuk Model Motor Tertentu (Buffer 60 Mnt)
 */
export function getAvailableUnitsForModel(
  motorId: number,
  startEpoch: number,
  endEpoch: number,
  db: RyokoDatabase,
  excludeBookingId?: number
): Array<{ unit: PhysicalUnit; label: string; pool: string }> {
  const modelUnits = db.units.filter(u => u.motorId === motorId && u.statusServis === 'aktif');

  const available: Array<{ unit: PhysicalUnit; label: string; pool: string }> = [];

  for (const u of modelUnits) {
    if (isUnitAvailableForRange(u.id, startEpoch, endEpoch, db, excludeBookingId)) {
      const track = db.tracking.find(t => t.unitId === u.id);
      const poolLabel = track?.poolParkir === 'batu' ? 'Pool Batu (Diponegoro)' : 'Pool Malang (Dinoyo)';
      available.push({
        unit: u,
        label: `${u.kodeUnit} (${u.nomorPlat}) — Parkir di ${poolLabel}`,
        pool: track?.poolParkir || u.poolLokasi,
      });
    }
  }

  return available;
}

/**
 * Indikator Stok Biner Tegas Publik (D-05)
 */
export function getPublicStockIndicator(
  motorId: number,
  db: RyokoDatabase
): { status: 'tersedia' | 'habis'; label: string } {
  const nowEpoch = Math.floor(Date.now() / 1000);
  const oneHourLater = nowEpoch + 3600;

  const avail = getAvailableUnitsForModel(motorId, nowEpoch, oneHourLater, db);
  if (avail.length > 0) {
    return { status: 'tersedia', label: 'Tersedia' };
  }
  return { status: 'habis', label: 'Habis (Konfirmasi WA)' };
}

/**
 * Mesin Transisi Status Guarded (TASK-019 & F-01)
 */
export const NEXT_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  ryokou_booking: ['ryokou_approved'],
  ryokou_approved: ['ryokou_disewa', 'ryokou_booking'],
  ryokou_disewa: ['ryokou_selesai', 'ryokou_diservis'],
  ryokou_diservis: ['ryokou_disewa', 'ryokou_selesai'],
  ryokou_selesai: [],
};

export function checkTransition(
  booking: BookingRecord,
  targetStatus: BookingStatus,
  db: RyokoDatabase,
  targetUnitId?: number
): string | null {
  const allowed = NEXT_STATUS_TRANSITIONS[booking.status] || [];
  if (!allowed.includes(targetStatus)) {
    return `Transisi status tidak diizinkan: dari '${booking.status}' ke '${targetStatus}'.`;
  }

  const unitId = targetUnitId || booking.unitId;

  if (targetStatus === 'ryokou_approved') {
    if (!unitId) return 'Unit fisik garasi harus dipilih saat menyetujui pemesanan.';
    const unit = db.units.find(u => u.id === unitId);
    if (!unit) return 'Unit fisik tidak ditemukan.';
    if (unit.statusServis === 'servis') return `Unit ${unit.kodeUnit} sedang berstatus servis di bengkel.`;

    const startEp = booking.startEpoch || parseWibToEpoch(booking.jamTanggalMulai);
    const endEp = booking.endEpoch || parseWibToEpoch(booking.jamTanggalSelesai);
    const available = isUnitAvailableForRange(unitId, startEp, endEp, db, booking.id);
    if (!available) {
      return `Bentrok Jadwal: Unit ${unit.kodeUnit} tidak tersedia pada rentang waktu ini (buffer 60 menit terlanggar atau sedang tersewa).`;
    }
  }

  if (targetStatus === 'ryokou_disewa') {
    if (!unitId) return 'Tidak ada unit fisik yang dialokasikan untuk sewa ini.';
    const heldByOther = db.bookings.some(
      b => b.id !== booking.id && b.unitId === unitId && b.status === 'ryokou_disewa'
    );
    if (heldByOther) {
      return `Gagal Mulai Sewa: Unit #${unitId} saat ini sedang aktif disewa pelanggan lain.`;
    }
  }

  return null;
}

/**
 * Kalkulasi Tarif Dinamis Multi-Hari & Durasi Fleksibel (TASK-019 & F-03)
 */
export function calculateDynamicRentalTariff(
  motor: MotorModel,
  kategoriTarif: TariffCategory,
  pilihanDurasi: DurationOption,
  startEpoch: number,
  endEpoch: number,
  selectedPackage?: RentalPackage
): { totalHarga: number; labelDurasi: string } {
  if (kategoriTarif === 'paket' && selectedPackage) {
    return {
      totalHarga: selectedPackage.hargaPaket,
      labelDurasi: selectedPackage.namaPaket,
    };
  }

  if (kategoriTarif === 'jam') {
    if (pilihanDurasi === '3_jam') return { totalHarga: motor.harga3Jam, labelDurasi: '3 Jam' };
    if (pilihanDurasi === '6_jam') return { totalHarga: motor.harga6Jam, labelDurasi: '6 Jam' };
    if (pilihanDurasi === '9_jam') return { totalHarga: motor.harga9Jam, labelDurasi: '9 Jam' };
    return { totalHarga: motor.harga12Jam, labelDurasi: '12 Jam' };
  }

  if (pilihanDurasi === '1_bulan') {
    return {
      totalHarga: motor.harga1Bulan || motor.harga1Hari * 22,
      labelDurasi: '1 Bulan (30 Hari Penuh)',
    };
  }

  if (pilihanDurasi === '1_minggu') {
    return {
      totalHarga: motor.harga1Minggu || motor.harga1Hari * 6,
      labelDurasi: '1 Minggu (7 Hari)',
    };
  }

  // Multi-day dynamic calculation
  if (startEpoch && endEpoch && endEpoch > startEpoch) {
    const diffSeconds = endEpoch - startEpoch;
    const diffHours = diffSeconds / 3600;
    const days = Math.ceil(diffHours / 24);
    if (days > 1 && days < 7) {
      return {
        totalHarga: days * motor.harga1Hari,
        labelDurasi: `${days} Hari (${days * 24} Jam)`,
      };
    }
  }

  return {
    totalHarga: motor.harga1Hari,
    labelDurasi: '1 Hari (24 Jam)',
  };
}
