import { test, expect, type Page } from '@playwright/test';
import { FRONTEND_URL, seedAccounts } from '../helpers/config';
import {
  apiLogin,
  authedDelete,
  authedPatch,
  authedPost,
  publicGet,
} from '../helpers/api';
import { probeDetailRoute } from '../helpers/detail-route-probe';

const seed = seedAccounts();
const stamp = `${Date.now().toString(36)}`;
const newsSlug = `e2e-content-news-${stamp}`;
const NEWS_TITLE = `E2E Tin Tức ${stamp}`;
const BANNER_TITLE = `E2E Banner ${stamp}`;

let adminToken = '';
let superToken = '';
let bannerId = '';

test.beforeAll(async () => {
  adminToken = (await apiLogin(seed.admin.email, seed.admin.password)).body!
    .data!.accessToken;
  superToken = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password))
    .body!.data!.accessToken;
});

test.afterAll(async () => {
  // Dọn nội dung E2E đã tạo.
  await authedDelete(`/news/${newsSlug}`, superToken);
  if (bannerId) await authedDelete(`/banners/${bannerId}`, superToken);
});

async function gotoFE(page: Page, path: string) {
  return page.goto(`${FRONTEND_URL}${path}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
}

test.describe('§11 — Nội dung công khai (frontend)', () => {
  test('route VN và EN hoạt động; điều hướng locale', async ({ page }) => {
    const vi = await gotoFE(page, '/');
    expect(vi!.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveAttribute('lang', /vi/);

    const en = await gotoFE(page, '/en');
    expect(en!.status()).toBeLessThan(400);
    await expect(page.locator('html')).toHaveAttribute('lang', /en/);

    // Điều hướng locale trang giới thiệu.
    const enAbout = await gotoFE(page, '/en/gioi-thieu');
    expect(enAbout!.status()).toBeLessThan(400);
  });

  test('các route công khai quan trọng không lỗi', async ({ page }) => {
    for (const path of [
      '/',
      '/gioi-thieu',
      '/du-an',
      '/tin-tuc',
      '/lien-he',
      '/cong-ty-thanh-vien',
      '/tuyen-dung',
    ]) {
      const resp = await gotoFE(page, path);
      expect(resp!.status(), `route ${path}`).toBeLessThan(400);
    }
  });

  test('nội dung không tồn tại → trạng thái not-found', async ({ page }) => {
    const news = await gotoFE(page, `/tin-tuc/khong-ton-tai-${stamp}`);
    expect(news!.status()).toBe(404);
    const proj = await gotoFE(page, `/du-an/khong-ton-tai-${stamp}`);
    expect(proj!.status()).toBe(404);
  });

  test('route auth/admin KHÔNG tồn tại trên frontend công khai', async ({
    page,
  }) => {
    for (const path of [
      '/dang-nhap',
      '/tai-khoan',
      '/thiet-lap-tai-khoan',
      '/dat-lai-mat-khau',
    ]) {
      const resp = await gotoFE(page, path);
      expect(resp!.status(), `admin route ${path} phải 404`).toBe(404);
    }
  });

  test('bài DRAFT không lộ public; sau khi PUBLISHED thì hiển thị', async ({
    page,
  }) => {
    // Tạo bài bằng token ADMIN → mặc định DRAFT.
    const created = await authedPost('/news', adminToken, {
      slug: newsSlug,
      title: { vi: NEWS_TITLE },
      summary: { vi: 'Tóm tắt bài E2E kiểm thử hiển thị public.' },
      content: [{ vi: 'Nội dung đoạn một của bài E2E.' }],
    });
    expect(created.status).toBeLessThan(400);

    // Backend public: DRAFT không nằm trong list và slug trả 404.
    const listDraft = await publicGet('/news');
    const draftSlugs = (listDraft.body as { data: { slug: string }[] }).data.map(
      (p) => p.slug,
    );
    expect(draftSlugs).not.toContain(newsSlug);
    expect((await publicGet(`/news/${newsSlug}`)).status).toBe(404);

    // Frontend: trang chi tiết bài DRAFT → not-found.
    const draftDetail = await gotoFE(page, `/tin-tuc/${newsSlug}`);
    expect(draftDetail!.status()).toBe(404);

    // Đăng bài.
    const published = await authedPatch(
      `/news/${newsSlug}/status`,
      adminToken,
      { status: 'PUBLISHED' },
    );
    expect(published.status).toBeLessThan(400);

    // Backend public: giờ có trong list + slug 200.
    const listPub = await publicGet('/news');
    const pubSlugs = (listPub.body as { data: { slug: string }[] }).data.map(
      (p) => p.slug,
    );
    expect(pubSlugs).toContain(newsSlug);
    expect((await publicGet(`/news/${newsSlug}`)).status).toBe(200);

    // Frontend: trang chi tiết hiển thị tiêu đề (render on-demand dev, dữ liệu mới).
    //
    // CHẨN ĐOÁN: khẳng định lại backend public NGAY TRƯỚC khi điều hướng, rồi ghi
    // lại status/finalUrl/h1/số khối JSON-LD của frontend. Trước đây khi đỏ chỉ
    // biết "frontend 404" mà không biết backend còn thấy bài hay không, nên không
    // phân biệt được lớp A/C (lỗi backend) với lớp B (cache/render của Next).
    const pubDetail = await probeDetailRoute(page, {
      apiPath: `/news/${newsSlug}`,
      frontendPath: `/tin-tuc/${newsSlug}`,
      label: 'news DRAFT→PUBLISHED',
    });
    expect(pubDetail!.status()).toBe(200);
    await expect(page.getByText(NEWS_TITLE).first()).toBeVisible();
  });

  test('banner nạp từ CMS local hiển thị trên trang chủ', async ({ page }) => {
    const created = await authedPost('/banners', superToken, {
      image: '/images/e2e-banner.png',
      title: { vi: BANNER_TITLE },
      href: '/du-an',
      isActive: true,
    });
    expect(created.status).toBeLessThan(400);
    bannerId = (created.body as { data: { id: string } }).data.id;

    // Public API trả banner vừa tạo (nguồn CMS local).
    const banners = await publicGet('/banners');
    const titles = (
      banners.body as { data: { title: { vi: string } }[] }
    ).data.map((b) => b.title.vi);
    expect(titles).toContain(BANNER_TITLE);

    // Trang chủ render banner từ CMS (có trong DOM).
    await gotoFE(page, '/');
    await expect(page.getByText(BANNER_TITLE).first()).toBeAttached();
  });

  test('dự án nạp từ backend local (endpoint public trả mảng)', async () => {
    const projects = await publicGet('/projects');
    expect(projects.status).toBe(200);
    expect(Array.isArray((projects.body as { data: unknown }).data)).toBe(true);
  });

  test('API base + site URL là local, KHÔNG phải Render/Vercel', async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on('request', (r) => requests.push(r.url()));
    await gotoFE(page, '/');
    // Trình duyệt không gọi tới dịch vụ production.
    for (const url of requests) {
      expect(url).not.toContain('onrender.com');
      expect(url).not.toContain('vercel.app');
    }
    // Canonical/site URL trỏ về host cục bộ (NEXT_PUBLIC_SITE_URL), không phải
    // vercel. Lấy host từ chính hằng số dùng chung thay vì gõ cứng "localhost":
    // E2E đã chuyển sang 127.0.0.1 để tránh phân giải IPv6 ở CI.
    const head = await page.locator('head').innerHTML();
    expect(head).toContain(new URL(FRONTEND_URL).host);
    expect(head).not.toContain('vercel.app');
  });
});
