import { test, expect, type Page } from '@playwright/test';
import { seedAccounts, uniqueE2eEmail } from '../helpers/config';
import {
  apiLogin,
  authedDelete,
  authedGet,
  authedPatch,
  authedPost,
  deleteTestUsers,
  getTestUser,
  upsertTestUser,
  type TestUserDiagnostics,
} from '../helpers/api';
import { expectLoggedIn, uiLogin } from '../helpers/auth';

const seed = seedAccounts();
const FIXTURE_PW = `E2eUms!${Math.random().toString(36).slice(2, 10)}`;

// Fixtures (mỗi trạng thái một tài khoản riêng).
const pendingUser = uniqueE2eEmail('ums-pending');
const activeUser = uniqueE2eEmail('ums-active');
const disabledUser = uniqueE2eEmail('ums-disabled');
const disabledPendingUser = uniqueE2eEmail('ums-disabled-pending');
const editorUser = uniqueE2eEmail('ums-editor');

let superToken = '';
let adminToken = '';
let editorToken = '';
let superAdminId = '';
let activeUserId = '';
let seedSuperBefore: TestUserDiagnostics | null = null;

const FORBIDDEN_KEYS = [
  'password',
  'passwordHash',
  'setupCompletedAt',
  'failedLoginAttempts',
  'lockedUntil',
  'token',
  'tokenHash',
  'refreshToken',
];

test.beforeAll(async () => {
  await upsertTestUser({
    email: pendingUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: false,
  });
  const active = await upsertTestUser({
    email: activeUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: true,
    password: FIXTURE_PW,
  });
  activeUserId = active.id;
  await upsertTestUser({
    email: disabledUser,
    role: 'ADMIN',
    isActive: false,
    setupCompleted: true,
    password: FIXTURE_PW,
  });
  await upsertTestUser({
    email: disabledPendingUser,
    role: 'EDITOR',
    isActive: false,
    setupCompleted: false,
  });
  await upsertTestUser({
    email: editorUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: true,
    password: FIXTURE_PW,
  });

  superToken = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password))
    .body!.data!.accessToken;
  adminToken = (await apiLogin(seed.admin.email, seed.admin.password)).body!
    .data!.accessToken;
  editorToken = (await apiLogin(editorUser, FIXTURE_PW)).body!.data!
    .accessToken;

  const superDiag = await getTestUser(seed.superAdmin.email);
  superAdminId = superDiag!.id;
  seedSuperBefore = superDiag;
});

test.afterAll(async () => {
  await deleteTestUsers();
});

async function openUserList(page: Page): Promise<void> {
  await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
  await expectLoggedIn(page);
  await page.goto('/tai-khoan');
  await expect(
    page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
  ).toBeVisible();
}

test.describe('§9 — Bảo mật quản lý tài khoản', () => {
  // ---------------- Mục 1 + 2: UI không có ô mật khẩu ----------------
  test('form tạo tài khoản KHÔNG có ô mật khẩu (chỉ tên/email/vai trò)', async ({
    page,
  }) => {
    await openUserList(page);
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/mật khẩu/i)).toHaveCount(0);
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    await expect(dialog.getByLabel('Họ tên')).toBeVisible();
    await expect(dialog.getByLabel('Email')).toBeVisible();
    // "Vai trò" là shadcn Select (không gắn label chuẩn) → kiểm nhãn dạng text.
    await expect(dialog.getByText('Vai trò', { exact: true })).toBeVisible();
  });

  test('form sửa tài khoản KHÔNG có ô mật khẩu; sửa tên hoạt động', async ({
    page,
  }) => {
    await openUserList(page);
    const row = page.getByRole('row').filter({ hasText: activeUser });
    await row.getByRole('button', { name: 'Sửa' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel(/mật khẩu/i)).toHaveCount(0);
    await expect(dialog.locator('input[type="password"]')).toHaveCount(0);
    // Field sửa được hoạt động: đổi tên.
    const newName = 'Đã Sửa E2E';
    await dialog.getByLabel('Họ tên').fill(newName);
    const patchResp = page.waitForResponse(
      (r) =>
        r.url().includes(`/users/${activeUserId}`) &&
        r.request().method() === 'PATCH',
    );
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    expect((await patchResp).status()).toBeLessThan(400);
    await expect(
      page.getByRole('row').filter({ hasText: activeUser }),
    ).toContainText(newName);
  });

  // ---------------- Mục 3: payload mạng không có field cấm ----------------
  test('payload tạo lời mời không chứa field nhạy cảm', async ({ page }) => {
    await openUserList(page);
    await page.getByRole('button', { name: 'Thêm tài khoản' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Họ tên').fill('Payload Check');
    await dialog.getByLabel('Email').fill(uniqueE2eEmail('ums-payload'));
    const resp = page.waitForResponse(
      (r) =>
        r.url().includes('/users/invitations') &&
        r.request().method() === 'POST',
    );
    await dialog
      .getByRole('button', { name: 'Tạo tài khoản và gửi lời mời' })
      .click();
    const payload = ((await resp).request().postDataJSON() ?? {}) as Record<
      string,
      unknown
    >;
    for (const key of FORBIDDEN_KEYS) {
      expect(Object.keys(payload)).not.toContain(key);
    }
    expect(Object.keys(payload).sort()).toEqual(['email', 'name', 'role']);
  });

  test('payload cập nhật tài khoản không chứa field nhạy cảm', async ({
    page,
  }) => {
    await openUserList(page);
    const row = page.getByRole('row').filter({ hasText: activeUser });
    await row.getByRole('button', { name: 'Sửa' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Họ tên').fill('Payload Update E2E');
    const resp = page.waitForResponse(
      (r) =>
        r.url().includes(`/users/${activeUserId}`) &&
        r.request().method() === 'PATCH',
    );
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    const payload = ((await resp).request().postDataJSON() ?? {}) as Record<
      string,
      unknown
    >;
    for (const key of FORBIDDEN_KEYS) {
      expect(Object.keys(payload)).not.toContain(key);
    }
  });

  // ---------------- Mục 4: backend từ chối mass-assignment ----------------
  test('API từ chối field cấm khi cập nhật (400) và leo thang quyền (403)', async () => {
    // SUPER_ADMIN gửi field cấm → 400 (ValidationPipe whitelist).
    for (const bad of [
      { password: 'HackedPass123' },
      { passwordHash: 'x'.repeat(20) },
      { setupCompletedAt: new Date().toISOString() },
      { failedLoginAttempts: 0 },
      { lockedUntil: null },
    ]) {
      const res = await authedPatch(
        `/users/${activeUserId}`,
        superToken,
        bad,
      );
      expect(res.status, `field cấm ${Object.keys(bad)[0]}`).toBe(400);
    }
    // Tạo lời mời kèm field cấm → 400.
    const inviteBad = await authedPost('/users/invitations', superToken, {
      name: 'X',
      email: uniqueE2eEmail('ums-invite-bad'),
      role: 'EDITOR',
      password: 'ShouldReject123',
    });
    expect(inviteBad.status).toBe(400);
    const inviteBad2 = await authedPost('/users/invitations', superToken, {
      name: 'X',
      email: uniqueE2eEmail('ums-invite-bad2'),
      role: 'EDITOR',
      passwordHash: 'x'.repeat(20),
    });
    expect(inviteBad2.status).toBe(400);

    // ADMIN (không đủ quyền) cố leo thang: đổi vai trò người khác → 403.
    const escalate = await authedPatch(`/users/${activeUserId}`, adminToken, {
      role: 'SUPER_ADMIN',
    });
    expect(escalate.status).toBe(403);
  });

  // ---------------- Mục 5: hiển thị trạng thái ----------------
  test('nhãn trạng thái + hành động đúng theo pending/active/disabled', async ({
    page,
  }) => {
    await openUserList(page);

    const pending = page.getByRole('row').filter({ hasText: pendingUser });
    await expect(pending.getByText('Chờ thiết lập')).toBeVisible();
    await expect(
      pending.getByRole('button', { name: 'Gửi lại lời mời' }),
    ).toBeVisible();
    await expect(
      pending.getByRole('button', { name: 'Khóa', exact: true }),
    ).toHaveCount(0);

    const active = page.getByRole('row').filter({ hasText: activeUser });
    await expect(active.getByText('Đang hoạt động')).toBeVisible();
    await expect(
      active.getByRole('button', { name: 'Khóa', exact: true }),
    ).toBeVisible();
    await expect(
      active.getByRole('button', { name: 'Gửi lại lời mời' }),
    ).toHaveCount(0);

    const disabled = page.getByRole('row').filter({ hasText: disabledUser });
    await expect(disabled.getByText('Đã vô hiệu hóa')).toBeVisible();
    await expect(
      disabled.getByRole('button', { name: 'Mở khóa' }),
    ).toBeVisible();
    await expect(
      disabled.getByRole('button', { name: 'Gửi lại lời mời' }),
    ).toHaveCount(0);

    // Vô hiệu hóa ƯU TIÊN hơn chờ thiết lập.
    const dp = page.getByRole('row').filter({ hasText: disabledPendingUser });
    await expect(dp.getByText('Đã vô hiệu hóa')).toBeVisible();
    await expect(dp.getByText('Chờ thiết lập')).toHaveCount(0);
  });

  // ---------------- Mục 7: ADMIN bị hạn chế ----------------
  test('ADMIN: không có nút quản lý trên UI + API trả 403', async ({ page }) => {
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await expect(
      page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
    ).toBeVisible();
    // Không có nút thêm / không có nút thao tác từng hàng.
    await expect(
      page.getByRole('button', { name: 'Thêm tài khoản' }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Sửa' })).toHaveCount(0);

    // API: mọi thao tác quản trị người dùng → 403.
    expect(
      (
        await authedPost('/users/invitations', adminToken, {
          name: 'X',
          email: uniqueE2eEmail('ums-admin-denied'),
          role: 'EDITOR',
        })
      ).status,
    ).toBe(403);
    expect(
      (await authedPost(`/users/${activeUserId}/resend-invitation`, adminToken))
        .status,
    ).toBe(403);
    expect(
      (await authedPost(`/users/${activeUserId}/revoke-invitation`, adminToken))
        .status,
    ).toBe(403);
    expect(
      (await authedPatch(`/users/${activeUserId}`, adminToken, { name: 'X' }))
        .status,
    ).toBe(403);
    expect(
      (await authedDelete(`/users/${activeUserId}`, adminToken)).status,
    ).toBe(403);
  });

  // ---------------- Mục 8: EDITOR bị chặn ----------------
  test('EDITOR: chặn UI (403) + API user-management trả 403', async ({
    page,
  }) => {
    await uiLogin(page, editorUser, FIXTURE_PW);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await expect(page).toHaveURL(/\/403$/);

    expect((await authedGet('/users', editorToken)).status).toBe(403);
    expect(
      (
        await authedPost('/users/invitations', editorToken, {
          name: 'X',
          email: uniqueE2eEmail('ums-editor-denied'),
          role: 'EDITOR',
        })
      ).status,
    ).toBe(403);
    expect(
      (await authedPatch(`/users/${activeUserId}`, editorToken, { name: 'X' }))
        .status,
    ).toBe(403);
  });

  // ---------------- Mục 9: bảo vệ route ----------------
  test('route bảo vệ: đăng xuất + back không lộ nội dung quản trị', async ({
    page,
  }) => {
    // Chưa đăng nhập → chuyển hướng.
    await page.goto('/tai-khoan');
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // Đăng nhập, mở danh sách, rồi đăng xuất.
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto('/tai-khoan');
    await expect(
      page.getByRole('row').filter({ hasText: activeUser }),
    ).toBeVisible();
    await page.locator('button[aria-haspopup="true"]').click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // Back sau khi đăng xuất KHÔNG để lộ nội dung được bảo vệ (bảng tài khoản).
    await page.goBack();
    await expect(
      page.getByRole('row').filter({ hasText: activeUser }),
    ).toHaveCount(0);
    // Điều hướng thẳng lại route bảo vệ khi đã đăng xuất → bị đẩy về đăng nhập.
    await page.goto('/tai-khoan');
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  // ---------------- Mục 10: quyền riêng tư response ----------------
  test('response GET /users và /users/:id không lộ hash/token/mật khẩu', async () => {
    const list = await authedGet('/users', superToken);
    expect(list.status).toBe(200);
    const listRaw = JSON.stringify(list.body);
    for (const s of ['passwordHash', 'password', 'tokenHash', 'token']) {
      expect(listRaw).not.toContain(s);
    }
    const detail = await authedGet(`/users/${activeUserId}`, superToken);
    expect(detail.status).toBe(200);
    const detailKeys = Object.keys(
      (detail.body as { data: Record<string, unknown> }).data,
    );
    for (const bad of ['passwordHash', 'password', 'tokenHash']) {
      expect(detailKeys).not.toContain(bad);
    }
  });

  // ---------------- Mục 11: bảo vệ Super Admin cuối ----------------
  test('SUPER_ADMIN không thể tự hạ quyền / tự khóa / tự xóa (400)', async () => {
    const selfDemote = await authedPatch(`/users/${superAdminId}`, superToken, {
      role: 'EDITOR',
    });
    expect(selfDemote.status).toBe(400);
    const selfDisable = await authedPatch(`/users/${superAdminId}`, superToken, {
      isActive: false,
    });
    expect(selfDisable.status).toBe(400);
    const selfDelete = await authedDelete(`/users/${superAdminId}`, superToken);
    expect(selfDelete.status).toBe(400);

    // Seed Super Admin KHÔNG bị thay đổi bởi các lần bị từ chối.
    const after = await getTestUser(seed.superAdmin.email);
    expect(after!.role).toBe('SUPER_ADMIN');
    expect(after!.isActive).toBe(true);
  });

  test('hạ quyền Super Admin KHÔNG-phải-cuối được phép (rule không chặn nhầm)', async () => {
    // Tạo một SUPER_ADMIN fixture: khi đó vẫn còn seed super admin → không phải cuối.
    const extra = uniqueE2eEmail('ums-extra-super');
    const created = await upsertTestUser({
      email: extra,
      role: 'SUPER_ADMIN',
      isActive: true,
      setupCompleted: true,
      password: FIXTURE_PW,
    });
    const demote = await authedPatch(`/users/${created.id}`, superToken, {
      role: 'EDITOR',
    });
    expect(demote.status).toBeLessThan(400);
    const after = await getTestUser(extra);
    expect(after!.role).toBe('EDITOR');
  });

  // ---------------- Mục 12: toàn vẹn trạng thái ----------------
  test('cập nhật hồ sơ KHÔNG đổi passwordHash / setupCompletedAt / lời mời', async () => {
    const before = await getTestUser(activeUser);
    const patch = await authedPatch(`/users/${activeUserId}`, superToken, {
      name: 'Toàn Vẹn E2E',
    });
    expect(patch.status).toBeLessThan(400);
    const after = await getTestUser(activeUser);
    expect(after!.passwordHashFingerprint).toBe(
      before!.passwordHashFingerprint,
    );
    expect(after!.setupCompletedAt).toBe(before!.setupCompletedAt);
    expect(after!.invitationCount).toBe(before!.invitationCount);
    expect(after!.activeInvitationCount).toBe(before!.activeInvitationCount);
    expect(after!.failedLoginAttempts).toBe(before!.failedLoginAttempts);
    expect(after!.locked).toBe(before!.locked);
  });

  test('đổi vai trò thu hồi phiên đăng nhập (hành vi có chủ đích)', async () => {
    const target = uniqueE2eEmail('ums-role-revoke');
    const created = await upsertTestUser({
      email: target,
      role: 'EDITOR',
      isActive: true,
      setupCompleted: true,
      password: FIXTURE_PW,
    });
    // Tạo một phiên (refresh token) cho tài khoản này.
    await apiLogin(target, FIXTURE_PW);
    expect((await getTestUser(target))!.refreshTokenCount).toBeGreaterThan(0);
    // Đổi vai trò → backend thu hồi mọi phiên.
    const patch = await authedPatch(`/users/${created.id}`, superToken, {
      role: 'ADMIN',
    });
    expect(patch.status).toBeLessThan(400);
    expect((await getTestUser(target))!.refreshTokenCount).toBe(0);
  });

  // ---------------- Mục 13: seed nguyên vẹn ----------------
  test('seed Super Admin không đổi passwordHash/setup sau toàn bộ thao tác', async () => {
    const now = await getTestUser(seed.superAdmin.email);
    expect(now!.passwordHashFingerprint).toBe(
      seedSuperBefore!.passwordHashFingerprint,
    );
    expect(now!.setupCompletedAt).toBe(seedSuperBefore!.setupCompletedAt);
    expect(now!.role).toBe('SUPER_ADMIN');
    expect(now!.isActive).toBe(true);
  });
});
