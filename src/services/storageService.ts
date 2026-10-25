import { RyokoDatabase, AuditLogItem } from '../types/ryoko';
import { INITIAL_DATABASE } from '../data/seedData';

const STORAGE_KEY = 'ryokourent_db_v1';

export interface SaveResult {
  ok: boolean;
  message?: string;
}

// Request persistent storage if supported (TASK-020)
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

export function loadDatabase(): RyokoDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }
    const parsed = JSON.parse(raw) as RyokoDatabase;
    if (!parsed.motors || !parsed.units || !parsed.bookings) {
      saveDatabase(INITIAL_DATABASE);
      return INITIAL_DATABASE;
    }
    // Auto-migrate serviceRecords if missing
    if (!parsed.serviceRecords) {
      parsed.serviceRecords = INITIAL_DATABASE.serviceRecords || [];
    }
    // Auto-migrate dailyOperationalLogs if missing
    if (!parsed.dailyOperationalLogs) {
      parsed.dailyOperationalLogs = [];
    }
    // Auto-migrate users if missing
    if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length === 0) {
      parsed.users = INITIAL_DATABASE.users || [];
    }
    if (!parsed.currentUserId) {
      parsed.currentUserId = INITIAL_DATABASE.currentUserId || 'usr-admin';
    }
    // Ensure monthly price exists
    parsed.motors = parsed.motors.map(m => {
      if ((m as unknown as { harga2Minggu?: number }).harga2Minggu && !m.harga1Bulan) {
        m.harga1Bulan = Math.round((m.harga1Hari * 22) / 1000) * 1000;
      }
      return m;
    });
    // Ensure Ridho booking is present if fresh
    if (INITIAL_DATABASE.bookings) {
      INITIAL_DATABASE.bookings.forEach(ib => {
        if (!parsed.bookings.some(b => b.id === ib.id || b.noBooking === ib.noBooking)) {
          parsed.bookings.unshift(ib);
        }
      });
    }
    return parsed;
  } catch (error) {
    console.error('Failed to load database from LocalStorage:', error);
    return INITIAL_DATABASE;
  }
}

export function saveDatabase(db: RyokoDatabase): SaveResult {
  try {
    db.lastUpdated = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    return { ok: true };
  } catch (error) {
    console.error('Failed to save database to LocalStorage:', error);
    const errText = error instanceof Error ? error.message : 'Kuota penyimpanan LocalStorage terlampaui';
    return { ok: false, message: errText };
  }
}

export function resetDatabaseToDefault(): RyokoDatabase {
  saveDatabase(INITIAL_DATABASE);
  return INITIAL_DATABASE;
}

export function exportDatabaseJSON(includeSecrets = false): string {
  const db = loadDatabase();
  if (!includeSecrets) {
    // Sanitasi kredensial eksternal untuk backup publik aman (TASK-020 F-13)
    const sanitizedDb: RyokoDatabase = {
      ...db,
      settings: {
        ...db.settings,
        telegramBotToken: undefined,
        telegramAdminChatId: undefined,
        googleSheetsWebhookUrl: undefined,
      },
    };
    return JSON.stringify(sanitizedDb, null, 2);
  }
  return JSON.stringify(db, null, 2);
}

export function importDatabaseJSON(jsonStr: string): { success: boolean; message: string; db?: RyokoDatabase } {
  try {
    const parsed = JSON.parse(jsonStr) as RyokoDatabase;
    if (!parsed.motors || !Array.isArray(parsed.motors) || !parsed.units || !parsed.bookings) {
      return { success: false, message: 'Format file JSON tidak valid untuk database RyokoRent.' };
    }
    parsed.lastUpdated = new Date().toISOString();
    saveDatabase(parsed);
    return { success: true, message: 'Database berhasil dipulihkan dari file cadangan.', db: parsed };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Kesalahan parsing JSON';
    return { success: false, message: `Gagal memulihkan database: ${errorMsg}` };
  }
}

export function getStorageUsage(): { bytes: number; kb: number; percentEstimate: number } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || '';
    const bytes = new Blob([raw]).size;
    const kb = Math.round(bytes / 1024 * 10) / 10;
    // Typical LocalStorage limit is 5MB
    const percentEstimate = Math.min(100, Math.round((bytes / (5 * 1024 * 1024)) * 1000) / 10);
    return { bytes, kb, percentEstimate };
  } catch {
    return { bytes: 0, kb: 0, percentEstimate: 0 };
  }
}

export function appendAuditLog(db: RyokoDatabase, aktivitas: string, detail: string): RyokoDatabase {
  const now = new Date();
  const timeStr = now.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }) + ' ' + now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

  const newLog: AuditLogItem = {
    id: `aud-${Date.now().toString(36)}`,
    waktu: timeStr,
    user: db.settings.operatorName || 'Operator Ryoko',
    aktivitas,
    detail,
  };

  const updatedLogs = [newLog, ...(db.settings.auditLogs || [])].slice(0, 50); // Keep last 50
  db.settings.auditLogs = updatedLogs;
  saveDatabase(db);
  return db;
}
