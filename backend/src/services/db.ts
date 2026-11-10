import sql from 'mssql';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

export const prisma = new PrismaClient();
let isPrismaConnected = false;

export interface SqlConfig {
  server: string;
  port: number;
  database: string;
  user?: string;
  password?: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
}

const config: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  port: Number(process.env.DB_PORT) || 1433,
  database: process.env.DB_NAME || 'PingPongBros',
  user: process.env.DB_USER || 'sa',
  password: process.env.DB_PASSWORD || 'YourStrong@Password123',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_CERT !== 'false',
    connectTimeout: 4000,
  },
};

let pool: sql.ConnectionPool | null = null;
let isConnected = false;

export async function initDatabase(): Promise<boolean> {
  const dbUrl = process.env.DATABASE_URL || '';

  // 1. Kiểm tra kết nối Supabase (PostgreSQL) qua Prisma
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    try {
      console.log('[Supabase / PostgreSQL] Connecting to cloud database via Prisma...');
      await prisma.$connect();
      isPrismaConnected = true;
      isConnected = true;
      console.log('[Supabase / PostgreSQL] Connected successfully to Supabase Database!');
      return true;
    } catch (err: any) {
      isPrismaConnected = false;
      isConnected = false;
      console.warn(`[Supabase / PostgreSQL] Could not connect: ${err?.message || err}`);
      console.warn(`[Storage] System running in resilient mode with persistent store.json.`);
      return false;
    }
  }

  // 2. Kiểm tra kết nối Microsoft SQL Server
  try {
    console.log(`[SQL Server] Connecting to ${config.server}:${config.port}/${config.database}...`);
    pool = await new sql.ConnectionPool(config).connect();
    isConnected = true;
    console.log(`[SQL Server] Connected successfully to Microsoft SQL Server (${config.database})!`);
    return true;
  } catch (err: any) {
    isConnected = false;
    console.warn(`[SQL Server] Note: Could not connect to SQL Server at ${config.server}:${config.port} (${err?.message || err}).`);
    console.warn(`[SQL Server] System is running in resilient In-Memory mode with SQL Server synchronization readiness.`);
    return false;
  }
}

export function isDbConnected(): boolean {
  return isConnected || isPrismaConnected;
}

export function getDbPool(): sql.ConnectionPool | null {
  return pool;
}

/**
 * Thực thi câu truy vấn T-SQL an toàn với parameters
 */
export async function querySql<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  if (!pool || !isConnected) {
    return [];
  }
  try {
    const request = pool.request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
      }
    }
    const result = await request.query(queryText);
    return result.recordset || [];
  } catch (error) {
    console.error('[SQL Server Query Error]:', error);
    throw error;
  }
}

/**
 * Lưu vết Audit Log vào bảng nhat_ky_he_thong
 */
export async function recordAuditLogSQL(user: string, action: string, oldVal: string, newVal: string): Promise<void> {
  if (!pool || !isConnected) return;
  try {
    await querySql(
      `INSERT INTO nhat_ky_he_thong (nguoi_thuc_hien, hanh_dong, gia_tri_cu, gia_tri_moi, thoi_gian)
       VALUES (@user, @action, @oldVal, @newVal, GETDATE())`,
      { user, action, oldVal, newVal }
    );
  } catch (err) {
    console.error('[SQL Server] Error recording audit log:', err);
  }
}

/**
 * Lưu thông báo vào bảng thong_bao
 */
export async function recordNotificationSQL(
  userId: number | null,
  tieuDe: string,
  noiDung: string,
  loaiThongBao: string = 'EMAIL'
): Promise<void> {
  if (!pool || !isConnected) return;
  try {
    await querySql(
      `INSERT INTO thong_bao (nguoi_dung_id, tieu_de, noi_dung, loai_thong_bao, da_doc, thoi_gian_gui)
       VALUES (@userId, @tieuDe, @noiDung, @loaiThongBao, 0, GETDATE())`,
      { userId, tieuDe, noiDung, loaiThongBao }
    );
  } catch (err) {
    console.error('[SQL Server] Error recording notification:', err);
  }
}
