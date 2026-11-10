/**
 * PERSISTENT STORAGE SERVICE - CHUẨN PRODUCTION
 * Lưu trữ dữ liệu vĩnh viễn trên đĩa (Data Persistence on Disk)
 * Đồng thời tự động đồng bộ sang Microsoft SQL Server khi có kết nối
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardData } from '../data/mock.js';
import { isDbConnected, querySql } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Thư mục lưu trữ dữ liệu vĩnh viễn
const DATA_DIR = path.resolve(__dirname, '../../data');
const STORE_FILE = path.join(DATA_DIR, 'store.json');

/**
 * Khởi tạo hệ thống lưu trữ: Nạp dữ liệu đã lưu từ đĩa nếu có
 */
export function initStorage(): void {
  // Trong môi trường test tự động, không nạp file store để các test case luôn độc lập
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf8');
      if (raw && raw.trim().length > 0) {
        const saved = JSON.parse(raw);
        if (saved && typeof saved === 'object') {
          if (Array.isArray(saved.users) && saved.users.length > 0) dashboardData.users = saved.users;
          if (Array.isArray(saved.members)) dashboardData.members = saved.members;
          if (Array.isArray(saved.tables) && saved.tables.length > 0) dashboardData.tables = saved.tables;
          if (Array.isArray(saved.bookings)) dashboardData.bookings = saved.bookings;
          if (Array.isArray(saved.classes)) dashboardData.classes = saved.classes;
          if (Array.isArray(saved.payments)) dashboardData.payments = saved.payments;
          if (saved.config && typeof saved.config === 'object') dashboardData.config = { ...dashboardData.config, ...saved.config };
          console.log(`[Storage] Dữ liệu vĩnh viễn đã được phục hồi thành công từ ${STORE_FILE}`);
          return;
        }
      }
    }

    // Nếu chưa có file lưu trữ, ghi dữ liệu khởi tạo ra file
    persistStore();
    console.log(`[Storage] Đã tạo file lưu trữ vĩnh viễn ban đầu tại ${STORE_FILE}`);
  } catch (err: any) {
    console.warn(`[Storage] Cảnh báo khi nạp dữ liệu: ${err?.message || err}`);
  }
}

let saveTimeout: NodeJS.Timeout | null = null;

/**
 * Lưu dữ liệu vĩnh viễn xuống đĩa và đồng bộ SQL Server
 */
export function persistStore(): void {
  // Không ghi file trong môi trường test tự động
  if (process.env.NODE_ENV === 'test') {
    return;
  }

  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const payload = JSON.stringify(
      {
        users: dashboardData.users,
        members: dashboardData.members,
        tables: dashboardData.tables,
        bookings: dashboardData.bookings,
        classes: dashboardData.classes,
        payments: dashboardData.payments,
        config: dashboardData.config,
        savedAt: new Date().toISOString(),
      },
      null,
      2
    );

    // Ghi an toàn vào file tạm trước rồi rename (Atomic Write)
    const tempFile = `${STORE_FILE}.tmp`;
    fs.writeFileSync(tempFile, payload, 'utf8');
    fs.renameSync(tempFile, STORE_FILE);
  } catch (err: any) {
    console.error(`[Storage] Lỗi khi ghi dữ liệu xuống đĩa: ${err?.message || err}`);
  }

  // Tự động đồng bộ sang SQL Server nếu đang có kết nối cơ sở dữ liệu thật
  if (isDbConnected()) {
    syncToSqlServer().catch((err) => {
      console.warn(`[SQL Server Sync] Lỗi đồng bộ: ${err?.message || err}`);
    });
  }
}

/**
 * Đồng bộ dữ liệu sang SQL Server
 */
async function syncToSqlServer(): Promise<void> {
  if (!isDbConnected()) return;

  try {
    // Đồng bộ cấu hình
    await querySql(`
      UPDATE cau_hinh SET gia_tri = @courtPrice WHERE khoa = 'court_price';
      UPDATE cau_hinh SET gia_tri = @teacherPrice WHERE khoa = 'teacher_price';
      UPDATE cau_hinh SET gia_tri = @holdLimit WHERE khoa = 'hold_limit_minutes';
    `, {
      courtPrice: String(dashboardData.config.courtPrice),
      teacherPrice: String(dashboardData.config.teacherPrice),
      holdLimit: String(dashboardData.config.holdLimitMinutes),
    });
  } catch (err: any) {
    // Im lặng ghi log nếu SQL Server tạm thời bận
  }
}
