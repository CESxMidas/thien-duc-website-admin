import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Đưa trang về TRẠNG THÁI HÌNH ẢNH CUỐI rồi mới quét axe.
 *
 * Vì sao cần: `color-contrast` của axe tính màu chữ/nền theo giá trị ĐANG hiển
 * thị, có cộng dồn `opacity` của tổ tiên. Trang quản trị có `.row-in` (hàng bảng
 * mờ dần 0→1, so le 35ms/hàng) và frontend có `.reveal-section` /
 * `.reveal-from-*` (mờ dần 760–1080ms khi lọt khung nhìn). Quét trúng lúc màu
 * đang nội suy thì axe đọc ra tỉ lệ thấp giả — đã đo được 1.21:1 … 4.47:1 cho
 * những phần tử mà trạng thái cuối hoàn toàn đạt chuẩn, nên CI đỏ chập chờn.
 *
 * Chỉ "chờ hết animation" là KHÔNG đủ: `.reveal-section` nằm im ở `opacity: 0`
 * cho tới khi IntersectionObserver gắn `.is-revealed`, nên có những khung hình
 * hoàn toàn yên ắng NGAY TRƯỚC lúc hiệu ứng bắt đầu — chờ kiểu đó vẫn lọt (đã
 * đo: `h2` "Chưa có bài viết" bị quét lúc opacity ≈ 0.07).
 *
 * Cách làm tất định: bật `prefers-reduced-motion: reduce` cho trang. Cả hai app
 * đều đã hỗ trợ sẵn chế độ này trong CSS sản phẩm — frontend đặt
 * `.reveal-section { opacity: 1; transform: none }`, admin rút mọi animation về
 * 0.01ms — tức là **đúng trạng thái cuối**, không còn khoảng nội suy nào. Đây là
 * một chế độ hiển thị thật của sản phẩm, không phải bản vá riêng cho test, và
 * nó làm phép quét CHẶT HƠN (khối dưới màn hình cũng hiện đủ để bị kiểm) chứ
 * không nới lỏng. Sau đó vẫn chờ theo điều kiện cho mọi transition còn dở (do
 * đổi media) chạy xong.
 *
 * Chỉ hỏi "còn animation nào đang chạy không" là CHƯA đủ, vì việc đổi media tự
 * nó khởi động transition ở khung hình kế tiếp: đã đo được lần quét chỉ mất
 * 0,8s (kết luận "yên ắng" ngay trước khi hiệu ứng bắt đầu) rồi đọc ra 1.06:1
 * trên thẻ dự án, trong khi lần quét lành mạnh mất ~5s. Nên điều kiện dừng ở
 * đây khẳng định TRẠNG THÁI ĐÍCH chứ không phải sự vắng mặt của hiệu ứng: không
 * còn phần tử nào có `opacity` lửng lơ ĐANG ĐỔI. Phần tử để `opacity` phân số
 * cố định (nút bị vô hiệu hoá, mũi tên của Select…) giữ nguyên giá trị nên vẫn
 * được coi là ổn định.
 *
 * Bỏ qua có chủ đích khi chờ:
 *  - animation lặp VÔ HẠN (vd. gợn sóng trên bản đồ): không bao giờ "xong".
 *  - animation chỉ đổi `transform` (vd. thanh tiến trình autoplay của banner,
 *    7s/lượt): không đổi màu nên không ảnh hưởng phép đo tương phản.
 *
 * KHÔNG tắt rule nào, KHÔNG loại trừ phần tử nào.
 */
const COLOR_SETTLE_TIMEOUT_MS = 10_000;
const STABLE_FRAMES = 4;

async function waitForStableColors(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.waitForFunction(
    (stableFramesNeeded: number) => {
      // Thuộc tính mà axe dùng để tính tương phản (kể cả gián tiếp qua opacity).
      const COLOR_PROPS = new Set([
        'opacity',
        'color',
        'backgroundColor',
        'background',
        'backgroundImage',
        'borderColor',
        'fill',
        'stroke',
        'visibility',
      ]);

      const isInfinite = (animation: Animation) =>
        animation.effect?.getComputedTiming().iterations === Infinity;

      /** Hiệu ứng này có nội suy thuộc tính ảnh hưởng tới màu hiển thị không? */
      const touchesColor = (animation: Animation): boolean => {
        const effect = animation.effect;
        if (!effect) return false;
        try {
          return (effect as KeyframeEffect)
            .getKeyframes()
            .flatMap((frame) => Object.keys(frame))
            .some((property) => COLOR_PROPS.has(property));
        } catch {
          // Không đọc được keyframe → coi như có ảnh hưởng màu (chờ cho chắc).
          return true;
        }
      };

      const running = document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState !== 'finished' &&
            animation.playState !== 'idle' &&
            !isInfinite(animation) &&
            touchesColor(animation),
        );

      // TUA THẲNG tới trạng thái cuối thay vì ngồi đợi. Nhờ vậy không còn khe
      // hở đua: transition nào mới nhen lên ở khung sau cũng bị kết thúc ngay ở
      // vòng kiểm kế tiếp, và điều kiện dừng vẫn đòi nhiều khung liên tiếp yên.
      // Chỉ tua hiệu ứng ĐỔI MÀU — thanh tiến trình autoplay của banner chỉ đổi
      // `transform` nên không bị đụng tới (tua nó sẽ làm banner nhảy slide).
      for (const animation of running) {
        try {
          animation.finish();
        } catch {
          // Hiệu ứng không kết thúc được (vd. thời lượng vô hạn) — bỏ qua.
        }
      }
      const animating = running.length > 0;

      // Dấu vân tay của mọi `opacity` phân số: đứng yên qua nhiều khung hình
      // nghĩa là không còn phần tử nào đang mờ dần / hiện dần.
      let fingerprint = '';
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const opacity = Number.parseFloat(getComputedStyle(el).opacity);
        if (!(opacity > 0 && opacity < 1)) continue;
        if (el.getAnimations().some(isInfinite)) continue;
        fingerprint += `${opacity.toFixed(3)},`;
      }

      const store = window as unknown as {
        __a11yStableFrames?: number;
        __a11yFingerprint?: string;
      };
      const steady = !animating && store.__a11yFingerprint === fingerprint;
      store.__a11yFingerprint = fingerprint;
      store.__a11yStableFrames = steady
        ? (store.__a11yStableFrames ?? 0) + 1
        : 0;
      return store.__a11yStableFrames >= stableFramesNeeded;
    },
    STABLE_FRAMES,
    { timeout: COLOR_SETTLE_TIMEOUT_MS, polling: 'raf' },
  );
}

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
  await waitForStableColors(page);
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
  await waitForStableColors(page);
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
