import { test, expect } from '@playwright/test';
import { adminPath, API_URL, FRONTEND_URL, seedAccounts, uniqueE2eEmail } from '../helpers/config';
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
  await fetch(`${API_URL}/auth/forgot-password`, {
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
    await page.goto(adminPath('/dang-nhap'));
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
    await page.goto(adminPath('/quen-mat-khau'));
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
    await page.goto(adminPath('/tai-khoan'));
    await expect(
      page.getByRole('heading', { name: 'Tài khoản', level: 1 }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'admin-users');
  });

  /**
   * Chốt chặn hồi quy cho ĐÚNG huy hiệu "Đang hoạt động" — vi phạm đã làm CI đỏ.
   *
   * Cặp cũ `text-green-700` / `bg-green-50` chỉ đạt 4.723:1, sát ngưỡng 4.5:1
   * cho chữ 12px; cộng thêm hiệu ứng mờ dần của hàng bảng, axe đo ra 3.86–4.47:1
   * tuỳ lần chạy. Test này đo thẳng token màu (không phụ thuộc thời điểm quét)
   * và đòi biên an toàn 6:1 — cao hơn hẳn mức tối thiểu, để lần sau ai đổi màu
   * về mức "vừa đủ đậu" là đỏ ngay.
   */
  test('Admin: huy hiệu "Đang hoạt động" đạt tương phản dư biên (hồi quy)', async ({
    page,
  }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto(adminPath('/tai-khoan'));
    // Chọn ĐÚNG phần tử huy hiệu (`data-slot="badge"`), không phải ô chứa nó.
    const badge = page
      .locator('[data-slot="badge"]', { hasText: 'Đang hoạt động' })
      .first();
    await expect(badge).toBeVisible();

    const measured = await badge.evaluate((el) => {
      const parse = (value: string): [number, number, number] => {
        const nums = value.match(/[\d.]+/g) ?? [];
        return [Number(nums[0]), Number(nums[1]), Number(nums[2])];
      };
      const luminance = ([r, g, b]: [number, number, number]) => {
        const channel = (v: number) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return (
          0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
        );
      };
      const ratio = (a: string, b: string) => {
        const [hi, lo] = [luminance(parse(a)), luminance(parse(b))].sort(
          (x, y) => y - x,
        );
        return (hi + 0.05) / (lo + 0.05);
      };
      /** Nền hiển thị thực: đi ngược lên tổ tiên tới màu đầu tiên không trong suốt. */
      const opaqueBackground = (node: Element | null): string => {
        let cursor: Element | null = node;
        while (cursor) {
          const bg = getComputedStyle(cursor).backgroundColor;
          const alpha = bg.startsWith('rgba') ? Number(bg.match(/[\d.]+/g)![3]) : 1;
          if (alpha > 0) return bg;
          cursor = cursor.parentElement;
        }
        return 'rgb(255, 255, 255)';
      };

      const style = getComputedStyle(el);
      const surface = opaqueBackground(el);
      const pageSurface = opaqueBackground(el.parentElement);
      return {
        classes: el.className,
        color: style.color,
        background: surface,
        borderColor: style.borderTopColor,
        fontSizePx: parseFloat(style.fontSize),
        // Huy hiệu là nhãn tĩnh: không được có transition màu (nguồn gây nội suy).
        transitionDuration: style.transitionDuration,
        runningAnimations: el.getAnimations().length,
        textRatio: ratio(style.color, surface),
        borderVsSurfaceRatio: ratio(style.borderTopColor, surface),
        borderVsPageRatio: ratio(style.borderTopColor, pageSurface),
      };
    });

    // Chữ 12px → WCAG AA đòi 4.5:1. Đòi 6:1 để có biên, không "vừa đủ đậu".
    expect(
      measured.textRatio,
      `tương phản chữ huy hiệu "Đang hoạt động" = ${measured.textRatio.toFixed(3)}:1 ` +
        `(chữ ${measured.color} trên nền ${measured.background}, cỡ ${measured.fontSizePx}px)`,
    ).toBeGreaterThanOrEqual(6);

    // Viền là thành phần phi văn bản → WCAG 1.4.11 đòi 3:1, kiểm cả với nền
    // huy hiệu lẫn nền trang phía sau để đường viền thực sự nhìn thấy được.
    expect(
      measured.borderVsSurfaceRatio,
      `viền/nền huy hiệu = ${measured.borderVsSurfaceRatio.toFixed(3)}:1 (viền ${measured.borderColor})`,
    ).toBeGreaterThanOrEqual(3);
    expect(
      measured.borderVsPageRatio,
      `viền/nền trang = ${measured.borderVsPageRatio.toFixed(3)}:1`,
    ).toBeGreaterThanOrEqual(3);

    // Không tăng cỡ chữ để né ngưỡng: huy hiệu vẫn là chữ nhỏ (< 18.66px).
    expect(measured.fontSizePx).toBeLessThan(18.66);

    // Không còn `transition-colors` trên huy hiệu tĩnh → không có khoảng thời
    // gian màu bị nội suy để axe đo trúng.
    expect(
      measured.transitionDuration,
      `huy hiệu vẫn còn transition (${measured.transitionDuration}) — màu sẽ bị nội suy`,
    ).toBe('0s');
  });

  test('Admin: modal thêm tài khoản bẫy focus + Escape đóng', async ({
    page,
  }) => {
    await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
    await expectLoggedIn(page);
    await page.goto(adminPath('/tai-khoan'));
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
