/**
 * Tiền tố đường dẫn của Admin (Batch 15B).
 *
 * Admin được phục vụ dưới `https://www.thienduccons.vn/admin` (proxy từ Vercel
 * project của FE public) chứ không còn ở gốc `/`. Vite biết điều đó qua
 * `base: '/admin/'` trong `vite.config.ts` và phơi ra `import.meta.env.BASE_URL`.
 *
 * **`BASE_URL` là NGUỒN SỰ THẬT DUY NHẤT.** Không gõ cứng `/admin` trong mã
 * runtime: đổi `base` ở `vite.config.ts` là toàn bộ app đi theo, và bản build
 * cho môi trường khác (nếu sau này cần) không phải sửa code.
 *
 * Vite bảo đảm `BASE_URL` luôn có `/` ở ĐẦU và `/` ở CUỐI (`"/"`, `"/admin/"`).
 * Hai dạng chuẩn hoá dưới đây tồn tại vì hai nơi tiêu thụ cần hai hình dạng
 * khác nhau:
 *
 * - `basename` cho React Router: KHÔNG có `/` cuối (`""` hoặc `"/admin"`).
 * - `withBase()` để ghép path: có `/` cuối, và cắt `/` đầu của path con để
 *   không sinh ra `//` (`/admin//images/...` là URL khác `/admin/images/...`).
 */

/** Base thô từ Vite. Tách ra để test tiêm được giá trị khác. */
const RAW_BASE: string = import.meta.env.BASE_URL;

/**
 * Bỏ `/` cuối — dạng React Router `basename` mong đợi.
 *
 * Base gốc `"/"` → `""`: React Router coi chuỗi rỗng là "không có basename",
 * đúng ý; truyền `"/"` cũng chạy nhưng `""` rõ nghĩa hơn khi debug.
 */
export function toRouterBasename(base: string = RAW_BASE): string {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed;
}

/**
 * Ghép một đường dẫn tuyệt đối-theo-app thành đường dẫn tuyệt đối-theo-origin.
 *
 * Dùng cho những chỗ **không** đi qua React Router:
 * - `src`/`href` của ảnh trong `public/` (Vite KHÔNG viết lại chuỗi trong JSX,
 *   chỉ viết lại `index.html` và import tĩnh);
 * - điều hướng cứng bằng `window.location`.
 *
 * `withBase("/images/logo.png")` → `"/admin/images/logo.png"` (base `/admin/`)
 *                                → `"/images/logo.png"`       (base `/`)
 */
export function withBase(path: string, base: string = RAW_BASE): string {
  const prefix = base.endsWith("/") ? base : `${base}/`;
  // Cắt MỌI `/` đầu của path con: `prefix` đã có sẵn một cái.
  return `${prefix}${path.replace(/^\/+/, "")}`;
}

/**
 * Đường dẫn hiện tại (`window.location.pathname`) có đúng là route `path` của
 * app không — so sánh sau khi đã tính tiền tố base.
 *
 * Cần thiết vì `location.pathname` là `/admin/dang-nhap` trong khi hằng số route
 * của app là `/dang-nhap`. So sánh trực tiếp hai chuỗi đó luôn ra `false` →
 * chốt chặn chống lặp redirect mất tác dụng.
 *
 * Chấp nhận cả biến thể có `/` cuối (`/admin/dang-nhap/`) vì trình duyệt và
 * proxy đều có thể thêm vào.
 */
export function isAppPath(
  pathname: string,
  path: string,
  base: string = RAW_BASE,
): boolean {
  const target = withBase(path, base).replace(/\/+$/, "");
  const current = pathname.replace(/\/+$/, "");
  return current === target;
}
