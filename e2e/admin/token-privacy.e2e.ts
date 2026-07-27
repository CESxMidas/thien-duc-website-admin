import { test, expect, type Page } from '@playwright/test';
import { seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  apiLogin,
  authedPost,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
} from '../helpers/api';
import { tokenFromUrl } from '../helpers/redact';
import { assertNoTokenLeak } from '../helpers/privacy';

const seed = seedAccounts();
const FIXTURE_PW = `E2eTok!${Math.random().toString(36).slice(2, 10)}`;

/** Bắt console trong suốt vòng đời page để kiểm token không lọt log. */
function captureConsole(page: Page): () => string {
  const msgs: string[] = [];
  page.on('console', (m) => msgs.push(m.text()));
  page.on('pageerror', (e) => msgs.push(e.message));
  return () => msgs.join(' | ');
}

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe('§12 — Quyền riêng tư token (lời mời + đặt lại)', () => {
  test('token lời mời không lọt URL/DOM/toast/storage/cookie/console', async ({
    page,
  }) => {
    const invited = uniqueE2eEmail('tok-invite');
    const superToken = (
      await apiLogin(seed.superAdmin.email, seed.superAdmin.password)
    ).body!.data!.accessToken;
    await clearOutbox();
    await authedPost('/users/invitations', superToken, {
      name: 'Token Privacy',
      email: invited,
      role: 'EDITOR',
    });
    const url = (await getOutbox(invited)).find((m) => m.type === 'invitation')!
      .url!;
    const token = tokenFromUrl(url);

    const consoleText = captureConsole(page);
    await page.goto(url);
    await expect(
      page.getByRole('heading', { name: 'Thiết lập tài khoản' }),
    ).toBeVisible();

    // Không lọt thanh địa chỉ / storage / cookie / DOM text.
    await assertNoTokenLeak(page, token);

    // Đặt mật khẩu rồi kiểm lại (token bị xoá khỏi bộ nhớ sau khi dùng).
    await page.getByLabel('Mật khẩu mới').fill(FIXTURE_PW);
    await page.getByLabel('Nhập lại mật khẩu').fill(FIXTURE_PW);
    await page.getByRole('button', { name: 'Hoàn tất thiết lập' }).click();
    await expect(page.getByRole('heading', { name: 'Hoàn tất' })).toBeVisible();
    await assertNoTokenLeak(page, token);

    // Không lọt console/log toàn vòng đời.
    expect(consoleText()).not.toContain(token);
  });

  test('token đặt lại không lọt URL/DOM/toast/storage/cookie/console', async ({
    page,
  }) => {
    const user = uniqueE2eEmail('tok-reset');
    await upsertTestUser({
      email: user,
      role: 'ADMIN',
      isActive: true,
      setupCompleted: true,
      password: FIXTURE_PW,
    });
    await clearOutbox();
    await fetch(
      `${process.env.E2E_API_URL ?? 'http://localhost:3001/api'}/auth/forgot-password`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user }),
      },
    );
    const url = (await getOutbox(user)).find(
      (m) => m.type === 'password-reset',
    )!.url!;
    const token = tokenFromUrl(url);

    const consoleText = captureConsole(page);
    await page.goto(url);
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu', exact: true }),
    ).toBeVisible();
    await assertNoTokenLeak(page, token);

    const newPw = `${FIXTURE_PW}X`;
    await page.getByLabel('Mật khẩu mới').fill(newPw);
    await page.getByLabel('Xác nhận mật khẩu').fill(newPw);
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu thành công' }),
    ).toBeVisible();
    await assertNoTokenLeak(page, token);
    expect(consoleText()).not.toContain(token);
  });
});
