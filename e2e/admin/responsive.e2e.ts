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
/** Bai viet fixture cho kiem tra responsive trang chi tiet tin tuc. */
const newsSlug = `rwd-news-${Date.now().toString(36)}`;

/**
 * TAT CA 8 viewport theo yeu cau AUDIT-M2 (M1 chi phu 3 viewport in dam).
 * Bien do 320 -> 1440 phu: dien thoai nho nhat con dung (iPhone SE),
 * Android pho thong, iPhone hien dai, tablet doc/ngang, laptop va desktop rong.
 */
const VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '1440x900', width: 1440, height: 900 },
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

  // SUPER_ADMIN tao bai la PUBLISHED ngay -> co ngay mot trang chi tiet that de
  // do responsive, khong phu thuoc du lieu con sot cua spec khac.
  const created = await authedPost('/news', superToken, {
    slug: newsSlug,
    title: {
      vi: 'Bai kiem tra responsive voi tieu de tieng Viet kha dai de thu ngat dong',
      en: 'Responsive fixture article with a fairly long English headline for wrapping',
    },
    summary: {
      vi: 'Tom tat tieng Viet dung de kiem tra bo cuc tren mọi be rong man hinh.',
      en: 'Vietnamese/English summary used to check layout across all viewports.',
    },
    content: [
      {
        vi: 'Doan noi dung dai de kiem tra chieu rong khoi van ban tren man hinh nho nhat 320px cung nhu man hinh rong 1440px.',
        en: 'A long paragraph to check text block width from the smallest 320px screen up to a wide 1440px screen.',
      },
    ],
  });
  expect(created.status, 'gieo bai viet fixture').toBe(201);
});

test.afterAll(async () => {
  await deleteTestUsers();
  // Doc fixture bai viet cua chinh spec nay.
  const token = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password))
    .body!.data!.accessToken;
  await fetch(`${API_URL}/news/${newsSlug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
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
      //
      // Nhánh phải theo **layoutWidth** (`documentElement.clientWidth`), KHÔNG
      // theo bề rộng viewport của Playwright: viewport 1024 còn tính cả thanh
      // cuộn (~15px), nên media query `lg:` (min-width 1024px) của Tailwind KHÔNG
      // khớp và sidebar vẫn ở chế độ mobile. Dùng con số CSS thật sự thấy.
      const layoutWidth = await page.evaluate(
        () => document.documentElement.clientWidth,
      );
      if (layoutWidth >= 1024) {
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

    // AUDIT-M2: các route công khai còn lại (tin tức list/chi tiết, dự án
    // list/chi tiết/hạng mục, gioi-thieu, cong-ty-thanh-vien).
    test('Frontend: tin tức + dự án + giới thiệu + công ty thành viên không tràn ngang', async ({
      page,
    }) => {
      const visit = async (path: string, label: string) => {
        await page.goto(`${FRONTEND_URL}${path}`, {
          timeout: 60_000,
          waitUntil: 'domcontentloaded',
        });
        await expectNoHorizontalOverflow(page, `${label}-${vp.name}`);
      };

      await visit('/tin-tuc', 'news-list');
      // Bài chi tiết dùng fixture do chính spec này gieo (xem beforeAll) — không
      // phụ thuộc spec khác đã chạy trước hay chưa.
      await visit(`/tin-tuc/${newsSlug}`, 'news-detail');

      await visit('/du-an', 'projects-list');
      const projects = (await (await fetch(`${API_URL}/projects`)).json()) as {
        data?: Array<{ slug: string; items?: Array<{ slug: string }> }>;
      };
      const firstProject = projects.data?.[0];
      if (firstProject) {
        await visit(`/du-an/${firstProject.slug}`, 'project-detail');
        const firstItem = firstProject.items?.[0];
        if (firstItem) {
          await visit(
            `/du-an/${firstProject.slug}/${firstItem.slug}`,
            'project-item',
          );
        }
      }

      await visit('/gioi-thieu', 'about');
      await visit('/cong-ty-thanh-vien', 'member-companies');
    });

    // AUDIT-M2: các trang CMS chính còn lại + modal form phải nằm gọn viewport.
    test('Admin: tổng quan/tin tức/dự án/banner/liên hệ không tràn ngang, modal form nằm gọn', async ({
      page,
    }) => {
      await uiLogin(page, seed.superAdmin.email, seed.superAdmin.password);
      await expect(page.locator(SESSION_BTN)).toBeVisible();

      const pages: Array<[string, string, string]> = [
        ['/', 'Tổng quan', 'dashboard'],
        ['/tin-tuc', 'Tin tức', 'admin-news'],
        ['/du-an', 'Dự án', 'admin-projects'],
        ['/banner', 'Banner trang chủ', 'admin-banners'],
        ['/lien-he', 'Liên hệ', 'admin-contacts'],
      ];
      for (const [path, heading, label] of pages) {
        await page.goto(path);
        await expect(
          page.getByRole('heading', { name: heading, level: 1 }),
        ).toBeVisible();
        await expectNoHorizontalOverflow(page, `${label}-${vp.name}`);
      }

      // Modal form: hành động chính phải thấy được VÀ dialog nằm trong viewport.
      const forms: Array<[string, string]> = [
        ['/tin-tuc', 'Viết tin'],
        ['/du-an', 'Tạo dự án'],
        ['/banner', 'Thêm banner'],
      ];
      for (const [path, action] of forms) {
        await page.goto(path);
        const trigger = page.getByRole('button', { name: action });
        await expect(trigger).toBeVisible();
        await trigger.click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        const box = await dialog.boundingBox();
        expect(box, `dialog ${action} phải có bounding box`).not.toBeNull();
        // Nằm gọn theo chiều ngang (dung sai 1px như ngưỡng tràn ngang chung).
        expect(box!.x, `${action} @${vp.name}: lề trái`).toBeGreaterThanOrEqual(-1);
        expect(
          box!.x + box!.width,
          `${action} @${vp.name}: lề phải`,
        ).toBeLessThanOrEqual(vp.width + 1);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
        await expectNoHorizontalOverflow(page, `${action}-modal-${vp.name}`);
      }
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
