import { test, expect, type Page, type Browser } from '@playwright/test';
import { adminPath, seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  ageInvitations,
  apiLogin,
  authedPost,
  clearOutbox,
  deleteTestUsers,
  getOutbox,
  upsertTestUser,
  type OutboxEntry,
} from '../helpers/api';
import { expectLoggedIn, readStoredTokens, uiLogin } from '../helpers/auth';
import { tokenFromUrl } from '../helpers/redact';
import { assertNoTokenLeak } from '../helpers/privacy';

const seed = seedAccounts();
// Mật khẩu thiết lập dùng chung cho lần chạy — KHÔNG in ra.
const SETUP_PW = `E2eSetup!${Math.random().toString(36).slice(2, 10)}`;

test.afterAll(async () => {
  await deleteTestUsers();
});

/** Đăng nhập SUPER_ADMIN rồi mở màn hình quản lý tài khoản. */
async function openUserManagementAsSuperAdmin(page: Page): Promise<void> {
  await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
  await expectLoggedIn(page);
  await page.goto(adminPath('/tai-khoan'));
  await expect(
    page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
  ).toBeVisible();
}

/** Tạo lời mời qua UI. Trả về request payload đã gửi để kiểm không có mật khẩu. */
async function createInvitationViaUI(
  page: Page,
  name: string,
  email: string,
): Promise<Record<string, unknown>> {
  await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  // Form KHÔNG có ô mật khẩu (cả tạo mới).
  await expect(dialog.getByLabel(/mật khẩu/i)).toHaveCount(0);
  await dialog.getByLabel('Họ tên').fill(name);
  await dialog.getByLabel('Email').fill(email);
  // Vai trò để mặc định (Biên tập viên / EDITOR).
  const respPromise = page.waitForResponse(
    (r) =>
      r.url().includes('/users/invitations') && r.request().method() === 'POST',
  );
  await dialog
    .getByRole('button', { name: 'Tạo tài khoản và gửi lời mời' })
    .click();
  const resp = await respPromise;
  // Chờ phản hồi (backend đã ghi outbox xong trước khi trả) → đọc outbox tất định.
  const payload = (resp.request().postDataJSON() ?? {}) as Record<
    string,
    unknown
  >;
  return payload;
}

/** Lấy URL thiết lập từ email lời mời giả (không in token). */
async function captureInvitationUrl(email: string): Promise<string> {
  const mails: OutboxEntry[] = await getOutbox(email);
  const mail = mails.find((m) => m.type === 'invitation');
  expect(mail, 'phải có email lời mời').toBeTruthy();
  expect(mail!.url, 'email lời mời phải có URL').toBeTruthy();
  return mail!.url!;
}

/** Mở link thiết lập trong context sạch (đăng xuất) — trả page + console log. */
async function openSetupInFreshContext(
  browser: Browser,
  url: string,
): Promise<{ page: Page; consoleText: () => string; close: () => Promise<void> }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const messages: string[] = [];
  page.on('console', (m) => messages.push(m.text()));
  await page.goto(url);
  return {
    page,
    consoleText: () => messages.join(' | '),
    close: () => ctx.close(),
  };
}

test.describe('Admin — Lời mời tài khoản (mục 7)', () => {
  test('luồng đầy đủ: tạo → thiết lập → đăng nhập → link cũ vô hiệu', async ({
    page,
    browser,
  }) => {
    await clearOutbox();
    const invited = uniqueE2eEmail('invite');

    await openUserManagementAsSuperAdmin(page);

    // Tạo lời mời + kiểm payload KHÔNG chứa mật khẩu.
    const payload = await createInvitationViaUI(page, 'Người Được Mời', invited);
    expect(Object.keys(payload)).not.toContain('password');
    expect(Object.keys(payload)).not.toContain('passwordHash');

    // Tài khoản mới hiện trạng thái "Chờ thiết lập".
    const row = page.getByRole('row').filter({ hasText: invited });
    await expect(row.getByText('Chờ thiết lập')).toBeVisible();

    // Bắt email lời mời + trích URL (không in token).
    const setupUrl = await captureInvitationUrl(invited);
    const token = tokenFromUrl(setupUrl);

    // UI danh sách KHÔNG bao giờ hiển thị token.
    expect(await page.locator('body').innerText()).not.toContain(token);

    // Mở link trong context sạch, đăng xuất.
    const fresh = await openSetupInFreshContext(browser, setupUrl);
    // Token bị gỡ khỏi thanh địa chỉ + không lọt storage/cookie/text.
    await expect(
      fresh.page.getByRole('heading', { name: 'Thiết lập tài khoản' }),
    ).toBeVisible();
    expect(fresh.page.url()).not.toContain('token');
    await assertNoTokenLeak(fresh.page, token);

    // Đặt mật khẩu → thành công.
    await fresh.page.getByLabel('Mật khẩu mới').fill(SETUP_PW);
    await fresh.page.getByLabel('Nhập lại mật khẩu').fill(SETUP_PW);
    await fresh.page
      .getByRole('button', { name: 'Hoàn tất thiết lập' })
      .click();
    await expect(
      fresh.page.getByRole('heading', { name: 'Hoàn tất' }),
    ).toBeVisible();

    // KHÔNG tự đăng nhập: không có token phiên nào được lưu.
    const tokens = await readStoredTokens(fresh.page);
    expect(tokens.local.concat(tokens.session).filter(Boolean)).toHaveLength(0);
    // Token không lọt console.
    expect(fresh.consoleText()).not.toContain(token);
    await fresh.close();

    // Đăng nhập bằng tài khoản vừa được mời (EDITOR) trong context sạch khác.
    const loginCtx = await browser.newContext();
    const lp = await loginCtx.newPage();
    await uiLogin(lp, invited, SETUP_PW);
    await expectLoggedIn(lp);
    // Vai trò EDITOR: không thấy mục quản trị, vào /tai-khoan bị chặn 403.
    await expect(lp.getByRole('link', { name: 'Tài khoản' })).toHaveCount(0);
    await lp.goto(adminPath('/tai-khoan'));
    await expect(lp).toHaveURL(/\/403$/);

    // Dùng lại link thiết lập cũ (đã dùng) → trạng thái không hợp lệ chung.
    await lp.goto(setupUrl);
    await expect(
      lp.getByRole('heading', { name: 'Link không hợp lệ' }),
    ).toBeVisible();
    await loginCtx.close();
  });

  test('gửi lại lời mời: link cũ vô hiệu, link mới hoạt động', async ({
    page,
    browser,
  }) => {
    await clearOutbox();
    const invited = uniqueE2eEmail('invite-resend');

    await openUserManagementAsSuperAdmin(page);
    await createInvitationViaUI(page, 'Mời Gửi Lại', invited);
    const firstUrl = await captureInvitationUrl(invited);

    // Vượt cooldown gửi-lại 60s bằng cách làm già lời mời (chỉ chỉnh fixture).
    await ageInvitations(invited);
    await clearOutbox();

    // Gửi lại qua UI — chờ phản hồi resend (không dựa vào toast, tránh toast cũ).
    const row = page.getByRole('row').filter({ hasText: invited });
    const resendResp = page.waitForResponse(
      (r) =>
        r.url().includes('/resend-invitation') &&
        r.request().method() === 'POST',
    );
    await row.getByRole('button', { name: 'Gửi lại lời mời' }).click();
    expect((await resendResp).status()).toBeLessThan(400);

    const secondUrl = await captureInvitationUrl(invited);
    expect(secondUrl).not.toBe(firstUrl);

    // Link cũ đã vô hiệu.
    const c1 = await browser.newContext();
    const p1 = await c1.newPage();
    await p1.goto(firstUrl);
    await expect(
      p1.getByRole('heading', { name: 'Link không hợp lệ' }),
    ).toBeVisible();
    await c1.close();

    // Link mới còn hiệu lực (hiện form thiết lập).
    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await p2.goto(secondUrl);
    await expect(
      p2.getByRole('heading', { name: 'Thiết lập tài khoản' }),
    ).toBeVisible();
    await c2.close();
  });

  test('thu hồi lời mời: link bị vô hiệu', async ({ page, browser }) => {
    await clearOutbox();
    const invited = uniqueE2eEmail('invite-revoke');

    await openUserManagementAsSuperAdmin(page);
    await createInvitationViaUI(page, 'Mời Thu Hồi', invited);
    const url = await captureInvitationUrl(invited);

    // Thu hồi qua UI (mở dialog xác nhận rồi bấm "Thu hồi lời mời").
    const row = page.getByRole('row').filter({ hasText: invited });
    await row.getByRole('button', { name: 'Thu hồi' }).click();
    const revokeResp = page.waitForResponse(
      (r) =>
        r.url().includes('/revoke-invitation') &&
        r.request().method() === 'POST',
    );
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Thu hồi lời mời' })
      .click();
    expect((await revokeResp).status()).toBeLessThan(400);

    // Link đã thu hồi → không hợp lệ.
    const c = await browser.newContext();
    const p = await c.newPage();
    await p.goto(url);
    await expect(
      p.getByRole('heading', { name: 'Link không hợp lệ' }),
    ).toBeVisible();
    await c.close();
  });

  test('phân quyền: ADMIN không tạo/gửi lại/thu hồi lời mời được', async ({
    page,
  }) => {
    // UI: ADMIN xem được danh sách nhưng KHÔNG có nút "Thêm tài khoản".
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expectLoggedIn(page);
    await page.goto(adminPath('/tai-khoan'));
    await expect(
      page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Thêm tài khoản' }),
    ).toHaveCount(0);

    // API: token ADMIN gọi thẳng các endpoint lời mời → 403.
    const login = await apiLogin(seed.admin.email, seed.admin.password);
    const adminToken = login.body!.data!.accessToken;
    const create = await authedPost('/users/invitations', adminToken, {
      name: 'X',
      email: uniqueE2eEmail('invite-admin-denied'),
      role: 'EDITOR',
    });
    expect(create.status).toBe(403);
    const resend = await authedPost(
      '/users/non-existent-id/resend-invitation',
      adminToken,
    );
    expect(resend.status).toBe(403);
    const revoke = await authedPost(
      '/users/non-existent-id/revoke-invitation',
      adminToken,
    );
    expect(revoke.status).toBe(403);
  });

  test('phân quyền: EDITOR bị chặn khỏi quản lý tài khoản (UI + API)', async ({
    page,
  }) => {
    const editor = uniqueE2eEmail('invite-editor');
    await upsertTestUser({
      email: editor,
      role: 'EDITOR',
      isActive: true,
      setupCompleted: true,
      password: SETUP_PW,
    });

    // UI: EDITOR vào /tai-khoan bị đẩy sang 403.
    await uiLogin(page, editor, SETUP_PW);
    await expectLoggedIn(page);
    await page.goto(adminPath('/tai-khoan'));
    await expect(page).toHaveURL(/\/403$/);

    // API: token EDITOR gọi endpoint lời mời → 403.
    const login = await apiLogin(editor, SETUP_PW);
    const editorToken = login.body!.data!.accessToken;
    const create = await authedPost('/users/invitations', editorToken, {
      name: 'X',
      email: uniqueE2eEmail('invite-editor-denied'),
      role: 'EDITOR',
    });
    expect(create.status).toBe(403);
  });
});
