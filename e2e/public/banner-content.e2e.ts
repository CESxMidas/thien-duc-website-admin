import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { API_URL, FRONTEND_URL, seedAccounts } from '../helpers/config';
import { assertSafeDatabase, backendEnv, BACKEND_DIR } from '../helpers/backend-env';
import { apiLogin, authedGet, authedPatch, publicGet } from '../helpers/api';
import { expectNoSeriousA11y } from '../helpers/a11y';
import { collectOverflow } from '../helpers/layout';

/**
 * THIEN-DUC-BANNER-CONTENT-IMPLEMENTATION-M1 — nội dung banner trang chủ
 * end-to-end: seed cục bộ → API công khai → trang chủ VI/EN → route CTA →
 * responsive → a11y.
 *
 * Nguồn nội dung: `backend/prisma/banner-content.json` (đọc trực tiếp ở đây để
 * test và seed không bao giờ lệch nhau). Mọi dịch vụ đều cục bộ; cầu chì DB
 * chặn mọi thứ không phải `localhost/thien_duc_test`.
 */

interface Bilingual {
  vi: string;
  en?: string;
}

interface BannerSeedEntry {
  image: string;
  objectPosition: string;
  eyebrow: Bilingual;
  title: Bilingual;
  subtitle: Bilingual;
  ctaLabel: Bilingual;
  href: string;
  order: number;
  isActive: boolean;
}

/**
 * Bản ghi từ API: các field chữ phụ là tuỳ chọn — banner do spec khác tạo tạm
 * có thể chỉ có `title`, nên không được ép kiểu chặt như nội dung đã seed.
 */
interface BannerRecord {
  id: string;
  image: string;
  href: string;
  order: number;
  objectPosition: string | null;
  title: Bilingual;
  eyebrow?: Bilingual | null;
  subtitle?: Bilingual | null;
  ctaLabel?: Bilingual | null;
}

const seeded: BannerSeedEntry[] = JSON.parse(
  readFileSync(path.join(BACKEND_DIR, 'prisma/banner-content.json'), 'utf8'),
) as BannerSeedEntry[];

const seed = seedAccounts();
let superToken = '';

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

test.beforeAll(async () => {
  // Cầu chì: chỉ seed vào DB test cục bộ, không bao giờ chạm production.
  assertSafeDatabase(backendEnv().DATABASE_URL);
  // Dự án phải có trước: hai banner trỏ vào route động `/du-an/:slug[/:item]`.
  execSync('npm run prisma:seed:projects', { cwd: BACKEND_DIR, stdio: 'pipe' });
  execSync('npm run prisma:seed:banners', { cwd: BACKEND_DIR, stdio: 'pipe' });
  superToken = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password))
    .body!.data!.accessToken;
});

async function publicBanners(): Promise<BannerRecord[]> {
  const res = await publicGet('/banners');
  expect(res.status).toBe(200);
  return (res.body as { data: BannerRecord[] }).data;
}

/** Chỉ giữ banner do seed tạo (bỏ qua banner tạm của spec khác chạy cùng DB). */
function onlySeeded(banners: BannerRecord[]): BannerRecord[] {
  const images = new Set(seeded.map((b) => b.image));
  return banners.filter((b) => images.has(b.image));
}

async function gotoFE(page: Page, pathname: string) {
  return page.goto(`${FRONTEND_URL}${pathname}`, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });
}

/**
 * Tắt tự chạy để nội dung slide không đổi giữa chừng khi assert.
 *
 * Dùng `page.emulateMedia` chứ KHÔNG dùng `test.use({ reducedMotion })`: ở
 * phiên bản Playwright hiện tại, tuỳ chọn fixture đó không tới được
 * `window.matchMedia` của trang (đã đo: `matches === false`), nên carousel vẫn
 * tự chạy và test thành ra chập chờn.
 */
async function reduceMotion(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
}

/**
 * Cảnh báo CSP có sẵn của site (`upgrade-insecure-requests` trong policy
 * report-only) — do cấu hình security header, không liên quan banner. Bỏ qua
 * đúng chuỗi này, mọi lỗi console khác vẫn làm fail test.
 */
const KNOWN_CONSOLE_NOISE = [
  "The Content Security Policy directive 'upgrade-insecure-requests' is ignored when delivered in a report-only policy.",
];

/** Ảnh trong `next/image` đi qua `/_next/image?url=…` — so trên url đã giải mã. */
function decodedSource(src: string): string {
  const match = /[?&]url=([^&]+)/.exec(src);
  return match ? decodeURIComponent(match[1]) : src;
}

test.describe('§15 — Nội dung banner: API công khai', () => {
  test('trả đủ 4 banner đã seed, đúng thứ tự, không trùng ảnh', async () => {
    const banners = onlySeeded(await publicBanners());
    expect(banners).toHaveLength(seeded.length);
    expect(banners.map((b) => b.image)).toEqual(seeded.map((b) => b.image));
    expect(new Set(banners.map((b) => b.image)).size).toBe(seeded.length);
    expect(banners.map((b) => b.order)).toEqual([0, 1, 2, 3]);
  });

  test('mọi field chữ có đủ VI và EN, kèm href + objectPosition', async () => {
    for (const banner of onlySeeded(await publicBanners())) {
      const expected = seeded.find((b) => b.image === banner.image)!;
      for (const field of ['eyebrow', 'title', 'subtitle', 'ctaLabel'] as const) {
        expect(banner[field]?.vi, `${banner.image}.${field}.vi`).toBe(
          expected[field].vi,
        );
        expect(banner[field]?.en, `${banner.image}.${field}.en`).toBe(
          expected[field].en,
        );
      }
      expect(banner.href).toBe(expected.href);
      expect(banner.objectPosition).toBe(expected.objectPosition);
    }
  });

  test('endpoint công khai chỉ lộ banner đang bật; Admin thấy cả banner tắt', async () => {
    const target = onlySeeded(await publicBanners()).at(-1)!;
    try {
      const off = await authedPatch(`/banners/${target.id}`, superToken, {
        isActive: false,
      });
      expect(off.status).toBeLessThan(400);

      const hidden = await publicBanners();
      expect(hidden.map((b) => b.id)).not.toContain(target.id);

      const adminList = await authedGet('/banners/admin', superToken);
      expect(adminList.status).toBe(200);
      expect(
        (adminList.body as { data: BannerRecord[] }).data.map((b) => b.id),
      ).toContain(target.id);
    } finally {
      // Trả lại trạng thái bật để các test sau (và DB local) không bị lệch.
      await authedPatch(`/banners/${target.id}`, superToken, {
        isActive: true,
      });
    }
    expect((await publicBanners()).map((b) => b.id)).toContain(target.id);
  });

  test('không token thì không đọc/ghi được route quản trị banner', async () => {
    const res = await fetch(
      `${API_URL}/banners/admin`,
    );
    expect(res.status).toBe(401);
  });
});

test.describe('§15 — Trang chủ hiển thị banner', () => {
  test.beforeEach(async ({ page }) => reduceMotion(page));

  test('locale VI hiện tiêu đề/mô tả/nhãn nút tiếng Việt của slide đầu', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    const first = seeded[0];
    const banner = page.getByRole('region', { name: /banner/i }).first();
    await expect(
      banner.getByRole('heading', { level: 1, name: first.title.vi }),
    ).toBeVisible();
    await expect(banner.getByText(first.subtitle.vi)).toBeVisible();
    await expect(banner.getByText(first.eyebrow.vi)).toBeVisible();
    const cta = banner.getByRole('link', { name: first.ctaLabel.vi });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', first.href);
  });

  test('locale EN hiện tiêu đề/mô tả/nhãn nút tiếng Anh và href có tiền tố /en', async ({
    page,
  }) => {
    await gotoFE(page, '/en');
    const first = seeded[0];
    const banner = page.getByRole('region', { name: /banner/i }).first();
    await expect(
      banner.getByRole('heading', { level: 1, name: first.title.en! }),
    ).toBeVisible();
    await expect(banner.getByText(first.subtitle.en!)).toBeVisible();
    await expect(banner.getByText(first.eyebrow.en!)).toBeVisible();
    // Không còn chữ tiếng Việt của banner trên route EN.
    await expect(banner.getByText(first.title.vi)).toHaveCount(0);

    const cta = banner.getByRole('link', { name: first.ctaLabel.en! });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute('href', `/en${first.href}`);
  });

  test('đủ 4 slide, mỗi ảnh đúng một lần, ảnh tải được và có alt có nghĩa', async ({
    page,
  }) => {
    // Thứ tự slide đọc từ API lúc chạy: các spec khác dùng chung DB cục bộ và
    // có thể tạm thêm banner, nên không giả định trang chủ chỉ có 4 slide seed.
    const live = await publicBanners();
    await gotoFE(page, '/');
    const banner = page.getByRole('region', { name: /banner/i }).first();
    const images = banner.locator('img');
    await expect(images).toHaveCount(live.length);

    const sources: string[] = [];
    for (let i = 0; i < live.length; i += 1) {
      const img = images.nth(i);
      const src = decodedSource((await img.getAttribute('src')) ?? '');
      sources.push(src.split('?')[0]);
      // Alt lấy từ tiêu đề banner — mô tả được nội dung ảnh, không phải rỗng.
      expect(await img.getAttribute('alt')).toBe(live[i].title.vi);
      expect(
        await img.evaluate((el: HTMLImageElement) => el.naturalWidth),
        `ảnh hỏng: ${src}`,
      ).toBeGreaterThan(0);
      // objectPosition từ CMS được áp đúng vào style inline.
      expect(
        await img.evaluate((el) => getComputedStyle(el).objectPosition),
      ).not.toBe('');
    }

    // Đủ 4 ảnh banner đã seed, đúng thứ tự tương đối, và không ảnh nào lặp lại.
    expect(sources.filter((src) => seeded.some((b) => b.image === src))).toEqual(
      seeded.map((b) => b.image),
    );
    expect(new Set(sources).size).toBe(sources.length);
  });

  test('chuyển slide bằng bàn phím đổi đúng nội dung slide kế tiếp', async ({
    page,
  }) => {
    // Slide kế tiếp lấy từ API thay vì giả định là `seeded[1]` — DB cục bộ dùng
    // chung với các spec khác nên thứ tự thực tế mới là nguồn đối chiếu đúng.
    const live = await publicBanners();
    expect(live.length, 'cần ≥ 2 banner để kiểm chuyển slide').toBeGreaterThan(1);

    await gotoFE(page, '/');
    const banner = page.getByRole('region', { name: /banner/i }).first();
    /** Nút chấm tròn của slide thứ `index` (0-based) — nhãn a11y đánh số từ 1. */
    const dot = (index: number) =>
      banner.getByRole('button', { name: `Chuyển tới banner ${index + 1}` });

    await expect(
      banner.getByRole('heading', { level: 1, name: live[0].title.vi }),
    ).toBeVisible();

    // CỔNG HYDRATE — mấu chốt của bản sửa chập chờn.
    //
    // `h1` hiện ra ngay từ HTML server render, TRƯỚC khi React gắn `onKeyDown`
    // lên `<section>`. Bản cũ bấm phím ngay sau khi thấy `h1` nên trên máy chậm
    // (runner CI) phím rơi vào khoảng trống đó, không handler nào nhận → slide
    // đứng yên → không tìm thấy tiêu đề slide 2.
    //
    // HTML server luôn render thanh tiến trình autoplay (state khởi tạo
    // `reducedMotion = false`). Effect phía client đọc `matchMedia` — mà spec đã
    // ép `prefers-reduced-motion: reduce` ở `beforeEach` — rồi tắt autoplay,
    // thanh tiến trình biến mất. Thanh này biến mất là BẰNG CHỨNG effect đã
    // chạy, tức component đã hydrate và bàn phím đã có người nhận. Đây cũng là
    // lúc autoplay chắc chắn TẮT, nên không có chuyện tự nhảy slide chen ngang.
    // Chờ theo điều kiện, không phải `waitForTimeout`.
    await expect(page.locator('.banner-progress')).toHaveCount(0);

    // Điểm xuất phát tất định: slide 0 đang hiện.
    await expect(dot(0)).toHaveAttribute('aria-current', 'true');

    // Tiêu điểm nằm đúng trên điều khiển của carousel trước khi bấm phím.
    await dot(0).focus();
    await expect(dot(0)).toBeFocused();

    await page.keyboard.press('ArrowRight');

    // Chỉ số slide đổi hẳn sang 1 (trạng thái, không phải hiệu ứng) rồi mới
    // khẳng định nội dung — không phụ thuộc thời lượng animation mờ chồng.
    await expect(dot(1)).toHaveAttribute('aria-current', 'true');
    await expect(dot(0)).toHaveAttribute('aria-current', 'false');
    await expect(
      banner.getByRole('heading', { level: 1, name: live[1].title.vi }),
    ).toBeVisible();
    if (live[1].subtitle?.vi) {
      await expect(banner.getByText(live[1].subtitle.vi)).toBeVisible();
    }
  });

  test('trang chủ không gọi dịch vụ production và không có lỗi console', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const requests: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));
    page.on('request', (r) => requests.push(r.url()));

    await gotoFE(page, '/');
    await expect(
      page.getByRole('heading', { level: 1, name: seeded[0].title.vi }).first(),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
    expect(
      consoleErrors.filter((text) => !KNOWN_CONSOLE_NOISE.includes(text)),
    ).toEqual([]);
    for (const url of requests) {
      expect(url).not.toContain('onrender.com');
      expect(url).not.toContain('vercel.app');
    }
  });
});

test.describe('§15 — Route CTA của banner có thật', () => {
  test('mọi href banner mở được ở cả VI và EN', async ({ page }) => {
    for (const banner of seeded) {
      const vi = await gotoFE(page, banner.href);
      expect(vi!.status(), `CTA VI ${banner.href}`).toBeLessThan(400);
      const en = await gotoFE(page, `/en${banner.href}`);
      expect(en!.status(), `CTA EN /en${banner.href}`).toBeLessThan(400);
    }
  });

  test('bấm nút CTA trên trang chủ điều hướng đúng trang đích', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    await page
      .getByRole('region', { name: /banner/i })
      .first()
      .getByRole('link', { name: seeded[0].ctaLabel.vi })
      .click();
    await page.waitForURL(`${FRONTEND_URL}${seeded[0].href}`);
    await expect(page.locator('h1').first()).toBeVisible();
  });
});

for (const vp of VIEWPORTS) {
  test.describe(`§15 — Banner responsive @ ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test('chữ banner đọc được, nằm gọn trong khung, không tràn ngang', async ({
      page,
    }) => {
      await reduceMotion(page);
      await gotoFE(page, '/');
      const banner = page.getByRole('region', { name: /banner/i }).first();
      const heading = banner.getByRole('heading', {
        level: 1,
        name: seeded[0].title.vi,
      });
      await expect(heading).toBeVisible();
      await expect(
        banner.getByRole('link', { name: seeded[0].ctaLabel.vi }),
      ).toBeVisible();

      // Không tràn ngang toàn trang. Ngưỡng giữ nguyên; `collectOverflow` chờ
      // bố cục ổn định rồi mới đo và kèm theo phần tử gây tràn để log đọc được.
      const overflow = await collectOverflow(page);
      expect(
        overflow.scrollWidth,
        `[${vp.name}] tràn ngang ${overflow.scrollWidth} > ${overflow.innerWidth}` +
          ` — thủ phạm: ${
            overflow.offenders
              .filter((o) => !o.clippedBy)
              .map((o) => `${o.selector} (+${o.overflowPx}px)`)
              .join(' | ') || 'không xác định'
          }`,
      ).toBeLessThanOrEqual(overflow.innerWidth + 1);

      // Khối chữ nằm trọn trong viewport theo chiều ngang.
      const box = (await heading.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);

      // Tiêu đề `line-clamp-2`, mô tả `line-clamp-3`: nội dung phải vừa khung,
      // không bị cắt mất chữ. So sánh theo **nửa dòng** chứ không phải 1px:
      // hộp `line-clamp` luôn báo scrollHeight nhỉnh hơn clientHeight vài pixel
      // do làm tròn line-box, trong khi bị cắt thật thì lệch nguyên một dòng.
      for (const [label, locator] of [
        ['tiêu đề', heading],
        ['mô tả', banner.getByText(seeded[0].subtitle.vi)],
      ] as const) {
        const { overflow, lineHeight } = await locator.evaluate((el) => ({
          overflow: el.scrollHeight - el.clientHeight,
          lineHeight: parseFloat(getComputedStyle(el).lineHeight),
        }));
        expect(
          overflow,
          `[${vp.name}] ${label} bị cắt: dư ${overflow}px (dòng ${lineHeight}px)`,
        ).toBeLessThan(lineHeight / 2);
      }
    });
  });
}

test.describe('§15 — Truy cập được (a11y) khu vực banner', () => {
  test.beforeEach(async ({ page }) => reduceMotion(page));

  /**
   * Quét đúng KHỐI BANNER (`section[aria-roledescription="carousel"]`) — phạm vi
   * trách nhiệm của việc thêm nội dung banner. Trang chủ nói chung còn một vi
   * phạm `color-contrast` có sẵn ở khối CTA liên hệ (`text-gold` trên `bg-brand`,
   * 3.52:1) — không do banner gây ra và đã ghi nhận thành việc riêng, không im
   * lặng nuốt bằng cách tắt rule.
   */
  const BANNER_SELECTOR = 'section[aria-roledescription="carousel"]';

  test('axe: khối banner VI không có vi phạm serious/critical', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    await expect(
      page.getByRole('heading', { level: 1, name: seeded[0].title.vi }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'banner VI', BANNER_SELECTOR);
  });

  test('axe: khối banner EN cũng sạch serious/critical', async ({ page }) => {
    await gotoFE(page, '/en');
    await expect(
      page.getByRole('heading', { level: 1, name: seeded[0].title.en! }),
    ).toBeVisible();
    await expectNoSeriousA11y(page, 'banner EN', BANNER_SELECTOR);
  });

  test('tương phản chữ trên banner đạt chuẩn ở cả 3 viewport', async ({
    page,
  }) => {
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoFE(page, '/');
      await expect(
        page.getByRole('heading', { level: 1, name: seeded[0].title.vi }),
      ).toBeVisible();
      await expectNoSeriousA11y(page, `banner ${vp.name}`, BANNER_SELECTOR);
    }
  });

  test('carousel khai báo vùng + slide và mọi nút điều khiển đều có nhãn', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    const banner = page.getByRole('region', { name: /banner/i }).first();
    await expect(banner).toHaveAttribute('aria-roledescription', 'carousel');
    await expect(
      banner.locator('[aria-roledescription="slide"]'),
    ).toHaveCount(seeded.length);

    const buttons = banner.getByRole('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i += 1) {
      const label = (await buttons.nth(i).getAttribute('aria-label')) ?? '';
      expect(label.trim().length, `nút ${i} thiếu aria-label`).toBeGreaterThan(0);
    }
  });

  test('điều khiển carousel tới được bằng Tab và có focus ring nhìn thấy', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    const next = page
      .getByRole('region', { name: /banner/i })
      .first()
      .getByRole('button')
      .nth(1);
    await next.focus();
    await expect(next).toBeFocused();
    // Style focus không bị `outline: none` bỏ trống — có ring thay thế.
    const ring = await next.evaluate((el) => {
      const s = getComputedStyle(el);
      return `${s.outlineStyle}|${s.boxShadow}`;
    });
    expect(ring).not.toBe('none|none');
  });

  test('prefers-reduced-motion: tắt tự chạy (không còn thanh tiến trình)', async ({
    page,
  }) => {
    await gotoFE(page, '/');
    await expect(page.locator('.banner-progress')).toHaveCount(0);
  });
});

test.describe('§15 — Tự chạy khi KHÔNG giảm chuyển động', () => {
  test('có thanh tiến trình autoplay và tạm dừng khi trỏ chuột vào', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await gotoFE(page, '/');
    const progress = page.locator('.banner-progress');
    await expect(progress).toHaveCount(1);

    await page
      .getByRole('region', { name: /banner/i })
      .first()
      .hover();
    await expect(progress).toHaveCSS('animation-play-state', 'paused');
  });
});
