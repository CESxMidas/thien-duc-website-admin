import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Chạy axe-core (WCAG 2.1 A/AA) và FAIL nếu còn BẤT KỲ vi phạm mức
 * `serious`/`critical` — GỒM `color-contrast`. Không loại trừ / không hạ mức bất
 * kỳ rule nào. Chỉ log id + số node (không in nội dung nhạy cảm).
 *
 * Lưu ý: axe chỉ bắt phần kiểm được tự động — KHÔNG khẳng định đạt chuẩn a11y
 * toàn diện ngoài phạm vi đã test.
 */
export async function expectNoSeriousA11y(
  page: Page,
  label: string,
  /**
   * Bộ chọn CSS giới hạn phạm vi quét (tuỳ chọn). Dùng khi spec chỉ chịu trách
   * nhiệm cho một khối cụ thể — vẫn giữ NGUYÊN bộ rule wcag2a/wcag2aa, không
   * tắt/hạ mức rule nào; chỉ thu hẹp vùng DOM được kiểm.
   */
  include?: string,
): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']);
  if (include) builder = builder.include(include);
  const results = await builder.analyze();
  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
  const summary = blocking.map(
    (v) => `${v.id} (${v.impact}) x${v.nodes.length}`,
  );
  expect(
    blocking,
    `[a11y ${label}] serious/critical: ${summary.join(', ')}`,
  ).toEqual([]);
}

/**
 * Chỉ kiểm `color-contrast` (dùng cho spec đa viewport §6). FAIL nếu còn bất kỳ
 * vi phạm tương phản nào — không loại trừ phần tử động.
 */
export async function expectNoColorContrast(
  page: Page,
  label: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withRules(['color-contrast'])
    .analyze();
  const summary = results.violations.flatMap((v) =>
    v.nodes.map((n) => n.target.join(' ')),
  );
  expect(
    results.violations,
    `[contrast ${label}] color-contrast x${summary.length}: ${summary
      .slice(0, 5)
      .join(' | ')}`,
  ).toEqual([]);
}
