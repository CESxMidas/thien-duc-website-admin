import { test, expect } from '@playwright/test';
import { seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  apiLogin,
  authedPost,
  deleteTestUsers,
  getTestUser,
  upsertTestUser,
} from '../helpers/api';
import { expectLoggedIn, uiLogin } from '../helpers/auth';

/**
 * CMS-RETIRE-DIRECT-USER-CREATE-M1 — route tạo tài khoản trực tiếp đã bị gỡ.
 *
 * `POST /api/users` từng cho SUPER_ADMIN tạo thẳng một tài khoản kèm mật khẩu
 * do quản trị viên chọn. Route đã bị gỡ hẳn: giờ trả 404 (route-not-found),
 * không tạo hàng nào trong DB, và lời mời là lối cấp tài khoản duy nhất.
 *
 * Bộ này chạy ở tầng end-to-end thật (backend 3001, DB thien_duc_test, email
 * transport GIẢ) để bổ sung cho unit test phía Admin và integration test backend.
 */

const seed = seedAccounts();
const editorFixture = uniqueE2eEmail('retire-editor');
const FIXTURE_PW = `E2eRet!${Math.random().toString(36).slice(2, 10)}`;

let superToken = '';
let adminToken = '';
let editorToken = '';

test.beforeAll(async () => {
  await upsertTestUser({
    email: editorFixture,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: true,
    password: FIXTURE_PW,
  });

  const superRes = await apiLogin(seed.superAdmin.email, seed.superAdmin.password);
  expect(superRes.status).toBe(201);
  superToken = superRes.body?.data?.accessToken ?? '';

  const adminRes = await apiLogin(seed.admin.email, seed.admin.password);
  expect(adminRes.status).toBe(201);
  adminToken = adminRes.body?.data?.accessToken ?? '';

  const editorRes = await apiLogin(editorFixture, FIXTURE_PW);
  expect(editorRes.status).toBe(201);
  editorToken = editorRes.body?.data?.accessToken ?? '';
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe('§ Retire POST /users — route tạo trực tiếp đã gỡ', () => {
  test('POST /api/users trả 404 với SUPER_ADMIN và KHÔNG tạo tài khoản', async () => {
    const email = uniqueE2eEmail('retire-direct');

    const res = await authedPost('/users', superToken, {
      email,
      name: 'Tạo trực tiếp',
      role: 'EDITOR',
      password: 'MatKhauQuanTri123',
    });

    expect(res.status).toBe(404);
    expect(res.body?.success).toBe(false);
    expect(await getTestUser(email)).toBeNull();
  });

  test('payload kèm password / passwordHash cũng 404, không ghi DB', async () => {
    const payloads: Array<[string, Record<string, unknown>]> = [
      ['password', { password: 'MatKhauQuanTri123' }],
      ['passwordHash', { passwordHash: '$2b$12$gia.mao' }],
      ['setupCompletedAt', { setupCompletedAt: new Date().toISOString() }],
      ['không mật khẩu', {}],
    ];

    for (const [label, extra] of payloads) {
      const email = uniqueE2eEmail('retire-payload');
      const res = await authedPost('/users', superToken, {
        email,
        name: `Payload ${label}`,
        role: 'SUPER_ADMIN',
        ...extra,
      });

      expect(res.status, `payload "${label}"`).toBe(404);
      expect(await getTestUser(email), `payload "${label}"`).toBeNull();
    }
  });

  test('ADMIN và EDITOR gọi POST /users cũng chỉ nhận 404, không tạo tài khoản', async () => {
    for (const [label, token] of [
      ['ADMIN', adminToken],
      ['EDITOR', editorToken],
    ] as const) {
      const email = uniqueE2eEmail('retire-role');
      const res = await authedPost('/users', token, {
        email,
        name: `Từ ${label}`,
        role: 'EDITOR',
        password: 'MatKhauQuanTri123',
      });

      expect(res.status, label).toBe(404);
      expect(await getTestUser(email), label).toBeNull();
    }
  });

  test('lời mời vẫn là lối cấp tài khoản duy nhất và vẫn chạy', async () => {
    const email = uniqueE2eEmail('retire-invite-ok');

    const res = await authedPost('/users/invitations', superToken, {
      email,
      name: 'Người được mời',
      role: 'EDITOR',
    });

    expect(res.status).toBe(201);
    const created = await getTestUser(email);
    expect(created).not.toBeNull();
    expect(created?.setupCompleted).toBe(false);
    expect(created?.activeInvitationCount).toBe(1);

    // Response không lộ token thô / hash.
    const raw = JSON.stringify(res.body);
    expect(raw).not.toMatch(/tokenHash/i);
    expect(raw).not.toMatch(/passwordHash/i);
  });

  test('lời mời từ chối field password (400) và không tạo tài khoản', async () => {
    const email = uniqueE2eEmail('retire-invite-pw');

    const res = await authedPost('/users/invitations', superToken, {
      email,
      name: 'Người được mời',
      role: 'EDITOR',
      password: 'MatKhauQuanTri123',
    });

    expect(res.status).toBe(400);
    expect(await getTestUser(email)).toBeNull();
  });

  test('UI tạo tài khoản KHÔNG phát sinh request POST /users nào', async ({
    page,
  }) => {
    const directCreateCalls: string[] = [];
    page.on('request', (req) => {
      const { pathname } = new URL(req.url());
      if (req.method() === 'POST' && /\/api\/users\/?$/.test(pathname)) {
        directCreateCalls.push(req.url());
      }
    });

    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await expect(
      page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // Form lời mời: không ô mật khẩu, không input type=password.
    await expect(dialog.getByLabel(/mật khẩu/i)).toHaveCount(0);
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);

    const email = uniqueE2eEmail('retire-ui-invite');
    await dialog.getByLabel('Họ tên').fill('Người được mời UI');
    await dialog.getByLabel('Email').fill(email);

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes('/users/invitations') &&
        r.request().method() === 'POST',
    );
    await dialog
      .getByRole('button', { name: 'Tạo tài khoản và gửi lời mời' })
      .click();
    const resp = await respPromise;

    const payload = (resp.request().postDataJSON() ?? {}) as Record<
      string,
      unknown
    >;
    expect(Object.keys(payload)).not.toContain('password');
    expect(Object.keys(payload)).not.toContain('passwordHash');

    expect((await getTestUser(email))?.setupCompleted).toBe(false);
    expect(directCreateCalls).toEqual([]);
  });
});
