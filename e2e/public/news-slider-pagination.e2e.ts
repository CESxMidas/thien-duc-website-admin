import { test, expect, type Page } from '@playwright/test';
import { API_URL, FRONTEND_URL, seedAccounts } from '../helpers/config';
import { apiLogin, authedPatch, authedPost } from '../helpers/api';
import { expectNoSeriousA11y } from '../helpers/a11y';
import { expectNoHorizontalOverflow } from '../helpers/layout';

/**
 * THIEN-DUC-NEWS-SLIDER-AND-PAGINATION-M1 — slider tin ở trang chủ và phân
 * trang ở `/tin-tuc`, chạy end-to-end trên hạ tầng cục bộ có sẵn (backend 3001
 * + frontend 3000, cầu chì DB chặn mọi thứ không phải `thien_duc_test`).
 *
 * Spec tự seed đủ bài để có **nhiều hơn một trang** (9 bài/trang), cộng một bài
 * DRAFT và một bài PENDING để khẳng định chúng không bao giờ lọt ra ngoài.
 * Không dùng `waitForTimeout` ở bất kỳ đâu — mọi chờ đợi đều theo điều kiện DOM
 * hoặc điều hướng.
 */

const VIEWPORT = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
};

/** Đủ để lấp 2 trang (9/trang) và dư cho slider trang chủ. */
const PUBLISHED_COUNT = 11;
const PAGE_SIZE = 9;

const RUN_ID = `m1-${Date.now().toString(36)}`;
const slugOf = (index: number) => `e2e-${RUN_ID}-tin-${index}`;
const titleOf = (index: number) => `E2E ${RUN_ID} bài ${index}`;

const seed = seedAccounts();
let token = '';
const createdSlugs: string[] = [];

interface NewsPayload {
  slug: string;
  title: { vi: string; en: string };
  summary: { vi: string; en: string };
  content: { vi: string; en: string }[];
  image?: string;
}

async function createPost(
  index: number,
  status: 'PUBLISHED' | 'DRAFT' | 'PENDING',
): Promise<void> {
  const slug = slugOf(index);
  const payload: NewsPayload = {
    slug,
    title: { vi: titleOf(index), en: `E2E ${RUN_ID} article ${index}` },
    summary: { vi: `Tóm tắt ${index}`, en: `Summary ${index}` },
    content: [{ vi: `Đoạn ${index}`, en: `Paragraph ${index}` }],
    image: '/images/news/legacy/tin-tuc-thien-duc-placeholder-01.jpg',
  };

  const created = await authedPost('/news', token, payload);
  expect(created.status, `tạo bài ${slug}`).toBe(201);
  createdSlugs.push(slug);

  // SUPER_ADMIN tạo bài là PUBLISHED ngay (luồng bỏ qua duyệt), nên chỉ cần đổi
  // trạng thái khi muốn bài KHÔNG được đăng.
  if (status !== 'PUBLISHED') {
    const moved = await authedPatch(`/news/${slug}/status`, token, { status });
    expect(moved.status, `đổi trạng thái ${slug} → ${status}`).toBe(200);
  }
}

/** Số thẻ đang nằm trong cửa sổ hiển thị của slider trang chủ. */
async function visibleSlideCount(page: Page): Promise<number> {
  return page.locator('[data-testid="news-slide"][data-visible="true"]').count();
}

async function firstVisibleTitle(page: Page): Promise<string> {
  return (
    (await page
      .locator('[data-testid="news-slide"][data-visible="true"]')
      .first()
      .locator('h3')
      .textContent()) ?? ''
  );
}

test.beforeAll(async () => {
  const login = await apiLogin(seed.superAdmin.email, seed.superAdmin.password);
  expect(login.status, 'đăng nhập SUPER_ADMIN để seed').toBe(200);
  token = login.body?.data?.accessToken ?? '';
  expect(token).not.toBe('');

  for (let index = 1; index <= PUBLISHED_COUNT; index += 1) {
    await createPost(index, 'PUBLISHED');
  }
  await createPost(90, 'DRAFT');
  await createPost(91, 'PENDING');
});

test.afterAll(async () => {
  // Dọn sạch bài của lần chạy này để lần sau không cộng dồn số trang.
  for (const slug of createdSlugs) {
    await fetch(`${API_URL}/news/${slug}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});

test.describe('API phân trang tin tức', () => {
  test('không có page/limit → vẫn trả mảng phẳng (tương thích ngược)', async () => {
    const response = await fetch(`${API_URL}/news`);
    const body = (await response.json()) as { data: unknown };

    expect(response.status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });

  test('có page/limit → envelope đủ metadata, chỉ bài đã đăng', async () => {
    const response = await fetch(`${API_URL}/news?page=1&limit=${PAGE_SIZE}`);
    const body = (await response.json()) as {
      data: {
        items: { slug: string; status?: string }[];
        page: number;
        limit: number;
        totalItems: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };

    expect(response.status).toBe(200);
    const { data } = body;
    expect(data.page).toBe(1);
    expect(data.limit).toBe(PAGE_SIZE);
    expect(data.items).toHaveLength(PAGE_SIZE);
    expect(data.totalItems).toBeGreaterThanOrEqual(PUBLISHED_COUNT);
    expect(data.totalPages).toBe(Math.ceil(data.totalItems / PAGE_SIZE));
    expect(data.hasPreviousPage).toBe(false);
    expect(data.hasNextPage).toBe(true);

    const slugs = data.items.map((item) => item.slug);
    expect(slugs).not.toContain(slugOf(90));
    expect(slugs).not.toContain(slugOf(91));
  });

  test('trang 2 khác trang 1, không lặp bài', async () => {
    const [first, second] = await Promise.all([
      fetch(`${API_URL}/news?page=1&limit=${PAGE_SIZE}`).then((r) => r.json()),
      fetch(`${API_URL}/news?page=2&limit=${PAGE_SIZE}`).then((r) => r.json()),
    ]);

    const firstSlugs = (first as { data: { items: { slug: string }[] } }).data.items.map(
      (item) => item.slug,
    );
    const secondSlugs = (second as { data: { items: { slug: string }[] } }).data.items.map(
      (item) => item.slug,
    );

    expect(secondSlugs.length).toBeGreaterThan(0);
    for (const slug of secondSlugs) {
      expect(firstSlugs).not.toContain(slug);
    }
  });

  test('limit vượt trần bị từ chối (400), không kéo được cả kho', async () => {
    const response = await fetch(`${API_URL}/news?page=1&limit=5000`);
    expect(response.status).toBe(400);
  });

  test('page = 0 và page âm bị từ chối (400)', async () => {
    expect((await fetch(`${API_URL}/news?page=0`)).status).toBe(400);
    expect((await fetch(`${API_URL}/news?page=-2`)).status).toBe(400);
  });

  test('page không phải số bị từ chối (400)', async () => {
    expect((await fetch(`${API_URL}/news?page=abc`)).status).toBe(400);
  });

  test('trang vượt quá trang cuối trả rỗng, không lỗi', async () => {
    const response = await fetch(`${API_URL}/news?page=999&limit=${PAGE_SIZE}`);
    const body = (await response.json()) as {
      data: { items: unknown[]; hasNextPage: boolean };
    };

    expect(response.status).toBe(200);
    expect(body.data.items).toEqual([]);
    expect(body.data.hasNextPage).toBe(false);
  });

  test('bài DRAFT/PENDING không đọc được qua route công khai', async () => {
    expect((await fetch(`${API_URL}/news/${slugOf(90)}`)).status).toBe(404);
    expect((await fetch(`${API_URL}/news/${slugOf(91)}`)).status).toBe(404);
  });
});

test.describe('Slider tin ở trang chủ', () => {
  test('desktop: 3 thẻ, next/previous đổi thẻ, không lặp', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    expect(await visibleSlideCount(page)).toBe(3);
    const before = await firstVisibleTitle(page);

    await page.getByTestId('news-slider-next').click();
    await expect
      .poll(() => firstVisibleTitle(page), { message: 'thẻ đầu phải đổi' })
      .not.toBe(before);
    expect(await visibleSlideCount(page)).toBe(3);

    // Không có thẻ nào hiện hai lần trong khung.
    const titles = await page
      .locator('[data-testid="news-slide"][data-visible="true"] h3')
      .allTextContents();
    expect(new Set(titles).size).toBe(titles.length);

    await page.getByTestId('news-slider-previous').click();
    await expect.poll(() => firstVisibleTitle(page)).toBe(before);
  });

  test('tablet: 2 thẻ', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.tablet);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    await expect.poll(() => visibleSlideCount(page)).toBe(2);
    await expectNoHorizontalOverflow(page, 'trang chủ tablet');
  });

  test('mobile: 1 thẻ, không tràn ngang', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.mobile);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    await expect.poll(() => visibleSlideCount(page)).toBe(1);
    await expectNoHorizontalOverflow(page, 'trang chủ mobile');
  });

  test('ArrowRight/ArrowLeft điều khiển được bằng bàn phím', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/`);
    const region = page.getByRole('group', { name: /tin mới nhất/i });
    await region.waitFor();

    const before = await firstVisibleTitle(page);
    await region.press('ArrowRight');
    await expect.poll(() => firstVisibleTitle(page)).not.toBe(before);

    await region.press('ArrowLeft');
    await expect.poll(() => firstVisibleTitle(page)).toBe(before);
  });

  test('nút previous vô hiệu ở đầu dãy', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    await expect(page.getByTestId('news-slider-previous')).toBeDisabled();
    await expect(page.getByTestId('news-slider-next')).toBeEnabled();
  });

  test('bấm thẻ mở đúng bài', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    const card = page
      .locator('[data-testid="news-slide"][data-visible="true"]')
      .first()
      .getByRole('link');
    const title = await firstVisibleTitle(page);
    await card.click();

    await page.waitForURL(/\/tin-tuc\/.+/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(title);
  });

  test('khối tin trang chủ không có vi phạm a11y nghiêm trọng', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/`);
    await page.locator('[data-testid="news-slider-track"]').waitFor();

    await expectNoSeriousA11y(page, 'trang chủ — slider tin');
    await expectNoHorizontalOverflow(page, 'trang chủ desktop');
  });
});

test.describe('Phân trang /tin-tuc', () => {
  test('trang 1 hiển thị đúng số bài và có bộ phân trang', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/tin-tuc`);

    await expect(page.getByTestId('news-pagination')).toBeVisible();
    await expect(page.locator('main article, main a:has(h2)')).toHaveCount(
      PAGE_SIZE,
    );
  });

  test('bấm sang trang 2: URL đổi, nội dung đổi, aria-current đúng', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/tin-tuc`);

    const firstPageTitles = await page.locator('main h2').allTextContents();

    await page.getByTestId('pagination-next').click();
    await page.waitForURL(/[?&]page=2/);

    const secondPageTitles = await page.locator('main h2').allTextContents();
    expect(secondPageTitles).not.toEqual(firstPageTitles);

    const current = page.locator('[aria-current="page"]');
    await expect(current).toHaveText('2');
  });

  test('tải thẳng URL trang 2 và tải lại đều giữ nguyên trang', async ({
    page,
  }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/tin-tuc?page=2`);
    await expect(page.locator('[aria-current="page"]')).toHaveText('2');

    await page.reload();
    await expect(page.locator('[aria-current="page"]')).toHaveText('2');
  });

  test('Back của trình duyệt quay lại trang 1', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/tin-tuc`);
    await page.getByTestId('pagination-next').click();
    await page.waitForURL(/[?&]page=2/);

    await page.goBack();
    await page.waitForURL((url) => !url.search.includes('page=2'));
    await expect(page.locator('[aria-current="page"]')).toHaveText('1');
  });

  test('Previous quay lại trang trước', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/tin-tuc?page=2`);

    await page.getByTestId('pagination-previous').click();
    await page.waitForURL((url) => !url.search.includes('page=2'));
    await expect(page.locator('[aria-current="page"]')).toHaveText('1');
  });

  test('page không hợp lệ được chuẩn hoá về trang 1', async ({ page }) => {
    for (const bad of ['0', '-1', 'abc', '1']) {
      await page.goto(`${FRONTEND_URL}/tin-tuc?page=${bad}`);
      await page.waitForURL((url) => !url.search.includes('page='));
      await expect(page.locator('[aria-current="page"]')).toHaveText('1');
    }
  });

  test('page vượt quá trang cuối đưa về trang cuối có thật', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/tin-tuc?page=999`);

    const current = page.locator('[aria-current="page"]');
    await expect(current).toBeVisible();
    await expect(current).not.toHaveText('999');
    await expect(page.getByTestId('pagination-next')).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  test('không bài DRAFT/PENDING nào lọt ra trang tin', async ({ page }) => {
    for (const path of ['/tin-tuc', '/tin-tuc?page=2']) {
      await page.goto(`${FRONTEND_URL}${path}`);
      await expect(page.getByText(titleOf(90))).toHaveCount(0);
      await expect(page.getByText(titleOf(91))).toHaveCount(0);
    }
  });

  test('bản tiếng Anh: nội dung và phân trang đều tiếng Anh', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);
    await page.goto(`${FRONTEND_URL}/en/tin-tuc`);

    await expect(
      page.getByRole('navigation', { name: 'News pagination' }),
    ).toBeVisible();

    await page.getByTestId('pagination-next').click();
    await page.waitForURL(/\/en\/tin-tuc\?page=2/);
    await expect(page.locator('[aria-current="page"]')).toHaveText('2');
    await expect(page.locator('main')).toContainText(`E2E ${RUN_ID} article`);
  });

  test('mobile: phân trang không tràn ngang, vẫn bấm được', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.mobile);
    await page.goto(`${FRONTEND_URL}/tin-tuc`);

    await expect(page.getByTestId('news-pagination')).toBeVisible();
    await expectNoHorizontalOverflow(page, '/tin-tuc mobile');

    await page.getByTestId('pagination-next').click();
    await page.waitForURL(/[?&]page=2/);
    await expectNoHorizontalOverflow(page, '/tin-tuc mobile trang 2');
  });

  test('a11y trang 1 và trang 2 đều sạch', async ({ page }) => {
    await page.setViewportSize(VIEWPORT.desktop);

    await page.goto(`${FRONTEND_URL}/tin-tuc`);
    await expectNoSeriousA11y(page, '/tin-tuc trang 1');

    await page.goto(`${FRONTEND_URL}/tin-tuc?page=2`);
    await expectNoSeriousA11y(page, '/tin-tuc trang 2');
    await expectNoHorizontalOverflow(page, '/tin-tuc desktop trang 2');
  });
});
