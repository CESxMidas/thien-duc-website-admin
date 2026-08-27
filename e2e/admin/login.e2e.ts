import { test, expect } from '@playwright/test';
import { adminPath, seedAccounts, uniqueE2eEmail } from '../helpers/config';
import { deleteTestUsers, upsertTestUser } from '../helpers/api';
import {
  expectLoggedIn,
  gotoLogin,
  readStoredTokens,
  uiLogin,
} from '../helpers/auth';

// Mật khẩu fixture cho lần chạy này — KHÔNG commit, KHÔNG in ra.
const FIXTURE_PW = `E2eFixture!${Math.random().toString(36).slice(2, 10)}`;
const seed = seedAccounts();

const pendingUser = uniqueE2eEmail('pending');
const inactiveUser = uniqueE2eEmail('inactive');
const editorUser = uniqueE2eEmail('editor');

test.beforeAll(async () => {
  await upsertTestUser({
    email: pendingUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: false,
  });
  await upsertTestUser({
    email: inactiveUser,
    role: 'ADMIN',
    isActive: false,
    setupCompleted: true,
    password: FIXTURE_PW,
  });
  await upsertTestUser({
    email: editorUser,
    role: 'EDITOR',
    isActive: true,
    setupCompleted: true,
    password: FIXTURE_PW,
  });
});

test.afterAll(async () => {
  await deleteTestUsers();
});

test.describe('Admin — Đăng nhập (mục 6)', () => {
  test('trang đăng nhập hiển thị khi chưa đăng nhập', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập' })).toBeVisible();
  });

  test('KHÔNG có link đăng ký công khai', async ({ page }) => {
    await gotoLogin(page);
    await expect(page.getByRole('link', { name: /đăng ký/i })).toHaveCount(0);
    await expect(
      page.getByText('Vui lòng liên hệ Super Admin'),
    ).toBeVisible();
  });

  test('có link "Quên mật khẩu?" dẫn tới trang quên mật khẩu', async ({
    page,
  }) => {
    await gotoLogin(page);
    const link = page.getByRole('link', { name: 'Quên mật khẩu?' });
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/quen-mat-khau$/);
  });

  test('sai thông tin đăng nhập → báo lỗi an toàn, vẫn ở trang đăng nhập', async ({
    page,
  }) => {
    await uiLogin(page, seed.admin.email, 'SaiMatKhau!123');
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap$/);
    // Mật khẩu bị xóa sau lỗi (không giữ lại trên form).
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
  });

  test('tài khoản chờ thiết lập (pending) KHÔNG đăng nhập được', async ({
    page,
  }) => {
    await uiLogin(page, pendingUser, FIXTURE_PW);
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('tài khoản bị vô hiệu hóa (inactive) KHÔNG đăng nhập được', async ({
    page,
  }) => {
    await uiLogin(page, inactiveUser, FIXTURE_PW);
    await expect(page.locator('[data-sonner-toast]')).toBeVisible();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('ADMIN đăng nhập thành công → vào khu vực bảo vệ', async ({ page }) => {
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expectLoggedIn(page);
    // So theo ĐUÔI, không theo tiền tố: dưới base `/admin`, pathname là
    // `/admin/dang-nhap` — `startsWith('/dang-nhap')` sẽ luôn false và biến
    // khẳng định này thành vô nghĩa (test xanh kể cả khi vẫn kẹt ở trang login).
    await expect(page).toHaveURL((u) => !u.pathname.endsWith('/dang-nhap'));
  });

  test('SUPER_ADMIN đăng nhập thành công', async ({ page }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
  });

  test('phiên đăng nhập được giữ qua reload (ghi nhớ)', async ({ page }) => {
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expectLoggedIn(page);
    await page.reload();
    await expectLoggedIn(page);
  });

  test('đăng xuất xóa token phiên cục bộ', async ({ page }) => {
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expectLoggedIn(page);
    // Mở menu người dùng ở topbar (nút có aria-haspopup) rồi bấm "Đăng xuất".
    await page.locator('button[aria-haspopup="true"]').click();
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
    const tokens = await readStoredTokens(page);
    expect(tokens.local.concat(tokens.session).filter(Boolean)).toHaveLength(0);
  });

  test('route bảo vệ chuyển hướng về đăng nhập khi chưa đăng nhập', async ({
    page,
  }) => {
    await page.goto(adminPath('/tai-khoan'));
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('điều hướng theo vai trò: EDITOR không thấy mục quản trị', async ({
    page,
  }) => {
    await uiLogin(page, editorUser, FIXTURE_PW);
    await expectLoggedIn(page);
    await expect(page.getByRole('link', { name: 'Tài khoản' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Banner' })).toHaveCount(0);
    // Vào thẳng route cấm → bị đẩy sang trang 403.
    await page.goto(adminPath('/tai-khoan'));
    await expect(page).toHaveURL(/\/403$/);
  });

  test('điều hướng theo vai trò: ADMIN thấy mục quản trị', async ({ page }) => {
    await uiLogin(page, seed.admin.email, seed.admin.password);
    await expect(page.getByRole('link', { name: 'Tài khoản' })).toBeVisible();
  });

  test('nút hiện/ẩn mật khẩu hoạt động bằng chuột', async ({ page }) => {
    await gotoLogin(page);
    const pwd = page.getByLabel('Mật khẩu', { exact: true });
    await pwd.fill('secret-abc');
    await expect(pwd).toHaveAttribute('type', 'password');
    await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
    await expect(pwd).toHaveAttribute('type', 'text');
    await page.getByRole('button', { name: 'Ẩn mật khẩu' }).click();
    await expect(pwd).toHaveAttribute('type', 'password');
  });

  test('nút hiện/ẩn mật khẩu hoạt động bằng bàn phím và KHÔNG submit form', async ({
    page,
  }) => {
    await gotoLogin(page);
    const pwd = page.getByLabel('Mật khẩu', { exact: true });
    await pwd.fill('secret-abc');
    const toggle = page.getByRole('button', { name: 'Hiện mật khẩu' });
    await toggle.focus();
    await page.keyboard.press('Enter');
    await expect(pwd).toHaveAttribute('type', 'text');
    await page.keyboard.press('Space');
    await expect(pwd).toHaveAttribute('type', 'password');
    // Không điều hướng đi đâu (form không bị submit ngoài ý muốn).
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('nhấn Enter trong ô mật khẩu submit form đăng nhập', async ({ page }) => {
    await gotoLogin(page);
    await page.getByLabel('Email').fill(seed.admin.email);
    const pwd = page.getByLabel('Mật khẩu', { exact: true });
    await pwd.fill(seed.admin.password);
    await pwd.press('Enter');
    await expectLoggedIn(page);
  });
});
