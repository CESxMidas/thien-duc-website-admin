import { test, type Page } from '@playwright/test';
import { adminPath, API_URL, FRONTEND_URL, seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  apiLogin,
  authedPost,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
} from '../helpers/api';
import { uiLogin } from '../helpers/auth';
import { expectNoColorContrast } from '../helpers/a11y';

const seed = seedAccounts();
const FIXTURE_PW = `E2eCon!${Math.random().toString(36).slice(2, 10)}`;
const resetUser = uniqueE2eEmail('con-reset');
const invitedUser = uniqueE2eEmail('con-invite');
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
    name: 'Con Invite',
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

/** `path` là đường dẫn theo GỐC APP (`/dang-nhap`); `adminPath` gắn tiền tố base. */
async function goAdmin(page: Page, path: string) {
  await page.goto(adminPath(path));
  await page.waitForLoadState('load');
}
async function goFE(page: Page, path: string) {
  await page.goto(`${FRONTEND_URL}${path}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
  await page.waitForLoadState('load');
}

for (const vp of VIEWPORTS) {
  test.describe(`§13/§6 — Color-contrast @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('Admin: login/forgot/reset/setup/users — 0 vi phạm tương phản', async ({
      page,
    }) => {
      await goAdmin(page, '/dang-nhap');
      await expectNoColorContrast(page, `admin-login-${vp.name}`);
      await goAdmin(page, '/quen-mat-khau');
      await expectNoColorContrast(page, `admin-forgot-${vp.name}`);
      await page.goto(resetUrl);
      await page.waitForLoadState('load');
      await expectNoColorContrast(page, `admin-reset-${vp.name}`);
      await page.goto(setupUrl);
      await page.waitForLoadState('load');
      await expectNoColorContrast(page, `admin-setup-${vp.name}`);
      await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
      await goAdmin(page, '/tai-khoan');
      await expectNoColorContrast(page, `admin-users-${vp.name}`);
    });

    test('Frontend: home/contact/news — 0 vi phạm tương phản', async ({
      page,
    }) => {
      await goFE(page, '/');
      await expectNoColorContrast(page, `frontend-home-${vp.name}`);
      await goFE(page, '/lien-he');
      await expectNoColorContrast(page, `frontend-contact-${vp.name}`);
      await goFE(page, '/tin-tuc');
      await expectNoColorContrast(page, `frontend-news-${vp.name}`);
    });

    // Các trang có cùng idiom panel bg-brand-soft+text-white đã sửa sang bg-brand
    // — kiểm để chắc bản sửa sạch, không chỉ "an toàn theo lý thuyết".
    test('Frontend: các trang panel đã sửa (du-an/gioi-thieu/cong-ty) — 0 vi phạm', async ({
      page,
    }) => {
      await goFE(page, '/du-an');
      await expectNoColorContrast(page, `frontend-duan-${vp.name}`);
      await goFE(page, '/gioi-thieu');
      await expectNoColorContrast(page, `frontend-gioithieu-${vp.name}`);
      await goFE(page, '/cong-ty-thanh-vien');
      await expectNoColorContrast(page, `frontend-congty-${vp.name}`);
    });
  });
}
