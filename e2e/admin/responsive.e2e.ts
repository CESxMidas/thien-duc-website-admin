import { test, expect } from '@playwright/test';
import {
  API_URL,
  FRONTEND_URL,
  seedAccounts,
  uniqueE2eEmail,
} from '../helpers/config';
import { expectNoHorizontalOverflow } from '../helpers/layout';
import {
  apiLogin,
  authedPost,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
} from '../helpers/api';
import { uiLogin } from '../helpers/auth';

/** Nút menu người dùng ở topbar — hiện ở MỌI viewport khi đã đăng nhập. */
const SESSION_BTN = 'button[aria-haspopup="true"]';

const seed = seedAccounts();
const FIXTURE_PW = `E2eRwd!${Math.random().toString(36).slice(2, 10)}`;
const resetUser = uniqueE2eEmail('rwd-reset');
const invitedUser = uniqueE2eEmail('rwd-invite');

let setupUrl = '';
let resetUrl = '';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

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
  await clearOutbox();
  await authedPost('/users/invitations', superToken, {
    name: 'Rwd Invite',
    email: invitedUser,
    role: 'EDITOR',
  });
  setupUrl = (await getOutbox(invitedUser)).find((m) => m.type === 'invitation')!
    .url!;
  await clearOutbox();
  await fetch(
    `${API_URL}/auth/forgot-password`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: resetUser }),
    },
  );
  resetUrl = (await getOutbox(resetUser)).find(
    (m) => m.type === 'password-reset',
  )!.url!;
});

test.afterAll(async () => {
  await deleteTestUsers();
});

// `expectNoHorizontalOverflow` chuyển sang `helpers/layout.ts`: cùng ngưỡng
// (scrollWidth ≤ innerWidth + 1px) nhưng chờ bố cục ổn định trước khi đo và in
// ra ĐÚNG phần tử gây tràn khi đỏ, thay vì chỉ hai con số.

for (const vp of VIEWPORTS) {
  test.describe(`§14 — Responsive @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Admin: login/forgot/reset/setup không tràn ngang + control chính hiển thị', async ({
      page,
    }) => {
      await page.goto('/dang-nhap');
      await expect(
        page.getByRole('button', { name: 'Đăng nhập' }),
      ).toBeVisible();
      await expect(page.getByLabel('Email')).toBeVisible();
      await expectNoHorizontalOverflow(page, `login-${vp.name}`);

      await page.goto('/quen-mat-khau');
      await expect(
        page.getByRole('button', { name: 'Gửi hướng dẫn đặt lại mật khẩu' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, `forgot-${vp.name}`);

      await page.goto(resetUrl);
      await expect(page.getByLabel('Mật khẩu mới')).toBeVisible();
      await expectNoHorizontalOverflow(page, `reset-${vp.name}`);

      await page.goto(setupUrl);
      await expect(page.getByLabel('Mật khẩu mới')).toBeVisible();
      await expectNoHorizontalOverflow(page, `setup-${vp.name}`);
    });

    test('Admin: danh sách tài khoản không tràn ngang + điều hướng truy cập được', async ({
      page,
    }) => {
      await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
      await expect(page.locator(SESSION_BTN)).toBeVisible();
      await page.goto('/tai-khoan');
      await expect(
        page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, `users-${vp.name}`);
      // Điều hướng truy cập được: desktop thấy sidebar; mobile có nút mở menu.
      if (vp.width >= 1024) {
        await expect(
          page.getByRole('link', { name: 'Tổng quan' }),
        ).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: 'Mở menu' })).toBeVisible();
      }
    });

    test('Frontend: trang chủ + liên hệ không tràn ngang + control chính hiển thị', async ({
      page,
    }) => {
      await page.goto(`${FRONTEND_URL}/`, {
        timeout: 60_000,
        waitUntil: 'domcontentloaded',
      });
      await expectNoHorizontalOverflow(page, `home-${vp.name}`);

      await page.goto(`${FRONTEND_URL}/lien-he`, {
        timeout: 60_000,
        waitUntil: 'domcontentloaded',
      });
      await expect(page.locator('#contact-name')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Gửi yêu cầu' }),
      ).toBeVisible();
      await expectNoHorizontalOverflow(page, `contact-${vp.name}`);
    });
  });
}

test.describe('§14 — Modal trong viewport (mobile)', () => {
  test.use({ viewport: { width: 375, height: 812 } });
  test('modal thêm tài khoản nằm gọn trong viewport', async ({ page }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expect(page.locator(SESSION_BTN)).toBeVisible();
    await page.goto('/tai-khoan');
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(-1);
    expect(box!.x + box!.width).toBeLessThanOrEqual(375 + 1);
  });
});
