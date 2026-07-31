import { expect, test, type Page } from '@playwright/test';
import { FRONTEND_URL } from '../helpers/config';

/**
 * M2-R2 — `prefers-reduced-motion: reduce` phải trung hoà hiệu ứng reveal trên
 * các trang `.projects-motion` (danh sách dự án, chi tiết dự án, chi tiết hạng
 * mục).
 *
 * DEFECT ĐÃ TÁI HIỆN TRƯỚC KHI SỬA — nguyên nhân là **specificity**, không phải
 * thứ tự stylesheet:
 *   `.stagger-sides > *:nth-child(odd)`             = 0,2,0  (đặt transform ±128px)
 *   `.stagger-sides.is-revealed > *:nth-child(odd)` = 0,3,0  (đặt animation)
 * đều cao hơn hai luật trung hoà trong khối `@media (prefers-reduced-motion)`
 * (`.stagger-sides > *` = 0,1,0 và `.stagger-sides.is-revealed > *` = 0,2,0).
 * Kết quả: người chọn giảm chuyển động VẪN thấy thẻ trượt ngang.
 *
 * Bản sửa lặp lại đúng hình dạng selector `:nth-child(odd|even)` bên trong khối
 * reduced-motion (thắng nhờ đứng sau, cùng specificity) — không `!important`,
 * không tắt animation toàn cục, và cố ý KHÔNG đụng `:hover` (0,3,0) nên phản
 * hồi nhấc thẻ 5px khi rê chuột vẫn còn.
 *
 * Các test dưới đây khẳng định HAI điều, vì chỉ một là chưa đủ:
 *   1. Không còn chuyển động (`animation-name: none`, `transform: none`).
 *   2. Nội dung VẪN NHÌN THẤY (`opacity: 1`) — sửa a11y không được đánh đổi
 *      bằng việc làm nội dung biến mất.
 */

const MOTION_PAGES = [
  ['danh sách dự án', '/du-an'],
  ['danh sách dự án (EN)', '/en/du-an'],
] as const;

/** Đọc style đã tính của mọi con trực tiếp trong `.stagger-sides`. */
async function staggerChildStyles(page: Page) {
  return page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('.stagger-sides'));
    return containers.flatMap((container) =>
      Array.from(container.children).map((child) => {
        const style = getComputedStyle(child);
        return {
          animationName: style.animationName,
          transform: style.transform,
          opacity: style.opacity,
        };
      }),
    );
  });
}

/** Đọc style của các phần tử reveal trượt hai bên. */
async function revealStyles(page: Page) {
  return page.evaluate(() => {
    const nodes = Array.from(
      document.querySelectorAll('.reveal-from-left, .reveal-from-right, .reveal-section'),
    );
    return nodes.map((node) => {
      const style = getComputedStyle(node);
      return {
        animationName: style.animationName,
        transform: style.transform,
        opacity: style.opacity,
      };
    });
  });
}

/**
 * Cuộn hết trang rồi CHỜ TẤT ĐỊNH tới khi IntersectionObserver đã gắn
 * `.is-revealed` — đúng trạng thái người dùng thật gặp. Cố ý KHÔNG dùng
 * `waitForTimeout`: chờ theo mốc thời gian tuỳ ý vừa chậm vừa chập chờn.
 */
async function scrollAndAwaitReveal(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForFunction(() => {
    const targets = document.querySelectorAll(
      '.stagger-sides, .reveal-from-left, .reveal-from-right, .reveal-section',
    );
    if (targets.length === 0) return false;
    return Array.from(targets).some((node) => node.classList.contains('is-revealed'));
  });
}

/** `transform` đã tính là "không dịch chuyển"? */
function isNoTransform(transform: string): boolean {
  return (
    transform === 'none' ||
    transform === 'matrix(1, 0, 0, 1, 0, 0)' ||
    transform === 'matrix(1,0,0,1,0,0)'
  );
}

test.describe('§M2-R2 — prefers-reduced-motion trung hoà reveal', () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });

  for (const [label, path] of MOTION_PAGES) {
    test(`${label}: không phần tử stagger nào còn animation/transform, và vẫn hiện`, async ({
      page,
    }) => {
      await page.goto(`${FRONTEND_URL}${path}`);
      // Cuộn hết trang để IntersectionObserver gắn `.is-revealed` — đúng trạng
      // thái mà người dùng thật gặp, không phải trạng thái trước reveal.
      await scrollAndAwaitReveal(page);

      const children = await staggerChildStyles(page);
      expect(children.length, 'trang phải có phần tử .stagger-sides để test có nghĩa')
        .toBeGreaterThan(0);

      for (const style of children) {
        expect(style.animationName).toBe('none');
        expect(isNoTransform(style.transform), `transform = ${style.transform}`).toBe(true);
        expect(Number(style.opacity)).toBe(1);
      }
    });

    test(`${label}: reveal-from-left/right cũng bị trung hoà và vẫn hiện`, async ({ page }) => {
      await page.goto(`${FRONTEND_URL}${path}`);
      await scrollAndAwaitReveal(page);

      for (const style of await revealStyles(page)) {
        expect(style.animationName).toBe('none');
        expect(isNoTransform(style.transform), `transform = ${style.transform}`).toBe(true);
        expect(Number(style.opacity)).toBe(1);
      }
    });
  }

  test('KHÔNG giảm chuyển động: hiệu ứng vẫn chạy (bản sửa không tắt nhầm cho mọi người)', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(`${FRONTEND_URL}/du-an`);
    await scrollAndAwaitReveal(page);

    const children = await staggerChildStyles(page);
    expect(children.length).toBeGreaterThan(0);
    // Ít nhất một phần tử phải có animation thật — nếu tất cả đều `none` thì bản
    // sửa đã rò ra ngoài khối media và giết hiệu ứng của mọi người dùng.
    expect(children.some((style) => style.animationName !== 'none')).toBe(true);
  });

  test('nội dung vẫn đọc được: tiêu đề trang hiển thị khi giảm chuyển động', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/du-an`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
