/**
 * Chẩn đoán route chi tiết công khai — CHỈ DÙNG CHO TEST, không đụng mã sản phẩm.
 *
 * Vì sao cần: CI báo trang chi tiết trả **404** cho bài vừa tạo, nhưng từ log
 * hiện có KHÔNG phân biệt được lỗi nằm ở đâu. Bốn khả năng cho ra cùng một triệu
 * chứng "404 ở frontend":
 *
 *   A. Backend public trả 404      → lỗi tạo/đăng/slug/hiển thị phía backend
 *   B. Backend 200, frontend 404   → lỗi fetch/cache/render/notFound của Next
 *   C. Backend 404 rồi mới 200     → đua trạng thái (transaction/readiness)
 *   D. Cả hai 200, khẳng định UI đỏ → lỗi render/sanitize/selector
 *
 * Bộ probe này ghi lại đủ dữ kiện để đọc log là biết ngay thuộc lớp nào, thay vì
 * phải đoán. Nó **thêm** khẳng định (backend phải 200 trước khi điều hướng) chứ
 * KHÔNG nới lỏng khẳng định nào đang có.
 *
 * Không log secret: chỉ in URL cục bộ, mã trạng thái và phần đầu body đã cắt.
 */
import { expect, type Page, type Response } from '@playwright/test';

import { API_URL, FRONTEND_URL } from './config';
import { publicGet } from './api';

/** Cắt body để log không phình; payload XSS có thể rất dài. */
const BODY_PREVIEW_LIMIT = 400;

function preview(body: unknown): string {
  if (body === null || body === undefined) return '<không có body>';
  let text: string;
  try {
    text = typeof body === 'string' ? body : JSON.stringify(body);
  } catch {
    return '<body không serialize được>';
  }
  return text.length > BODY_PREVIEW_LIMIT
    ? `${text.slice(0, BODY_PREVIEW_LIMIT)}… (cắt bớt, tổng ${text.length} ký tự)`
    : text;
}

function log(lines: string[]): void {
  // stdout của Playwright gom vào log job CI — đây là nơi ta sẽ đọc khi đỏ.
  console.log(`\n[probe] ${lines.join('\n[probe] ')}\n`);
}

/**
 * Bước 1 — backend public PHẢI thấy nội dung trước khi ta trách frontend.
 *
 * `apiPath` ví dụ `/news/abc` hoặc `/projects/abc`. Trả về status để nơi gọi
 * dùng thêm nếu cần.
 *
 * Đây là khẳng định MỚI và CHẶT HƠN: trước đây một số test điều hướng thẳng
 * frontend mà chưa từng hỏi backend, nên khi đỏ không biết ai sai.
 */
export async function assertPublicApiSees(
  apiPath: string,
  label: string,
): Promise<number> {
  const res = await publicGet(apiPath);
  log([
    `${label} — BACKEND public`,
    `  url    = ${API_URL}${apiPath}`,
    `  status = ${res.status}`,
    `  body   = ${preview(res.body)}`,
  ]);
  expect(
    res.status,
    `${label}: backend public ${API_URL}${apiPath} phải trả 200 TRƯỚC khi mở frontend ` +
      `(status ${res.status} ⇒ lớp A hoặc C: lỗi tạo/đăng/hiển thị phía backend, KHÔNG phải Next)`,
  ).toBe(200);
  return res.status;
}

/**
 * Bước 2 — điều hướng frontend và ghi lại đủ dữ kiện khi không phải 200.
 *
 * KHÔNG tự khẳng định status: nơi gọi giữ nguyên khẳng định vốn có của mình.
 * Hàm này chỉ *quan sát* và in ra.
 */
export async function gotoAndReport(
  page: Page,
  path: string,
  label: string,
): Promise<Response | null> {
  const url = `${FRONTEND_URL}${path}`;
  const response = await page.goto(url, {
    timeout: 60_000,
    waitUntil: 'domcontentloaded',
  });

  const status = response?.status();
  const lines = [
    `${label} — FRONTEND`,
    `  requested = ${url}`,
    `  status    = ${status ?? '<không có response>'}`,
    `  finalUrl  = ${page.url()}`,
  ];

  if (status !== 200) {
    // Trang 404 của Next nằm NGOÀI layout `[locale]`, nên h1 và số khối JSON-LD
    // phân biệt được "404 thật" với "trang bài render nhưng thiếu dữ liệu".
    const h1 = await page
      .locator('h1')
      .first()
      .textContent()
      .catch(() => null);
    const jsonLdCount = await page
      .locator('script[type="application/ld+json"]')
      .count()
      .catch(() => -1);
    lines.push(
      `  h1        = ${h1 === null ? '<không có h1>' : h1.trim()}`,
      `  jsonLd    = ${jsonLdCount} khối ` +
        `(0 ⇒ layout [locale] KHÔNG render ⇒ trang 404 toàn cục của Next)`,
    );
  }

  log(lines);
  return response ?? null;
}

/**
 * Ghi lại trạng thái trang HIỆN TẠI — dùng sau khi điều hướng phía client
 * (bấm `next/link`), lúc không có `Response` nào để đọc mã trạng thái.
 *
 * `jsonLd = 0` là dấu hiệu quyết định: khối `Organization` do
 * `[locale]/layout.tsx` phát ra ở MỌI trang trong cây `[locale]`, nên 0 khối
 * nghĩa là layout không hề chạy → đang ở trang 404 toàn cục của Next.
 */
export async function reportCurrentPage(page: Page, label: string): Promise<void> {
  const h1 = await page
    .locator('h1')
    .first()
    .textContent()
    .catch(() => null);
  const jsonLdCount = await page
    .locator('script[type="application/ld+json"]')
    .count()
    .catch(() => -1);
  const isNextError = await page
    .locator('h1.next-error-h1')
    .count()
    .catch(() => -1);

  log([
    `${label} — SAU ĐIỀU HƯỚNG (client-side)`,
    `  finalUrl   = ${page.url()}`,
    `  h1         = ${h1 === null ? '<không có h1>' : h1.trim()}`,
    `  jsonLd     = ${jsonLdCount} khối (0 ⇒ layout [locale] không render ⇒ trang 404 của Next)`,
    `  nextError  = ${isNextError > 0 ? 'CÓ (h1.next-error-h1)' : 'không'}`,
  ]);
}

/**
 * Bước 1 + 2 gộp cho trường hợp phổ biến: khẳng định backend thấy, rồi mở
 * frontend và trả response để nơi gọi khẳng định tiếp.
 */
export async function probeDetailRoute(
  page: Page,
  opts: { apiPath: string; frontendPath: string; label: string },
): Promise<Response | null> {
  await assertPublicApiSees(opts.apiPath, opts.label);
  return gotoAndReport(page, opts.frontendPath, opts.label);
}
