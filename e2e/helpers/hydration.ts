import { expect, type Page } from '@playwright/test';

/**
 * CỔNG HYDRATE cho các trang Next.js (App Router) của frontend công khai.
 *
 * **Vì sao cần.** HTML do server render đã có đủ nút, thẻ, link — Playwright
 * thấy chúng "khả kiến, bấm được" và bấm ngay. Nhưng handler React (`onClick`
 * của slider, lớp chặn điều hướng của `next/link`) chỉ tồn tại SAU khi cây
 * React hydrate xong. Bấm vào khoảng trống giữa hai mốc đó thì:
 *
 * - nút slider: không handler nào nhận → thẻ đứng yên (test poll 10s rồi đỏ);
 * - link phân trang: trình duyệt điều hướng cứng, trong khi hydrate xong ngay
 *   sau đó có thể khiến router xử lý lại cùng cú bấm → hai mục lịch sử cho cùng
 *   một URL → một lần `goBack()` không quay về được trang trước.
 *
 * Trên máy dev có cache ấm, hydrate xong trước khi Playwright kịp bấm nên test
 * xanh; trên runner CI nguội thì cửa sổ đó rộng ra và test chập chờn. Đây đúng
 * lớp lỗi đã ghi nhận ở `banner-content.e2e.ts` ("CỔNG HYDRATE").
 *
 * **Tín hiệu dùng ở đây.** App Router tự chèn phần tử `<next-route-announcer>`
 * vào `document.body` trong một `useEffect` của `AppRouterAnnouncer`
 * (`next/dist/client/components/app-router-announcer.js`). Phần tử này **không
 * có trong HTML server render** (đã kiểm bằng cách tải thẳng HTML: 0 kết quả),
 * chỉ xuất hiện khi effect chạy — tức là cây đã hydrate. Không cần thêm bất kỳ
 * thuộc tính test nào vào mã production.
 *
 * Đây là chi tiết nội bộ của Next: nếu bản Next sau đổi tên phần tử, hàm này
 * hết hạn chờ và test **đỏ rõ ràng** (không âm thầm xanh sai).
 */
export async function waitForAppHydration(page: Page): Promise<void> {
  await expect(
    page.locator('next-route-announcer'),
    'App Router chưa hydrate (không thấy <next-route-announcer>)',
  ).toHaveCount(1, { timeout: 15_000 });
}
