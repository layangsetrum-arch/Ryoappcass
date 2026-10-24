# BACKLOG TASK PENGEMBANGAN: RyokoRent Android APK

Definisi task. **Status task tidak ditulis di sini**; status ada di `SESSION_STATE.md`. Enum: `PENDING | READY | IN_PROGRESS | BLOCKED | DONE`.

---

## 1. PETA FASE

* **FASE 0: Pondasi & Spesifikasi ZLCE** (`TASK-001`)
* **FASE 1: Arsitektur Model Data & Servis** (`TASK-002`)
* **FASE 2: Panel Catatan Servis Rutin & Penugasan Kurir** (`TASK-003`)
* **FASE 3: Form Pemesanan Baru, Laporan Omset & WhatsApp Ekstra** (`TASK-004`)
* **FASE 4: Integrasi Wizard Recovery ZLCE Studio & Verifikasi Akhir** (`TASK-005`)
* **FASE 5: Panel Manajemen User & Role-Based Access Control 4 Tingkat** (`TASK-006`)
* **FASE 6: Kwitansi Paperless, Countdown Real-Time & Armada Dinamis** (`TASK-007`, `TASK-008`, `TASK-009`)
* **FASE 7: Review Claude, README Resmi, & Integrasi Kolaborasi Eksternal** (`TASK-010`, `TASK-011`, `TASK-012`, `TASK-013`, `TASK-014`)

---

## 2. FORMAT TASK

### TASK-001: Inisialisasi Repositori & Dokumen Kontrol ZLCE
* **Fase:** FASE 0
* **Deskripsi:** Setup lingkungan, integrasi VitePWA, manifest Android, dan berkas kontrol ZLCE (`BLUEPRINT.md`, `TASKS.md`, `SESSION_STATE.md`, `HANDOVER.md`).
* **Dependensi:** -
* **File:** `BLUEPRINT.md`, `TASKS.md`, `SESSION_STATE.md`, `HANDOVER.md`, `vite.config.ts`
* **Docs Terkait (Tier 1):** `BLUEPRINT.md`
* **Docs Impact:** `BLUEPRINT.md`, `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Berkas kontrol ZLCE terisi lengkap dan lolos verifikasi `zlce-check.py`.
  2. Kompilasi TypeScript `npm run lint` berjalan 0 error.
* **Test Case:** Build & Lint verification
* **Metode Verifikasi:** Jalankan `npm run lint` dan `python3 scripts/zlce/zlce-check.py .`; tempel output.

---

### TASK-002: Penyesuaian Skema & Model Data (Tarif 1 Bulan, Kurir, 7 Kategori Servis, Buffer 60 Mnt)
* **Fase:** FASE 1
* **Deskripsi:** Memperbarui antarmuka TypeScript `src/types/ryoko.ts` dan logika perhitungan di `src/services/bookingEngine.ts` untuk mendukung tarif 1 Bulan (menggantikan 2 Minggu), status posisi unit `kurir` beserta nama kurir, status booking `ryokou_diservis`, jeda turnaround buffer 60 menit, dan entitas `ServiceRecord` (7 kategori).
* **Dependensi:** `TASK-001`
* **File:** `src/types/ryoko.ts`, `src/services/bookingEngine.ts`, `src/data/seedData.ts`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `BLUEPRINT.md`, `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. `harga1Bulan` dan durasi `1_bulan` terdefinisi dan terkalkulasi akurat.
  2. `ServiceRecord` mencakup 7 kategori servis spesifik.
  3. Turnaround buffer dikalibrasi menjadi 60 menit (3600 detik).
  4. Unit tracking mendukung status `kurir` dengan field `namaKurir`.
* **Test Case:** Monthly tariff & 60-min buffer test
* **Metode Verifikasi:** Jalankan `npm run lint` dan verifikasi kalkulasi tarif.

---

### TASK-003: Implementasi Panel Catatan Servis Rutin 7 Kategori & Posisi Kurir di UI
* **Fase:** FASE 2
* **Deskripsi:** Membuat komponen `src/components/ServiceLogsView.tsx` untuk input dan riwayat servis rutin 7 kategori armada garasi, serta menambahkan opsi status posisi "Dipakai Kurir" (dengan nama kurir) pada tab Lacak Unit dan modal update tracking.
* **Dependensi:** `TASK-002`
* **File:** `src/components/ServiceLogsView.tsx`, `src/components/TrackingView.tsx`, `src/components/ActionModals.tsx`, `src/components/AndroidBottomNav.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Pengguna dapat mencatat dan melihat riwayat servis armada dengan 7 kategori spesifik (Ganti Oli Mesin, Oli Gardan, Kampas Rem, Ban, CVT Part, Aki, Kecelakaan).
  2. Unit armada dapat dipindahkan ke status "Dipakai Kurir" dengan mengisi nama kurir.
* **Test Case:** Service logs create & filter test
* **Metode Verifikasi:** Uji input catatan servis dan perpindahan status unit.

---

### TASK-004: Form Pemesanan Baru, Laporan Omset & Fitur WhatsApp Lanjutan
* **Fase:** FASE 3
* **Deskripsi:** Memperbarui `NewBookingModal.tsx` dengan pilihan durasi 1 Bulan, opsi kurir pengantar, dan penyederhanaan tanpa sensor NIK. Menambahkan fitur filter rekapitulasi omset per rentang tanggal di Dashboard/Laporan, serta menambahkan generator WhatsApp untuk tagihan bulanan, surat tugas kurir, dan pengingat jatuh tempo H-2 jam.
* **Dependensi:** `TASK-003`
* **File:** `src/components/NewBookingModal.tsx`, `src/services/whatsappService.ts`, `src/components/DashboardView.tsx`, `src/components/BookingsView.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Form order mendukung sewa 1 bulan (+30 hari otomatis) dan opsi penugasan kurir.
  2. Filter tanggal omset di Dashboard menghitung total pendapatan sesuai rentang waktu yang dipilih.
  3. Fitur WhatsApp mencakup notifikasi kurir, tagihan sewa bulanan, dan pengingat jatuh tempo H-2 jam.
* **Test Case:** Order creation & WhatsApp link generation
* **Metode Verifikasi:** Uji input pemesanan sewa 1 bulan dan verifikasi format pesan WA.

---

### TASK-005: Integrasi Wizard Recovery ZLCE Studio & Verifikasi Akhir
* **Fase:** FASE 4
* **Deskripsi:** Mengintegrasikan tab Recovery ZLCE Studio ke dalam antarmuka aplikasi RyokoRent APK, memungkinkan operator/pengembang membuat dan menyalin snapshot pemulihan langsung dari UI, serta memastikan build produksi PWA siap pakai.
* **Dependensi:** `TASK-004`
* **File:** `src/App.tsx`, `src/components/RecoveryTab.tsx`, `scripts/zlce/zlce-snapshot.sh`
* **Docs Terkait:** `BLUEPRINT.md`, `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Tombol/tab ZLCE Recovery dapat diakses di aplikasi untuk membuat snapshot seketika.
  2. Skrip `scripts/zlce/zlce-check.py` lolos dengan status OK (0 error, 0 warn).
  3. Build produksi `npm run build` sukses 100%.
* **Test Case:** Full app verification & ZLCE check
* **Metode Verifikasi:** Jalankan `python3 scripts/zlce/zlce-check.py .` dan `npm run build`.

---

### TASK-006: Panel Manajemen User & Role-Based Access Control (4 Tingkat)
* **Fase:** FASE 5
* **Deskripsi:** Mengimplementasikan Panel Manajemen Pengguna dengan 4 tingkatan hak akses: (1) Administrator (all access), (2) Admin Custom Access (izin granular yang dapat dikustomisasi per-user), (3) Operator (akses terbatas: operasional booking, lacak unit, servis, tanpa akses ekspor omset/reset sistem/manajemen user), dan (4) Kurir (akses sangat terbatas: hanya tugas serah terima, penjemputan unit, chat WhatsApp tamu, dan status kurir motor, tanpa finansial/pengaturan). Dilengkapi dengan Pengalih Akun Cepat (Quick Switcher) di Top Bar dan Panel Pengaturan User.
* **Dependensi:** `TASK-005`
* **File:** `src/types/ryoko.ts`, `src/data/seedData.ts`, `src/services/storageService.ts`, `src/components/UserManagementView.tsx`, `src/components/CourierDashboardView.tsx`, `src/components/AndroidTopBar.tsx`, `src/components/AndroidBottomNav.tsx`, `src/App.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Tersedia 4 tingkatan peran: Administrator, Admin Custom, Operator, dan Kurir.
  2. Admin Custom dapat diatur izin granularnya (lihat omset, kelola booking, lacak unit, servis, armada, pengaturan, kelola user, recovery).
  3. Operator dibatasi dari akses omset finansial agregat, reset sistem, dan manajemen user.
  4. Kurir memiliki tampilan ringkas khusus pengantaran & penjemputan unit dengan aksi satu-klik dan kontak WhatsApp penyewa.
  5. Pengguna dapat berganti akun secara langsung melalui Switcher Profil di Top Bar atau tab Pengguna.
* **Test Case:** Role switching, permission enforcement & courier workflow
* **Metode Verifikasi:** Jalankan `python3 scripts/zlce/zlce-check.py . --no-git` dan `npm run lint`.

---

### TASK-007: Modul Kwitansi Digital Paperless & Salin Teks Ringkasan Nota Kasir Cepat
* **Fase:** FASE 6
* **Deskripsi:** Mengimplementasikan modal Kwitansi Digital / Invoice resmi Ryoko Rent Malang & Batu tanpa cetak kertas (paperless). Mendukung preview nota kasir digital yang rapi, tombol Simpan / Unduh PDF, tombol Salin Teks Ringkasan Nota Kasir untuk chat cepat WhatsApp, rincian Berita Acara Serah Terima (BAST: kelengkapan 2 helm, 2 jas hujan, bensin, deposit), serta kirim WhatsApp 1-klik. Tersedia di setiap card booking dan dashboard kurir.
* **Dependensi:** `TASK-006`
* **File:** `src/components/DigitalReceiptModal.tsx`, `src/components/BookingsView.tsx`, `src/components/CourierDashboardView.tsx`, `src/App.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Terdapat tombol "Kwitansi / Invoice" pada setiap card booking dan view kurir.
  2. Modal kwitansi menampilkan identitas rental, detail penyewa, rincian biaya (tarif + denda jika ada), unit motor, nomor plat, dan kelengkapan unit.
  3. Pengguna dapat mengunduh / menyimpan nota dalam format PDF tanpa perlu cetak kertas.
  4. Pengguna dapat menyalin teks ringkasan nota kasir untuk chat cepat hanya dengan 1-klik.
  5. Tersedia tombol kirim kwitansi langsung ke WhatsApp penyewa.
* **Test Case:** Digital receipt modal, PDF export trigger, quick copy text
* **Metode Verifikasi:** Jalankan `npm run lint` dan verifikasi fungsi salin nota kasir & render modal.

---

### TASK-008: Sistem Countdown Pengembalian Real-Time & Alert Jatuh Tempo di Dashboard/Kurir
* **Fase:** FASE 6
* **Deskripsi:** Mengimplementasikan banner hitung mundur (countdown) waktu sewa real-time pada beranda dan dashboard kurir, mengklasifikasikan unit dalam status Aman, H-2 Jam, H-1 Jam, dan Overdue, disertai kalkulasi denda otomatis per menit/jam dan generator pesan pengingat jatuh tempo WhatsApp.
* **Dependensi:** `TASK-007`
* **File:** `src/components/DashboardView.tsx`, `src/components/CourierDashboardView.tsx`, `src/services/whatsappService.ts`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Banner status countdown tampil interaktif dengan indikator warna (hijau, kuning H-2 jam, merah overdue).
  2. Tombol kirim pengingat pengembalian ke WhatsApp penyewa tersedia langsung dari banner.
* **Test Case:** Countdown timer & alert calculations
* **Metode Verifikasi:** Jalankan `npm run lint`.

---

### TASK-009: Master Model Motor Dinamis & Manajemen Tarif Khusus di FleetView
* **Fase:** FASE 6
* **Deskripsi:** Menambahkan fitur CRUD master model motor baru (tambah model, ubah nama, cc, transmisi, tarif spesifik per durasi termasuk tarif 1 bulan) di `FleetView.tsx` agar katalog armada garasi dapat diperluas secara fleksibel tanpa edit kode sumber.
* **Dependensi:** `TASK-008`
* **File:** `src/components/FleetView.tsx`, `src/services/storageService.ts`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Operator/Admin dapat menambah model motor baru dengan tarif lengkap (ShortRent, Harian, 1 Bulan).
  2. Data tersimpan persisten di LocalStorage dan langsung muncul di opsi booking baru.
* **Test Case:** Create/Edit motor model
* **Metode Verifikasi:** Jalankan `python3 scripts/zlce/zlce-check.py .` dan `npm run lint`.

---

### TASK-010: Panduan Review Kode Claude & Prompt Instruksi Unggah Berkas
* **Fase:** FASE 7
* **Deskripsi:** Menyusun dokumen panduan pengunggahan berkas (`docs/CLAUDE_REVIEW_GUIDE.md`) dan berkas prompt siap salin (`docs/CLAUDE_PROMPT.md`) untuk melakukan audit kode mendalam oleh model Anthropic Claude (Sonnet 3.5 / 3.7 / Opus) yang mencakup kepatuhan 13 field form booking, state machine 5 status, jeda 60 menit buffer, proteksi NIK, dan kesiapan PWA Android.
* **Dependensi:** `TASK-009`
* **File:** `docs/CLAUDE_REVIEW_GUIDE.md`, `docs/CLAUDE_PROMPT.md`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Panduan memuat daftar tier berkas yang wajib diunggah beserta estimasi token.
  2. Prompt Claude mencakup 6 fokus tinjauan kode dan format output terstruktur.
* **Test Case:** Review prompt readiness
* **Metode Verifikasi:** Verifikasi kelengkapan berkas `docs/CLAUDE_REVIEW_GUIDE.md` & `docs/CLAUDE_PROMPT.md`.

---

### TASK-011: Berkas Dokumentasi Resmi README.md Proyek RyokoRent
* **Fase:** FASE 7
* **Deskripsi:** Mengganti file README upstream dengan dokumentasi resmi dan komprehensif untuk RyokoRent Android APK, mencakup fitur 13-field booking, state machine, 60-menit turnaround buffer, tarif 1 bulan, RBAC 4 tingkat, kwitansi paperless, hitung mundur real-time, panduan instalasi PWA di Android Chrome, dan diagram struktur repositori.
* **Dependensi:** `TASK-010`
* **File:** `README.md`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. `README.md` mendokumentasikan 100% kapabilitas fungsional aplikasi RyokoRent.
  2. Menyertakan tabel 13 field booking, panduan setup lokal, dan langkah instalasi PWA Android.
* **Test Case:** Project documentation audit
* **Metode Verifikasi:** Periksa isi `README.md` dan kompilasi build.

---

### TASK-012: Kerangka Pemeriksaan & Rencana Penyesuaian Tindak Lanjut Hasil Review
* **Fase:** FASE 7
* **Deskripsi:** Menyusun rencana aksi dan tabel log penyesuaian hasil review (`docs/REVIEW_ACTION_PLAN.md`) dengan rubrik triase prioritas (P0 Kritis, P1 Operasional, P2 UX), matriks evaluasi mandiri awal, dan prosedur eksekusi kode terstandarisasi.
* **Dependensi:** `TASK-011`
* **File:** `docs/REVIEW_ACTION_PLAN.md`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Dokumen triase menyediakan rubrik klasifikasi severity P0, P1, P2.
  2. Memuat tabel log penyesuaian yang siap mencatat hasil temuan review Claude.
* **Test Case:** Action plan readiness
* **Metode Verifikasi:** Verifikasi kelengkapan `docs/REVIEW_ACTION_PLAN.md`.

---

### TASK-013: Arsitektur & Layanan Sinkronisasi Kolaborasi Google Sheets
* **Fase:** FASE 7
* **Deskripsi:** Mengimplementasikan modul layanan kolaborasi Google Sheets (`src/services/googleSheetsService.ts`) dan dokumentasi integrasi (`docs/GOOGLE_SHEETS_INTEGRATION.md`) untuk pemetaan 13 field form booking ke baris spreadsheet 26 kolom (termasuk status review admin, opsi operasional, dan aksi disetujui), fungsi ekspor CSV UTF-8 instan, antrean sinkronisasi offline, serta integrasi input webhook di panel Pengaturan.
* **Dependensi:** `TASK-012`
* **File:** `src/services/googleSheetsService.ts`, `docs/GOOGLE_SHEETS_INTEGRATION.md`, `src/types/ryoko.ts`, `src/components/SettingsView.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Format 26 kolom Google Sheets mencakup 13 field standar + kolom Review, Opsi, Aksi.
  2. Tombol unduh CSV dan sinkronisasi webhook tersedia di menu Pengaturan.
  3. Mendukung antrean lokal di LocalStorage saat offline.
* **Test Case:** CSV export & sheets row mapping
* **Metode Verifikasi:** Jalankan `npm run lint` dan uji fungsi generator baris spreadsheet.

---

### TASK-014: Sistem Alert Pengembalian via Bot Telegram Admin & Aksi Interaktif
* **Fase:** FASE 7
* **Deskripsi:** Mengimplementasikan modul layanan Bot Telegram (`src/services/telegramBotService.ts`) dan dokumentasi (`docs/TELEGRAM_BOT_INTEGRATION.md`) untuk mengirimkan notifikasi jatuh tempo (H-2 Jam, H-1 Jam, Overdue) langsung ke Telegram Admin, dilengkapi 4 tombol inline action (Review Detail, Setujui Selesai, Perpanjang Sewa, Kenakan Denda), integrasi tombol Bot TG di CountdownAlertBanner, dan panel konfigurasi token di Pengaturan.
* **Dependensi:** `TASK-013`
* **File:** `src/services/telegramBotService.ts`, `docs/TELEGRAM_BOT_INTEGRATION.md`, `src/components/CountdownAlertBanner.tsx`, `src/components/SettingsView.tsx`
* **Docs Terkait:** `BLUEPRINT.md`
* **Docs Impact:** `SESSION_STATE.md`
* **Acceptance Criteria:**
  1. Template pesan Telegram memformat data penyewa, unit motor, sisa waktu, dan denda estimasi.
  2. Tersedia 4 tombol aksi inline interaktif Telegram dengan callback data terdefinisi.
  3. Pengaturan menyediakan input Token & Chat ID dengan fitur uji coba koneksi dan alert contoh.
  4. Banner hitung mundur memiliki tombol pemicu notifikasi Telegram instan.
* **Test Case:** Telegram alert generation & callback handler
* **Metode Verifikasi:** Jalankan `npm run lint` dan `python3 scripts/zlce/zlce-check.py .`.
