import { execSync } from 'node:child_process';
import { assertSafeDatabase, backendEnv, BACKEND_DIR } from './helpers/backend-env';

/**
 * Chuẩn bị E2E (chạy trước khi dựng server):
 *   1. Cầu chì DB an toàn (localhost + thien_duc_test, không render.com).
 *   2. `prisma migrate deploy` (KHÔNG migrate reset).
 *   3. `prisma db seed` (seed-e2e — idempotent, hai tài khoản seed).
 * In metadata DB an toàn (không in DATABASE_URL đầy đủ).
 */
export default function globalSetup(): void {
  const env = backendEnv();
  const meta = assertSafeDatabase(env.DATABASE_URL);
  console.log(
    `[E2E] DB an toàn — host=${meta.host} port=${meta.port} database=${meta.database} schema=${meta.schema}`,
  );

  const run = (cmd: string) =>
    execSync(cmd, { cwd: BACKEND_DIR, stdio: 'inherit' });

  console.log('[E2E] prisma migrate deploy...');
  run('npx prisma migrate deploy');
  console.log('[E2E] prisma db seed (seed-e2e)...');
  run('npx prisma db seed');
  console.log('[E2E] Chuẩn bị DB xong.');
}
