import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Đọc biến môi trường của backend từ file .env (KHÔNG commit) để E2E dùng chung
 * một nguồn sự thật: mật khẩu tài khoản seed, DATABASE_URL cho cầu chì an toàn.
 * Nhờ vậy KHÔNG hardcode mật khẩu test vào mã nguồn E2E (mã nguồn có commit).
 */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.resolve(HERE, '../../../thien-duc-website-backend');
const ENV_PATH = path.join(BACKEND_DIR, '.env');

export { BACKEND_DIR };

let cache: Record<string, string> | null = null;

function parseEnv(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

export function backendEnv(): Record<string, string> {
  if (cache) return cache;
  cache = parseEnv(readFileSync(ENV_PATH, 'utf8'));
  return cache;
}

export interface SafeDbMeta {
  host: string;
  port: string;
  database: string;
  schema: string;
}

/**
 * Cầu chì an toàn ở tầng E2E — chỉ cho phép DB test cục bộ. KHÔNG in
 * DATABASE_URL đầy đủ (có mật khẩu); trả metadata an toàn để in.
 */
export function assertSafeDatabase(databaseUrl: string | undefined): SafeDbMeta {
  if (!databaseUrl) throw new Error('E2E: thiếu DATABASE_URL trong backend/.env');
  if (/render\.com/i.test(databaseUrl)) {
    throw new Error('E2E: DATABASE_URL trỏ tới render.com — HỦY (không chạm production).');
  }
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error('E2E: DATABASE_URL không phải URL hợp lệ.');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!['localhost', '127.0.0.1'].includes(url.hostname)) {
    throw new Error(
      `E2E: host DB phải là localhost/127.0.0.1, nhận "${url.hostname}" — HỦY.`,
    );
  }
  if (database !== 'thien_duc_test') {
    throw new Error(
      `E2E: database phải đúng "thien_duc_test", nhận "${database}" — HỦY.`,
    );
  }
  return {
    host: url.hostname,
    port: url.port || '5432',
    database,
    schema: url.searchParams.get('schema') ?? 'public',
  };
}
