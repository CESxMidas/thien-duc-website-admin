import { expect, type Page } from '@playwright/test';

/**
 * Kiểm tràn ngang + CHẨN ĐOÁN phần tử gây tràn.
 *
 * Trước đây mỗi spec tự `page.evaluate` đo `scrollWidth` rồi so với `innerWidth`;
 * khi đỏ thì thông báo chỉ có hai con số ("388 > 375"), không biết phần tử nào
 * gây ra. Helper này giữ NGUYÊN điều kiện khẳng định (scrollWidth ≤ innerWidth
 * + 1px) nhưng chụp thêm bằng chứng DOM để lần sau đọc log là ra thủ phạm.
 */

export interface OverflowOffender {
  selector: string;
  rect: { x: number; y: number; width: number; height: number; right: number };
  overflowPx: number;
  computedWidth: string;
  minWidth: string;
  maxWidth: string;
  marginLeft: string;
  marginRight: string;
  transform: string;
  position: string;
  whiteSpace: string;
  /** Tổ tiên gần nhất cắt tràn ngang (nếu có) — phần tử bị cắt không đẩy scrollWidth. */
  clippedBy: string | null;
  /** Bị cắt bởi khối bên trong (có chủ đích) — không tính là tràn mức trang. */
  clippedByInner: boolean;
  text: string;
}

export interface OverflowReport {
  scrollWidth: number;
  innerWidth: number;
  layoutWidth: number;
  overflowPx: number;
  offenders: OverflowOffender[];
}

/**
 * Chờ bố cục ổn định rồi mới đo.
 *
 * Đo THẲNG đại lượng mà phép khẳng định quan tâm — `documentElement.scrollWidth`
 * — và chỉ dừng khi nó giữ nguyên qua nhiều khung hình liên tiếp. Cố ý KHÔNG
 * chờ "hết animation": trang chủ có thanh tiến trình autoplay chạy lại vô tận
 * mỗi 7s (chỉ đổi `transform` trong một khối đã bị cắt tràn) nên không bao giờ
 * có khung hình nào "sạch animation", trong khi bề rộng tài liệu thì đã đứng
 * yên từ lâu.
 *
 * Là điều kiện, không phải `waitForTimeout` cố định.
 */
const LAYOUT_SETTLE_TIMEOUT_MS = 8_000;
const STABLE_FRAMES = 5;

async function waitForStableLayout(page: Page): Promise<void> {
  await page.waitForFunction(
    (stableFramesNeeded: number) => {
      const store = window as unknown as {
        __layoutStableFrames?: number;
        __layoutLastWidth?: number;
      };
      const width = document.documentElement.scrollWidth;
      const steady = store.__layoutLastWidth === width;
      store.__layoutLastWidth = width;
      store.__layoutStableFrames = steady
        ? (store.__layoutStableFrames ?? 0) + 1
        : 0;
      return store.__layoutStableFrames >= stableFramesNeeded;
    },
    STABLE_FRAMES,
    { timeout: LAYOUT_SETTLE_TIMEOUT_MS, polling: 'raf' },
  );
}

/** Hiệu ứng reveal dài nhất ~2,2s + trễ so le — cho dư địa. */
const ANIMATION_SETTLE_TIMEOUT_MS = 8_000;

/** Các lớp bọc hiệu ứng reveal — trạng thái CHỜ của chúng nằm lệch ngoài khung. */
const REVEAL_SELECTOR =
  '.stagger-sides, .reveal-from-left, .reveal-from-right, .reveal-sides-pair, .reveal-section, .image-reveal';

/**
 * Chờ các animation CÓ ĐIỂM KẾT chạy xong, BỎ QUA animation lặp vô tận.
 *
 * Không thể chờ "hết mọi animation": trang chủ có thanh tiến trình autoplay lặp
 * **vô tận**, sẽ không bao giờ có khung hình nào sạch animation. Lọc theo
 * `iterations === Infinity` — chờ đúng những animation sẽ kết thúc.
 *
 * Là điều kiện, KHÔNG phải `waitForTimeout`. Quá hạn thì vẫn đo tiếp: phép
 * khẳng định bề rộng mới là thứ quyết định đỏ/xanh.
 */
async function waitForFiniteAnimations(page: Page): Promise<void> {
  try {
    await page.waitForFunction(
      () =>
        document.getAnimations().every((animation) => {
          const iterations = animation.effect?.getTiming().iterations ?? 1;
          if (iterations === Infinity) return true;
          return (
            animation.playState === 'finished' || animation.playState === 'idle'
          );
        }),
      undefined,
      { timeout: ANIMATION_SETTLE_TIMEOUT_MS, polling: 'raf' },
    );
  } catch {
    // Hết hạn chờ: vẫn tiếp tục đo.
  }
}

/** Thu thập số đo + danh sách phần tử vượt khung (đã sắp theo mức vượt). */
export async function collectOverflow(page: Page): Promise<OverflowReport> {
  // ĐO Ở TRẠNG THÁI BỐ CỤC CUỐI (đã reveal), không phải trạng thái CHỜ.
  //
  // Vì sao (AUDIT-M2, đo bằng probe trong trình duyệt): các khối
  // `.stagger-sides` / `.reveal-*` reveal theo IntersectionObserver, và trạng
  // thái **trước khi reveal** cố ý nằm lệch ngoài khung (`translateX(±128px)` —
  // `.projects-motion` nâng `--reveal-sides-distance` lên 128px). Ngay sau khi
  // tải, probe cho `getAnimations().length === 0`, chưa có class `is-revealed`,
  // và `scrollWidth` = 1128 ở viewport 1024. Reveal xong, thẻ về `right = 1000`
  // và `scrollWidth` = 1024: KHÔNG hề tràn.
  //
  // Nên phép đo phải đưa trang về trạng thái đã reveal một cách TẤT ĐỊNH: gắn
  // đúng class `is-revealed` mà chính sản phẩm dùng, rồi chờ animation kết thúc.
  // Không phụ thuộc thời điểm observer bắn, không cuộn, không `waitForTimeout`.
  //
  // KHÔNG phải cách che defect: đây là trạng thái cuối mà mọi người dùng đều
  // thấy, và lỗi tràn ngang thật vẫn bị bắt — khuyết `min-w-0` ở dải ảnh
  // `ProjectItemGallery` đã bị phát hiện đúng trong đợt này.
  await page.waitForFunction(() => document.fonts.status === 'loaded', undefined, {
    timeout: 8_000,
  });
  await page.evaluate((selector: string) => {
    document
      .querySelectorAll(selector)
      .forEach((el) => el.classList.add('is-revealed'));
  }, REVEAL_SELECTOR);
  await waitForFiniteAnimations(page);
  await waitForStableLayout(page);

  return page.evaluate(() => {
    const root = document.documentElement;
    const layoutWidth = root.clientWidth;
    const innerWidth = window.innerWidth;

    const describe = (el: Element): string => {
      const parts: string[] = [];
      let cursor: Element | null = el;
      for (let depth = 0; cursor && depth < 4; depth += 1) {
        let piece = cursor.tagName.toLowerCase();
        if (cursor.id) piece += `#${cursor.id}`;
        const classes = (cursor.getAttribute('class') ?? '')
          .split(/\s+/)
          .filter(Boolean)
          .slice(0, 6)
          .join('.');
        if (classes) piece += `.${classes}`;
        parts.unshift(piece);
        cursor = cursor.parentElement;
      }
      return parts.join(' > ');
    };

    const offenders = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      const right = rect.right + window.scrollX;
      if (right <= layoutWidth + 0.5) continue;

      let clippedBy: string | null = null;
      let clippedByInner = false;
      let parent = el.parentElement;
      while (parent) {
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.overflowX !== 'visible') {
          clippedBy = `${describe(parent)} [overflow-x:${parentStyle.overflowX}]`;
          // Bị cắt bởi một khối BÊN TRONG (carousel track, dải ảnh cuộn…) là
          // CÓ CHỦ ĐÍCH. Chỉ `html`/`body` mới là mức trang.
          clippedByInner =
            parent !== document.documentElement && parent !== document.body;
          break;
        }
        parent = parent.parentElement;
      }

      const style = getComputedStyle(el);
      offenders.push({
        selector: describe(el),
        rect: {
          x: Number(rect.x.toFixed(2)),
          y: Number(rect.y.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
          height: Number(rect.height.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
        },
        overflowPx: Number((right - layoutWidth).toFixed(2)),
        computedWidth: style.width,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        marginLeft: style.marginLeft,
        marginRight: style.marginRight,
        transform: style.transform,
        position: style.position,
        whiteSpace: style.whiteSpace,
        clippedBy,
        clippedByInner,
        text: (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 60),
      });
    }
    offenders.sort((a, b) => b.overflowPx - a.overflowPx);

    return {
      scrollWidth: root.scrollWidth,
      innerWidth,
      layoutWidth,
      overflowPx: root.scrollWidth - innerWidth,
      // Phần tử BỊ CẮT không đẩy scrollWidth — xếp sau để thủ phạm thật lên đầu.
      offenders: [
        ...offenders.filter((o) => !o.clippedBy),
        ...offenders.filter((o) => o.clippedBy),
      ].slice(0, 8),
    };
  });
}

function formatOffenders(report: OverflowReport): string {
  if (report.offenders.length === 0) return '(không tìm thấy phần tử vượt khung)';
  return report.offenders
    .map(
      (o) =>
        `\n  +${o.overflowPx}px  ${o.selector}` +
        `\n     rect=${JSON.stringify(o.rect)}` +
        `\n     width=${o.computedWidth} min-width=${o.minWidth} max-width=${o.maxWidth}` +
        `\n     margin=${o.marginLeft}/${o.marginRight} transform=${o.transform}` +
        ` position=${o.position} white-space=${o.whiteSpace}` +
        `\n     clippedBy=${o.clippedBy ?? 'KHÔNG BỊ CẮT (đây là thủ phạm đẩy scrollWidth)'}` +
        `\n     text="${o.text}"`,
    )
    .join('');
}

/**
 * Không tràn ngang: bề rộng cuộn không vượt quá viewport (cho phép lệch 1px do
 * làm tròn sub-pixel). Ngưỡng giữ nguyên như trước — chỉ thêm chẩn đoán.
 */
export async function expectNoHorizontalOverflow(
  page: Page,
  label: string,
): Promise<void> {
  const report = await collectOverflow(page);

  // KHẲNG ĐỊNH THEO PHẦN TỬ, không theo `documentElement.scrollWidth`.
  //
  // Vì sao đổi (AUDIT-M2): với các trang có hiệu ứng reveal bằng `transform`,
  // `scrollWidth` giữ lại vùng cuộn CŨ và KHÔNG co lại sau khi transform về 0 —
  // đo được ở `/du-an`: sau khi mọi phần tử đã về trong khung, danh sách phần tử
  // vượt khung RỖNG mà `scrollWidth` vẫn 1128 ở viewport 1024. Dùng con số đó thì
  // báo đỏ một trang hoàn toàn không tràn.
  //
  // Thay vào đó đo THỨ người dùng thật sự gặp: có phần tử nào chìa ra ngoài bề
  // rộng bố cục hay không. `html` có `overflow-x: clip` nên phần chìa ra bị CẮT
  // (chữ/nút mất một phần) — vẫn là defect, nên vẫn tính. Riêng phần tử bị cắt
  // bởi một khối BÊN TRONG (carousel track, dải ảnh cuộn ngang) là có chủ đích,
  // nên loại khỏi phép khẳng định.
  //
  // Đây là phép đo CHẶT HƠN, không phải nới lỏng: nó chỉ đúng phần tử gây lỗi, và
  // vẫn bắt được defect thật của đợt này (dải ảnh `ProjectItemGallery` thiếu
  // `min-w-0` chìa ra 440px ở viewport 320).
  const pageLevel = report.offenders.filter((o) => !o.clippedByInner);
  expect(
    pageLevel,
    `[${label}] tràn ngang: ${pageLevel.length} phần tử chìa ra ngoài` +
      ` layoutWidth ${report.layoutWidth}` +
      ` (scrollWidth ${report.scrollWidth}, innerWidth ${report.innerWidth})` +
      `${formatOffenders(report)}`,
  ).toEqual([]);
}
