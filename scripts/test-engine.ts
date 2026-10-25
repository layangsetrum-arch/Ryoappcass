/**
 * Automated Regression & End-to-End Test Suite for RyokoRent Business Logic
 * Covers 10 Critical Subsystems:
 * 1. WIB Timezone conversion (epochToWibInput & parseWibToEpoch)
 * 2. WhatsApp 13-Field Chat Parser with format tolerance & warnings
 * 3. Dynamic Rental Tariff & Multi-day prorata calculations
 * 4. Turnaround Buffer (60 minutes) & Double-booking prevention
 * 5. Guarded State Machine transitions (5 statuses including diservis)
 * 6. Return fine calculations (60 min tolerance & step-up tiers)
 * 7. NIK 16-digit regex redaction & privacy protection
 * 8. Sequential ID and booking number generation
 * 9. Google Sheets CSV generation & formula injection mitigation
 * 10. Telegram Bot alert formatting
 */

import {
  parseWibToEpoch,
  epochToWibInput,
  calculateDynamicRentalTariff,
  isUnitAvailableForRange,
  checkTransition,
  calculateOvertimePenalty,
  sanitizeTextNoNik,
  containsNikPattern,
  nextId,
  generateBookingNumber,
} from '../src/services/bookingEngine';
import { parseWhatsAppBookingChat } from '../src/utils/whatsappChatParser';
import { generateBookingsCSV } from '../src/services/googleSheetsService';
import { formatTelegramReturnAlertMessage } from '../src/services/telegramBotService';
import { MotorModel, RyokoDatabase, BookingRecord } from '../src/types/ryoko';

let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedTests++;
    console.log(`  \x1b[32m✔\x1b[0m ${testName}`);
  } else {
    failedTests++;
    console.error(`  \x1b[31m✖\x1b[0m ${testName}`);
    if (detail) console.error(`    -> \x1b[33m${detail}\x1b[0m`);
  }
}

// Sample Test Data
const sampleMotor: MotorModel = {
  id: 1,
  namaModel: 'Honda Scoopy Prestige',
  kategori: 'standar',
  harga3Jam: 35000,
  harga6Jam: 50000,
  harga9Jam: 65000,
  harga12Jam: 75000,
  harga1Hari: 85000,
  harga1Minggu: 500000,
  harga1Bulan: 1600000,
  dendaPerJam: 15000,
  aktif: true,
};

const sampleDb: RyokoDatabase = {
  settings: {
    namaRental: 'Ryoko Rent Malang',
    adminWa: '6281234567890',
    poolMalang: 'Pool Dinoyo Malang',
    poolBatu: 'Pool Diponegoro Batu',
    namaOperator: 'Admin Ryoko',
    autoBackupEnabled: true,
  },
  motors: [sampleMotor],
  units: [
    { id: 101, motorId: 1, kodeUnit: 'SCP-01', nomorPlat: 'N 1234 AB', statusServis: 'aman', odometerKm: 12000, tahun: 2023, warna: 'Putih' },
    { id: 102, motorId: 1, kodeUnit: 'SCP-02', nomorPlat: 'N 5678 CD', statusServis: 'aman', odometerKm: 15000, tahun: 2023, warna: 'Hitam' },
  ],
  bookings: [],
  tracking: [
    { id: 1, unitId: 101, statusPosisi: 'parkir', lokasiPool: 'malang_dinoyo', updateTerakhir: '2026-10-25 10:00 WIB' },
    { id: 2, unitId: 102, statusPosisi: 'parkir', lokasiPool: 'batu_sisir', updateTerakhir: '2026-10-25 10:00 WIB' },
  ],
  serviceRecords: [],
  auditLogs: [],
  users: [],
  dailyOperationalLogs: [],
};

async function runTestSuite() {
  console.log('\n\x1b[1m\x1b[36m=== RYOKORENT AUTOMATED BUSINESS LOGIC TEST SUITE ===\x1b[0m\n');

  // SUITE 1: WIB Time Integrity
  console.log('\x1b[1m[Suite 1: WIB Time Integrity & Offset]\x1b[0m');
  const testWibString = '2026-10-25T14:30';
  const epoch = parseWibToEpoch(testWibString);
  const backToWib = epochToWibInput(epoch);
  assert(epoch > 0, 'parseWibToEpoch produces valid positive timestamp');
  assert(backToWib === testWibString, `epochToWibInput accurately roundtrips WIB (${backToWib} === ${testWibString})`);

  // SUITE 2: WhatsApp Chat 13-Field Parser
  console.log('\n\x1b[1m[Suite 2: WhatsApp Chat 13-Field Parser & Warnings]\x1b[0m');
  const chatText = `*FORM PEMESANAN SEWA MOTOR RYOKO RENT*
1. Nama : Ahmad Fauzi
2. Alamat sesuai KTP : Jl. Soekarno Hatta No. 10 Malang
3. Id pendukung : Paspor
4. Alamat saat ini : Hotel Aria Gajayana Malang
5. Id sosmed : @ahmad_fauzi
6. No telp : 081298765432
7. No telp darurat : 085712345678
8. Jadwal mulai : 28 Oktober 14.30
9. Jadwal selesai : 30 Oktober 14.30
10. Lokasi pengantaran : Stasiun Kotabaru Malang
11. Lokasi penjemputan : Hotel Aria Gajayana Malang
12. Model unit : Honda Scoopy
13. Jumlah helm : 2 Helm`;

  const parsed = parseWhatsAppBookingChat(chatText);
  assert(parsed.nama === 'Ahmad Fauzi', 'Extracted name matches');
  assert(parsed.idPendukung === 'Paspor', 'Extracted support ID recognized as Paspor');
  assert(parsed.nomorWa === '081298765432' || parsed.nomorWa === '6281298765432', 'Extracted phone normalized');
  assert(parsed.jumlahHelm === 2, 'Extracted 2 helmets correctly');
  assert(parsed.warnings?.length === 0, 'Complete chat yields 0 warnings');

  // Empty chat warning check
  const emptyParsed = parseWhatsAppBookingChat('Halo saya mau sewa motor');
  assert((emptyParsed.warnings?.length || 0) > 0, 'Incomplete chat accurately accumulates warnings');

  // SUITE 3: Dynamic Rental Tariff & Multi-Day
  console.log('\n\x1b[1m[Suite 3: Dynamic Rental Tariff & Multi-Day Prorata]\x1b[0m');
  const startEp = parseWibToEpoch('2026-10-25T10:00');
  const end4Days = startEp + 4 * 24 * 3600;
  const tariff4Days = calculateDynamicRentalTariff(sampleMotor, 'standar', '1_hari', startEp, end4Days);
  assert(tariff4Days.totalHarga === 4 * 85000, `4-day rent calculates 4x daily rate (Rp ${tariff4Days.totalHarga})`);
  assert(tariff4Days.labelDurasi.includes('4 Hari'), `Duration label correctly reflects 4 Days`);

  const tariff1Month = calculateDynamicRentalTariff(sampleMotor, 'standar', '1_bulan', startEp, startEp + 30 * 24 * 3600);
  assert(tariff1Month.totalHarga === 1600000, `1-month rent reflects package rate (Rp 1.600.000)`);

  // SUITE 4: Turnaround Buffer 60-Minute Collision
  console.log('\n\x1b[1m[Suite 4: Turnaround Buffer (60 Mnt) & Schedule Collision]\x1b[0m');
  const dbWithBooking: RyokoDatabase = {
    ...sampleDb,
    bookings: [
      {
        id: 2001,
        noBooking: 'RYK-20261025-001',
        status: 'ryokou_approved',
        nama: 'Penyewa 1',
        nomorWa: '628123456789',
        alamatKtp: 'Malang',
        jenisIdPendukung: 'SIM_C',
        alamatSaatIni: 'Malang',
        idSosmed: '-',
        noTelpDarurat: '-',
        jumlahHelm: 1,
        tandaPelanggan: 'baru',
        motorId: 1,
        unitId: 101,
        pilihanDurasi: '1_hari',
        kategoriTarif: 'standar',
        jamTanggalMulai: '2026-10-25T10:00',
        jamTanggalSelesai: '2026-10-26T10:00',
        startEpoch: startEp,
        endEpoch: startEp + 24 * 3600,
        alamatPengantaran: 'Pool Malang',
        alamatPenjemputan: 'Pool Malang',
        totalHargaEstimasi: 85000,
        snapshotNamaMotor: 'Honda Scoopy',
        snapshotKodeUnit: 'SCP-01',
        waktuDibuat: '2026-10-25 09:00 WIB',
        dendaNominal: 0,
        catatanRapi: '-',
        riwayatAksi: [],
      },
    ],
  };

  // Same time request -> should be false
  const availSame = isUnitAvailableForRange(101, startEp, startEp + 24 * 3600, dbWithBooking);
  assert(!availSame, 'Unit unavailable during active booking period');

  // Request within 60 minutes after booking (e.g. 30 mins after return) -> should be false due to buffer
  const thirtyMinsAfter = startEp + 24 * 3600 + 1800;
  const availBuffer = isUnitAvailableForRange(101, thirtyMinsAfter, thirtyMinsAfter + 3600, dbWithBooking);
  assert(!availBuffer, 'Unit unavailable within 60-min turnaround buffer window');

  // Request 70 minutes after booking -> should be true
  const seventyMinsAfter = startEp + 24 * 3600 + 4200;
  const availFree = isUnitAvailableForRange(101, seventyMinsAfter, seventyMinsAfter + 3600, dbWithBooking);
  assert(availFree, 'Unit is available when outside 60-min turnaround buffer window');

  // SUITE 5: Guarded State Machine Transitions
  console.log('\n\x1b[1m[Suite 5: Guarded State Machine Transitions]\x1b[0m');
  const baseBooking: BookingRecord = {
    ...dbWithBooking.bookings[0],
    id: 9999,
    status: 'ryokou_booking',
    unitId: 102, // unit 102 is free
  };

  const err1 = checkTransition(baseBooking, 'ryokou_approved', dbWithBooking, 102);
  assert(err1 === null, 'ryokou_booking -> ryokou_approved is valid (err === null)');

  const approvedBooking: BookingRecord = { ...baseBooking, status: 'ryokou_approved' };
  const err2 = checkTransition(approvedBooking, 'ryokou_disewa', dbWithBooking, 102);
  assert(err2 === null, 'ryokou_approved -> ryokou_disewa is valid (err === null)');

  const disewaBooking: BookingRecord = { ...baseBooking, status: 'ryokou_disewa' };
  const err3 = checkTransition(disewaBooking, 'ryokou_selesai', dbWithBooking, 102);
  assert(err3 === null, 'ryokou_disewa -> ryokou_selesai is valid (err === null)');

  const selesaiBooking: BookingRecord = { ...baseBooking, status: 'ryokou_selesai' };
  const errInvalid = checkTransition(selesaiBooking, 'ryokou_booking', dbWithBooking, 102);
  assert(errInvalid !== null, 'ryokou_selesai -> ryokou_booking is blocked by guard (err !== null)');

  // SUITE 6: Late Return Fine Calculation
  console.log('\n\x1b[1m[Suite 6: Late Return Fine & 60-Minute Tolerance]\x1b[0m');
  const bookingToReturn = dbWithBooking.bookings[0];
  const returnOnTimeEpoch = bookingToReturn.endEpoch;
  const fineOnTime = calculateOvertimePenalty(bookingToReturn, sampleMotor, returnOnTimeEpoch);
  assert(fineOnTime.nominalDenda === 0 && !fineOnTime.terlambat, 'On-time return has Rp 0 fine');

  const return45MinsLate = bookingToReturn.endEpoch + 45 * 60;
  const fine45Mins = calculateOvertimePenalty(bookingToReturn, sampleMotor, return45MinsLate);
  assert(fine45Mins.nominalDenda === 0, 'Return within 60 mins tolerance incurs Rp 0 fine');

  const return90MinsLate = bookingToReturn.endEpoch + 90 * 60;
  const fine90Mins = calculateOvertimePenalty(bookingToReturn, sampleMotor, return90MinsLate);
  const expectedDendaRate = sampleMotor.dendaHarianPerJam || 20000;
  assert(fine90Mins.nominalDenda === 2 * expectedDendaRate, `Return 90 mins late incurs 2 hours x Rp ${expectedDendaRate} = Rp ${fine90Mins.nominalDenda}`);

  // SUITE 7: NIK 16-Digit Regex Redaction & Privacy
  console.log('\n\x1b[1m[Suite 7: NIK 16-Digit Regex Masking & Privacy]\x1b[0m');
  const textWithNik = 'KTP: 3573012345678901 atas nama Ridho';
  const masked = sanitizeTextNoNik(textWithNik);
  assert(masked.includes('3573********8901'), '16-digit NIK successfully masked to 3573********8901');
  assert(!masked.includes('3573012345678901'), 'Original 16-digit NIK not present in sanitized string');
  assert(containsNikPattern('3573012345678901'), 'containsNikPattern correctly detects 16-digit pattern');

  // SUITE 8: Sequential ID & Booking Number Generation
  console.log('\n\x1b[1m[Suite 8: ID Collision Prevention & Booking Sequences]\x1b[0m');
  const nextIdVal = nextId([{ id: 10 }, { id: 25 }, { id: 7 }]);
  assert(nextIdVal === 26, `nextId returns max + 1 (${nextIdVal} === 26)`);

  const bkNumber = generateBookingNumber(dbWithBooking);
  assert(/^RYK-\d{8}-\d{3}$/.test(bkNumber), `Booking number matches format RYK-YYYYMMDD-XXX (${bkNumber})`);

  // SUITE 9: Google Sheets CSV Formula Injection Neutralization
  console.log('\n\x1b[1m[Suite 9: Google Sheets CSV Export & Formula Protection]\x1b[0m');
  const bookingWithFormula: BookingRecord = {
    ...dbWithBooking.bookings[0],
    nama: '=SUM(A1:A10)',
    catatanKhusus: '+cmd|"/C calc"!A0',
  };
  const csvOutput = generateBookingsCSV([bookingWithFormula]);
  assert(csvOutput.includes('No Booking'), 'CSV header properly included');
  assert(csvOutput.includes('"=SUM(A1:A10)"'), 'Formula injection candidate properly wrapped in quotes');

  // SUITE 10: Telegram Return Alert Formatting
  console.log('\n\x1b[1m[Suite 10: Telegram Alert HTML Message Formatting]\x1b[0m');
  const tgMsg = formatTelegramReturnAlertMessage(bookingToReturn, sampleMotor, 'h_1_jam', 0);
  assert(tgMsg.includes('PERINGATAN KRITIS H-1 JAM'), 'Urgency header formatted properly');
  assert(tgMsg.includes(bookingToReturn.noBooking), 'Booking number present in alert');
  assert(tgMsg.includes('Honda Scoopy'), 'Motor model included in alert');

  // Summary
  console.log('\n\x1b[1m=== TEST RESULTS SUMMARY ===\x1b[0m');
  console.log(`Total Passed: \x1b[32m${passedTests}\x1b[0m`);
  console.log(`Total Failed: \x1b[31m${failedTests}\x1b[0m`);

  if (failedTests > 0) {
    console.error(`\x1b[31mTest suite failed with ${failedTests} assertion errors.\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32mAll 10 test suites PASSED with 0 errors!\x1b[0m\n`);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal error during test run:', err);
  process.exit(1);
});
