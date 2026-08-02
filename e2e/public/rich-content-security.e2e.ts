import { expect, test, type Page } from '@playwright/test';
import { API_URL, seedAccounts } from '../helpers/config';
import { apiLogin, authedPost } from '../helpers/api';
import { probeDetailRoute } from '../helpers/detail-route-probe';

/**
 * AUDIT-M2 — nội dung do CMS nhập KHÔNG được thực thi trên trang công khai.
 *
 * HỢP ĐỒNG NỘI DUNG = **văn bản thuần (plain text)**, KHÔNG phải HTML:
 * - Admin nhập bằng `Input`/`Textarea` thường (không có editor rich-text, không
 *   có dependency rich-text/sanitizer nào trong cả 3 repo).
 * - `content[]` là mảng ĐOẠN văn bản, tách theo dòng trống.
 * - Frontend render `<p>{paragraph}</p>` — React tự escape.
 * - `dangerouslySetInnerHTML` trong frontend CHỈ dùng cho JSON-LD.
 *
 * Vì hợp đồng là plain text, KHÔNG thêm sanitizer allowlist HTML: làm vậy sẽ ngụ
 * ý HTML được hỗ trợ và còn phá nội dung hợp lệ (vd. "a < b"). Việc phải làm là
 * chặn đúng hai chỗ chữ thuần rò vào ngữ cảnh nguy hiểm:
 *   1. JSON-LD (`<script type="application/ld+json">`) — đã sửa bằng
 *      `serializeJsonLd` (escape `<`, `>`, `&`, U+2028/9).
 *   2. Field URL (`href`, `image`) — đã siết bằng allowlist HÌNH DẠNG ở backend.
 *
 * Trước bản sửa, lỗ hổng ở (1) đã được TÁI HIỆN: tiêu đề chứa
 * `</script><img src=x onerror=alert(1)>` đóng sớm thẻ script và `<img>` trở thành
 * phần tử HTML thật trong DOM.
 */

const seed = seedAccounts();
const slug = `xss-guard-${Date.now().toString(36)}`;
let token = '';

/** Payload gom mọi biến thể mà mục 2 của đề bài yêu cầu thử. */
const CLOSE = '</scr' + 'ipt>';
const PAYLOADS = [
  `${CLOSE}<img src=x onerror=window.__xss=1>`,
  '<script>window.__xss=1</scr' + 'ipt>',
  '<img src=x onerror=window.__xss=1>',
  '<svg onload=window.__xss=1>',
  '<a href="javascript:window.__xss=1">click</a>',
  '<a href="data:text/html,<h1>x</h1>">click</a>',
  '<iframe src="data:text/html,<h1>x</h1>"></iframe>',
  '<object data=x></object>',
  '<embed src=x>',
  '<style>@import "evil"</style>',
  '&lt;script&gt;window.__xss=1&lt;/script&gt;',
  '<SCRIPT >window.__xss=1</SCRIPT >',
  '<img src=x OnErRoR=window.__xss=1>',
];

test.beforeAll(async () => {
  token = (await apiLogin(seed.superAdmin.email, seed.superAdmin.password)).body!
    .data!.accessToken;
  expect(token).not.toBe('');

  // SUPER_ADMIN tạo là PUBLISHED ngay → bài có mặt ở route công khai.
  const created = await authedPost('/news', token, {
    slug,
    title: { vi: `Tiêu đề ${PAYLOADS[0]}`, en: `Title ${PAYLOADS[0]}` },
    summary: { vi: `Tóm tắt ${PAYLOADS[3]}`, en: `Summary ${PAYLOADS[3]}` },
    content: PAYLOADS.map((payload) => ({ vi: payload, en: payload })),
  });
  expect(created.status, 'tạo bài chứa payload').toBe(201);
});

test.afterAll(async () => {
  await fetch(`${API_URL}/news/${slug}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
});

/** Bắt mọi dialog (alert/confirm) — nếu payload chạy được sẽ lộ ra ở đây. */
async function collectDialogs(page: Page): Promise<string[]> {
  const seen: string[] = [];
  page.on('dialog', async (dialog) => {
    seen.push(dialog.message());
    await dialog.dismiss();
  });
  return seen;
}

test.describe('§M2 — nội dung độc hại không thực thi trên trang công khai', () => {
  for (const locale of ['', '/en'] as const) {
    const label = locale === '' ? 'VI' : 'EN';

    test(`${label}: payload không tạo phần tử thực thi, không đặt biến, không dialog`, async ({
      page,
    }) => {
      const dialogs = await collectDialogs(page);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));

      // CHẨN ĐOÁN: bài này do SUPER_ADMIN tạo nên PHẢI là PUBLISHED ngay. Hỏi
      // backend public trước, rồi mới mở frontend — nếu backend 404 thì lỗi nằm
      // ở khâu tạo/đăng (lớp A/C), không phải ở sanitizer.
      await probeDetailRoute(page, {
        apiPath: `/news/${slug}`,
        frontendPath: `${locale}/tin-tuc/${slug}`,
        label: `rich-content ${label} payload`,
      });

      // 1) Payload KHÔNG chạy: không biến toàn cục, không dialog.
      expect(await page.evaluate(() => (window as never as { __xss?: number }).__xss))
        .toBeUndefined();
      expect(dialogs, 'không được có dialog nào').toEqual([]);

      // 2) Payload KHÔNG trở thành phần tử thật trong DOM.
      const injected = await page.evaluate(() => ({
        // Script do payload SINH RA.
        //
        // Phải loại `self.__next_f` — đó là dữ liệu flight (RSC payload) của
        // Next: nó nhúng nguyên văn nội dung trang vào một **chuỗi JSON** bên
        // trong thẻ script, nên chuỗi `window.__xss` xuất hiện ở đó là BÌNH
        // THƯỜNG và không thực thi (đã kiểm: `window.__xss` vẫn undefined). Bản
        // đầu của test này đếm cả chúng và báo 5 script "lạ" — dương tính giả.
        rogueScripts: Array.from(document.querySelectorAll('script')).filter(
          (s) =>
            !s.src &&
            s.type !== 'application/ld+json' &&
            !/self\.__next_f/.test(s.textContent ?? '') &&
            /window\.__xss/.test(s.textContent ?? ''),
        ).length,
        imgOnError: document.querySelectorAll('img[onerror]').length,
        svgOnLoad: document.querySelectorAll('svg[onload]').length,
        iframes: document.querySelectorAll('iframe').length,
        objects: document.querySelectorAll('object, embed').length,
        // Link mang scheme nguy hiểm (React chặn javascript:, nhưng data: thì không).
        dangerousHrefs: Array.from(document.querySelectorAll('a[href]'))
          .map((a) => a.getAttribute('href') ?? '')
          .filter((href) => /^\s*(javascript|data|vbscript):/i.test(href)),
      }));
      expect(injected.rogueScripts).toBe(0);
      expect(injected.imgOnError).toBe(0);
      expect(injected.svgOnLoad).toBe(0);
      expect(injected.iframes).toBe(0);
      expect(injected.objects).toBe(0);
      expect(injected.dangerousHrefs).toEqual([]);

      // 3) Payload vẫn HIỂN THỊ nguyên văn dưới dạng CHỮ (đúng hợp đồng plain
      //    text — không bị âm thầm cắt bỏ, cũng không bị thực thi).
      await expect(
        page.getByText('<img src=x onerror=window.__xss=1>', { exact: false }).first(),
      ).toBeVisible();

      // 4) Không có lỗi JS nào phát sinh từ nội dung.
      expect(errors).toEqual([]);
    });

    test(`${label}: mọi khối JSON-LD vẫn là JSON hợp lệ (không bị phá bởi </script>)`, async ({
      page,
    }) => {
      // CHẨN ĐOÁN: 0 khối JSON-LD nghĩa là layout `[locale]` không render (trang
      // 404 toàn cục của Next), KHÔNG phải lỗi escape JSON-LD — probe ghi rõ.
      await probeDetailRoute(page, {
        apiPath: `/news/${slug}`,
        frontendPath: `${locale}/tin-tuc/${slug}`,
        label: `rich-content ${label} JSON-LD`,
      });

      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .allTextContents();
      expect(blocks.length, 'phải có ít nhất Organization + NewsArticle').toBeGreaterThan(
        1,
      );

      for (const raw of blocks) {
        expect(() => JSON.parse(raw)).not.toThrow();
        // Escape đã áp: không còn `<` thô trong thân script.
        expect(raw).not.toContain('<');
      }

      // NewsArticle giữ ĐÚNG nghĩa: headline round-trip nguyên văn payload.
      const newsArticle = blocks
        .map((raw) => JSON.parse(raw) as Record<string, unknown>)
        .find((data) => data['@type'] === 'NewsArticle');
      expect(newsArticle, 'phải có khối NewsArticle').toBeTruthy();
      expect(String(newsArticle!.headline)).toContain(PAYLOADS[0]);
    });
  }

  test('API từ chối href/image mang scheme nguy hiểm (hàng rào server)', async () => {
    const TAB = String.fromCharCode(9);
    for (const href of [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      `java${TAB}script:alert(1)`,
      'data:text/html,<h1>x</h1>',
      'vbscript:msgbox(1)',
      '//evil.example.com',
    ]) {
      const response = await authedPost('/banners', token, {
        image: '/images/probe.png',
        href,
        title: { vi: 'probe' },
      });
      expect(response.status, `href ${href} phải bị từ chối`).toBe(400);
    }
  });
});
