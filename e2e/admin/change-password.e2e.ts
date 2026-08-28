import { test, expect } from '@playwright/test';
import { adminPath, uniqueE2eEmail } from '../helpers/config';
import { apiLogin, deleteTestUsers, getTestUser, upsertTestUser } from '../helpers/api';
import { expectLoggedIn, uiLogin } from '../helpers/auth';

/**
 * CMS-AUTH-CHANGE-PASSWORD — người ĐANG ĐĂNG NHẬP tự đổi mật khẩu.
 *
 * AN TOÀN TRẠNG THÁI: bộ này KHÔNG bao giờ đụng tài khoản seed dùng chung
 * (`seedAccounts()`), vì đổi mật khẩu của chúng sẽ làm hỏng mọi bộ test chạy
 * sau. Mỗi lần chạy tự dựng một tài khoản fixture riêng với email duy nhất
 * (`uniqueE2eEmail` → miền `@e2e.test`) rồi xoá sạch ở `afterAll` bằng
 * `deleteTestUsers()`. Nhờ vậy việc "khôi phục trạng thái" là tất định, không
 * phụ thuộc test có pass hay không.
 *
 * Ba điều bộ này khoá — đều là thứ unit test KHÔNG chứng minh được:
 *   1. đổi xong bị đá về ĐÚNG `/admin/dang-nhap` (giữ tiền tố base — Batch 15B);
 *   2. mật khẩu CŨ hết đăng nhập được, mật khẩu MỚI đăng nhập được (tức hash
 *      trong DB thật sự đổi, không chỉ API trả 200);
 *   3. sai mật khẩu hiện tại KHÔNG đăng xuất người dùng.
 */

const fixtureEmail = uniqueE2eEmail('change-pw');
const OLD_PW = `E2eOld!${Math.random().toString(36).slice(2, 10)}`;
const NEW_PW = `E2eNew!${Math.random().toString(36).slice(2, 10)}`;

/** Đưa fixture về đúng mật khẩu CŨ — chạy trước mỗi test để các test độc lập. */
async function resetFixture() {
  await upsertTestUser({
    email: fixtureEmail,
    role: 'ADMIN',
    isActive: true,
    setupCompleted: true,
    password: OLD_PW,
  });
}

test.beforeEach(async () => {
  await resetFixture();
});

test.afterAll(async () => {
  // Dọn mọi tài khoản @e2e.test — trạng thái DB trở lại như trước khi chạy.
  await deleteTestUsers();
});

test('đổi mật khẩu thành công: về /admin/dang-nhap, mật khẩu cũ chết, mật khẩu mới sống', async ({
  page,
}) => {
  const before = await getTestUser(fixtureEmail);
  expect(before).not.toBeNull();

  await uiLogin(page, fixtureEmail, OLD_PW);
  await expectLoggedIn(page);

  await page.goto(adminPath('/ho-so'));
  // `CardTitle` của hệ thiết kế là <div>, KHÔNG phải thẻ heading — dùng
  // getByRole('heading') sẽ không bao giờ khớp.
  await expect(page.getByText('Bảo mật')).toBeVisible();

  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

  // Thu hẹp vào trong hộp thoại: sau khi mở có HAI nút cùng tên (nút trên thẻ
  // Bảo mật và nút gửi trong footer). Dựa vào .last() là dựa vào thứ tự portal
  // trong DOM — mong manh; scope theo role=dialog thì rõ nghĩa và bền hơn.
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Mật khẩu hiện tại', { exact: true }).fill(OLD_PW);
  await dialog.getByLabel('Mật khẩu mới', { exact: true }).fill(NEW_PW);
  await dialog.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(NEW_PW);
  await dialog.getByRole('button', { name: 'Đổi mật khẩu' }).click();

  // 1. Bị đá về trang đăng nhập, GIỮ tiền tố /admin.
  await page.waitForURL(`**${adminPath('/dang-nhap')}`);
  expect(new URL(page.url()).pathname).toBe(adminPath('/dang-nhap'));

  // Token phía client đã bị dọn sạch ở CẢ hai kiểu lưu.
  const tokens = await page.evaluate(() => ({
    local: localStorage.getItem('td_admin_access_token'),
    session: sessionStorage.getItem('td_admin_access_token'),
  }));
  expect(tokens.local).toBeNull();
  expect(tokens.session).toBeNull();

  // 2. Hash trong DB thật sự đổi (so vân tay sha256, không lộ hash).
  const after = await getTestUser(fixtureEmail);
  expect(after?.passwordHashFingerprint).not.toBe(
    before?.passwordHashFingerprint,
  );

  // 3. Mật khẩu CŨ không đăng nhập được nữa; mật khẩu MỚI thì được.
  const oldLogin = await apiLogin(fixtureEmail, OLD_PW);
  expect(oldLogin.status).toBe(401);

  const newLogin = await apiLogin(fixtureEmail, NEW_PW);
  expect(newLogin.status).toBe(201);
  expect(newLogin.body?.data?.accessToken).toBeTruthy();
});

test('sai mật khẩu hiện tại: báo lỗi, KHÔNG đăng xuất, mật khẩu giữ nguyên', async ({
  page,
}) => {
  const before = await getTestUser(fixtureEmail);

  await uiLogin(page, fixtureEmail, OLD_PW);
  await expectLoggedIn(page);

  await page.goto(adminPath('/ho-so'));
  await page.getByRole('button', { name: 'Đổi mật khẩu' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Mật khẩu hiện tại', { exact: true }).fill('SaiHoanToan!123');
  await dialog.getByLabel('Mật khẩu mới', { exact: true }).fill(NEW_PW);
  await dialog.getByLabel('Xác nhận mật khẩu mới', { exact: true }).fill(NEW_PW);
  await dialog.getByRole('button', { name: 'Đổi mật khẩu' }).click();

  await expect(page.getByText('Mật khẩu hiện tại không đúng.')).toBeVisible();

  // Vẫn ở trang hồ sơ, KHÔNG bị đá về đăng nhập (400 không chạm nhánh 401).
  expect(new URL(page.url()).pathname).toBe(adminPath('/ho-so'));

  // Hộp thoại vẫn mở để nhập lại (không tự đóng khi lỗi).
  await expect(dialog).toBeVisible();

  // Bằng chứng "chưa bị đăng xuất" là TOKEN CÒN NGUYÊN, chứ không phải nhìn
  // thấy thanh điều hướng: Radix đặt aria-hidden lên toàn bộ nền khi modal
  // đang mở, nên mọi truy vấn theo role ở nền đều không khớp.
  const tokensAfterError = await page.evaluate(() => ({
    local: localStorage.getItem('td_admin_access_token'),
    session: sessionStorage.getItem('td_admin_access_token'),
  }));
  expect(tokensAfterError.local ?? tokensAfterError.session).toBeTruthy();

  // Mật khẩu trong DB không đổi, mật khẩu cũ vẫn dùng được.
  const after = await getTestUser(fixtureEmail);
  expect(after?.passwordHashFingerprint).toBe(before?.passwordHashFingerprint);

  const stillWorks = await apiLogin(fixtureEmail, OLD_PW);
  expect(stillWorks.status).toBe(201);
});
