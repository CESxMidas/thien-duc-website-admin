import { expect, type Page } from '@playwright/test';
import { adminPath } from './config';

/** Khóa lưu token của Admin (khớp src/lib/api/client.ts). */
export const ACCESS_TOKEN_KEY = 'td_admin_access_token';
export const REFRESH_TOKEN_KEY = 'td_admin_refresh_token';

export async function gotoLogin(page: Page): Promise<void> {
  await page.goto(adminPath('/dang-nhap'));
  await expect(
    page.getByRole('heading', { name: 'Đăng nhập hệ thống quản trị' }),
  ).toBeVisible();
}

/** Đăng nhập qua UI. Không assert kết quả — caller tự kiểm (thành công/thất bại). */
export async function uiLogin(
  page: Page,
  email: string,
  password: string,
  opts: { remember?: boolean } = {},
): Promise<void> {
  await gotoLogin(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  if (opts.remember === false) {
    await page.getByLabel('Ghi nhớ đăng nhập').uncheck();
  }
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
}

/** Đăng nhập thành công → tới khu vực bảo vệ (thấy điều hướng "Tổng quan"). */
export async function expectLoggedIn(page: Page): Promise<void> {
  await expect(page.getByRole('link', { name: 'Tổng quan' })).toBeVisible();
}

/** Đọc token đang lưu ở cả localStorage lẫn sessionStorage (để kiểm rò rỉ). */
export async function readStoredTokens(page: Page): Promise<{
  local: (string | null)[];
  session: (string | null)[];
}> {
  return page.evaluate(
    ({ a, r }) => ({
      local: [localStorage.getItem(a), localStorage.getItem(r)],
      session: [sessionStorage.getItem(a), sessionStorage.getItem(r)],
    }),
    { a: ACCESS_TOKEN_KEY, r: REFRESH_TOKEN_KEY },
  );
}
