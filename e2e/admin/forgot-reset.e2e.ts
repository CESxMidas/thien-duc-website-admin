import { test, expect, type Page } from '@playwright/test';
import { adminPath, uniqueE2eEmail } from '../helpers/config';
import {
  apiLogin,
  apiRefresh,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
} from '../helpers/api';
import { expectLoggedIn, readStoredTokens, uiLogin } from '../helpers/auth';
import { tokenFromUrl } from '../helpers/redact';

const INITIAL_PW = `E2eInit!${Math.random().toString(36).slice(2, 10)}`;
const NEW_PW = `E2eNew!${Math.random().toString(36).slice(2, 10)}`;

// Tài khoản riêng cho từng nhóm test để không lẫn trạng thái.
const resetUser = uniqueE2eEmail('reset');
const inactiveUser = uniqueE2eEmail('reset-inactive');
const pendingUser = uniqueE2eEmail('reset-pending');
const dupUser = uniqueE2eEmail('reset-dup');

test.beforeAll(async () => {
  await upsertTestUser({
    email: resetUser,
    role: 'ADMIN',
    isActive: true,
    setupCompleted: true,
    password: INITIAL_PW,
  });
  await upsertTestUser({
    email: inactiveUser,
    role: 'ADMIN',
    isActive: false,
    setupCompleted: true,
    password: INITIAL_PW,
  });
  await upsertTestUser({
    email: pendingUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: false,
  });
  await upsertTestUser({
    email: dupUser,
    role: 'ADMIN',
    isActive: true,
    setupCompleted: true,
    password: INITIAL_PW,
  });
});

test.afterAll(async () => {
  await deleteTestUsers();
});

/** Gửi yêu cầu quên mật khẩu qua UI cho một email, xác nhận màn hình trung tính. */
async function submitForgot(page: Page, email: string): Promise<void> {
  await page.goto(adminPath('/quen-mat-khau'));
  await page.getByLabel('Email').fill(email);
  await page
    .getByRole('button', { name: 'Gửi hướng dẫn đặt lại mật khẩu' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Kiểm tra email của bạn' }),
  ).toBeVisible();
}

/** Không có token bản rõ nào rò ra URL / storage / cookie. */
async function assertNoTokenLeak(page: Page, token: string): Promise<void> {
  expect(page.url()).not.toContain(token);
  const dump = await page.evaluate(() => {
    const dumpStore = (s: Storage) => {
      const o: Record<string, string> = {};
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (k) o[k] = s.getItem(k) ?? '';
      }
      return o;
    };
    return JSON.stringify({
      ls: dumpStore(localStorage),
      ss: dumpStore(sessionStorage),
    });
  });
  expect(dump).not.toContain(token);
  const cookies = await page.context().cookies();
  expect(JSON.stringify(cookies)).not.toContain(token);
}

test.describe('Admin — Quên/Đặt lại mật khẩu (mục 8)', () => {
  test('luồng đặt lại đầy đủ: email → link → đặt lại → không tự đăng nhập → phiên cũ thu hồi', async ({
    page,
  }) => {
    // Phiên cũ (để kiểm sau khi đặt lại thì bị thu hồi).
    const before = await apiLogin(resetUser, INITIAL_PW);
    expect(before.status).toBe(201);
    const oldRefresh = before.body!.data!.refreshToken;

    await clearOutbox();
    await submitForgot(page, resetUser);

    // Bắt email giả + trích link (không in token).
    const mails = await getOutbox(resetUser);
    const mail = mails.find((m) => m.type === 'password-reset');
    expect(mail, 'phải có email đặt lại mật khẩu').toBeTruthy();
    const resetUrl = mail!.url!;
    const token = tokenFromUrl(resetUrl);

    // Mở link đặt lại → token bị gỡ khỏi thanh địa chỉ + không lọt storage/cookie.
    await page.goto(resetUrl);
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu', exact: true }),
    ).toBeVisible();
    expect(page.url()).not.toContain('token');
    await assertNoTokenLeak(page, token);

    // Đặt mật khẩu mới.
    await page.getByLabel('Mật khẩu mới').fill(NEW_PW);
    await page.getByLabel('Xác nhận mật khẩu').fill(NEW_PW);
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu thành công' }),
    ).toBeVisible();

    // KHÔNG tự đăng nhập: không có token lưu, có nút "Đăng nhập".
    const tokens = await readStoredTokens(page);
    expect(tokens.local.concat(tokens.session).filter(Boolean)).toHaveLength(0);
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();

    // Phiên cũ (refresh token cũ) đã bị thu hồi.
    const refreshOld = await apiRefresh(oldRefresh);
    expect(refreshOld.status).not.toBe(201);
    expect(refreshOld.status).not.toBe(200);

    // Mật khẩu cũ KHÔNG đăng nhập được nữa.
    await uiLogin(page, resetUser, INITIAL_PW);
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // Mật khẩu mới đăng nhập được.
    await uiLogin(page, resetUser, NEW_PW);
    await expectLoggedIn(page);

    // Dùng lại link cũ → trạng thái không hợp lệ chung chung.
    await page.goto(resetUrl);
    await expect(
      page.getByRole('heading', { name: 'Liên kết không còn hiệu lực' }),
    ).toBeVisible();
  });

  test('email không tồn tại → UI trung tính, KHÔNG có email nào được tạo', async ({
    page,
  }) => {
    await clearOutbox();
    const ghost = uniqueE2eEmail('ghost-nobody');
    await submitForgot(page, ghost);
    expect(await getOutbox(ghost)).toHaveLength(0);
  });

  test('tài khoản bị vô hiệu hóa → UI trung tính, KHÔNG gửi email', async ({
    page,
  }) => {
    await clearOutbox();
    await submitForgot(page, inactiveUser);
    expect(await getOutbox(inactiveUser)).toHaveLength(0);
  });

  test('tài khoản chờ thiết lập → UI trung tính, KHÔNG gửi email', async ({
    page,
  }) => {
    await clearOutbox();
    await submitForgot(page, pendingUser);
    expect(await getOutbox(pendingUser)).toHaveLength(0);
  });

  test('validate: mật khẩu xác nhận không khớp', async ({ page }) => {
    await clearOutbox();
    await submitForgot(page, dupUser);
    const mail = (await getOutbox(dupUser)).find(
      (m) => m.type === 'password-reset',
    );
    await page.goto(mail!.url!);
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Mật khẩu mới').fill('MatKhauMoi123');
    await page.getByLabel('Xác nhận mật khẩu').fill('KhacNhau123');
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(page.getByText('Mật khẩu xác nhận không khớp.')).toBeVisible();
  });

  test('validate: mật khẩu quá ngắn', async ({ page }) => {
    await clearOutbox();
    const u = uniqueE2eEmail('reset-short');
    await upsertTestUser({
      email: u,
      role: 'ADMIN',
      isActive: true,
      setupCompleted: true,
      password: INITIAL_PW,
    });
    await submitForgot(page, u);
    const mail = (await getOutbox(u)).find((m) => m.type === 'password-reset');
    await page.goto(mail!.url!);
    await expect(
      page.getByRole('heading', { name: 'Đặt lại mật khẩu', exact: true }),
    ).toBeVisible();
    await page.getByLabel('Mật khẩu mới').fill('short');
    await page.getByLabel('Xác nhận mật khẩu').fill('short');
    await page.getByRole('button', { name: 'Đặt lại mật khẩu' }).click();
    await expect(
      page.getByText('Mật khẩu phải có ít nhất 8 ký tự.'),
    ).toBeVisible();
  });

  test('chống gửi lặp: yêu cầu lại trong thời gian cooldown không tạo email thứ hai', async ({
    page,
  }) => {
    const u = uniqueE2eEmail('reset-cooldown');
    await upsertTestUser({
      email: u,
      role: 'ADMIN',
      isActive: true,
      setupCompleted: true,
      password: INITIAL_PW,
    });
    await clearOutbox();
    await submitForgot(page, u);
    expect(await getOutbox(u)).toHaveLength(1);
    // Gửi lại ngay → backend cooldown chặn → vẫn chỉ một email.
    await submitForgot(page, u);
    expect(await getOutbox(u)).toHaveLength(1);
  });

  test('lỗi mạng/API được xử lý an toàn, không lộ tài khoản có tồn tại', async ({
    page,
  }) => {
    await page.route('**/auth/forgot-password', (route) => route.abort());
    await page.goto(adminPath('/quen-mat-khau'));
    await page.getByLabel('Email').fill(resetUser);
    await page
      .getByRole('button', { name: 'Gửi hướng dẫn đặt lại mật khẩu' })
      .click();
    // Toast lỗi chung chung; KHÔNG chuyển sang màn "đã gửi" (không suy ra được gì).
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Kiểm tra email của bạn' }),
    ).toHaveCount(0);
  });
});
