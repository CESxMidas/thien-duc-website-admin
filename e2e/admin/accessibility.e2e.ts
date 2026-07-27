import { test, expect } from '@playwright/test';
import {
  FRONTEND_URL,
  seedAccounts,
  uniqueE2eEmail,
} from '../helpers/config';
import {
  apiLogin,
  authedPost,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
} from '../helpers/api';
import { expectLoggedIn, uiLogin } from '../helpers/auth';
import { expectNoSeriousA11y } from '../helpers/a11y';

const seed = seedAccounts();
const FIXTURE_PW = `E2eA11y!${Math.random().toString(36).slice(2, 10)}`;
const resetUser = uniqueE2eEmail('a11y-reset');
const invitedUser = uniqueE2eEmail('a11y-invite');

let setupUrl = '';
let resetUrl = '';

test.beforeAll(async () => {
  await upsertTestUser({
    email: resetUser,
    role: 'ADMIN',
    isActive: true,
    setupCompleted: true,
    password: FIXTURE_PW,
  });
  const superToken = (
    await apiLogin(seed.superAdmin.email, seed.superAdmin.password)
  ).body!.data!.accessToken;

  // Link thiết lập (lời mời) — lấy từ outbox giả.
  await clearOutbox();
  await authedPost('/users/invitations', superToken, {
    name: 'A11y Invite',
    email: invitedUser,
    role: 'EDITOR',
  });
  setupUrl = (await getOutbox(invitedUser)).find((m) => m.type === 'invitation')!
    .url!;

  // Link đặt lại mật khẩu — lấy từ outbox giả.
  await clearOutbox();
  await fetch(`${process.env.E2E_API_URL ?? 'http://localhost:3001/api'}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: resetUser }),
  });
  resetUrl = (await getOutbox(resetUser)).find((m) => m.type === 'password-reset')!
    .url!;
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe('§13 — Kiểm thử accessibility (axe)', () => {
  test('Admin đăng nhập: axe + đúng một h1 + nút hiện mật khẩu có tên khả truy cập', async ({
    page,
  }) => {
    await page.goto('/dang-nhap');
    await expect(
      page.getByRole('heading', { name: 'Đăng nhập hệ thống quản trị' }),
    ).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      page.getByRole('button', { name: 'Hiện mật khẩu' }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'admin-login');
  });

  test('Admin quên mật khẩu: axe + đúng một h1', async ({ page }) => {
    await page.goto('/quen-mat-khau');
    await expect(page.getByRole('heading', { name: 'Quên mật khẩu?' })).toBeVisible();
    await expect(page.locator('h1')).toHaveCount(1);
    await expectNoSeriousA11y(page, 'admin-forgot');
  });

  test('Admin đặt lại mật khẩu (form): axe', async ({ page }) => {
    await page.goto(resetUrl);
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu', exact: true }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'admin-reset');
  });

  test('Admin thiết lập tài khoản (form): axe', async ({ page }) => {
    await page.goto(setupUrl);
    await expect(
      page.getByRole('heading', { name: 'Thiết lập tài khoản' }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'admin-setup');
  });

  test('Admin quản lý tài khoản: axe', async ({ page }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await expect(
      page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'admin-users');
  });

  test('Admin: modal thêm tài khoản bẫy focus + Escape đóng', async ({
    page,
  }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Focus nằm trong dialog.
    await expect
      .poll(() => dialog.evaluate((el) => el.contains(document.activeElement)))
      .toBe(true);
    await expectNoSeriousA11y(page, 'admin-user-dialog');
    // Escape đóng dialog.
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('Frontend trang chủ: axe', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('load');
    await expectNoSeriousA11y(page, 'frontend-home');
  });

  test('Frontend trang liên hệ: axe + nhãn input', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/lien-he`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await expect(page.locator('#contact-name')).toBeVisible();
    // Các input có nhãn liên kết.
    await expect(page.getByLabel('Họ và tên')).toBeVisible();
    await expect(page.getByLabel('Số điện thoại')).toBeVisible();
    await expectNoSeriousA11y(page, 'frontend-contact');
  });

  test('Frontend trang tin tức: axe', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/tin-tuc`, {
      timeout: 60_000,
      waitUntil: 'domcontentloaded',
    });
    await page.waitForLoadState('load');
    await expectNoSeriousA11y(page, 'frontend-news');
  });
});
