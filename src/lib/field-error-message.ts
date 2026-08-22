// Rút thông báo lỗi hiển thị được ra khỏi cây lỗi của react-hook-form.
//
// ── Vì sao cần ────────────────────────────────────────────────────────────────
// Với field có giá trị LỒNG NHAU, Zod gắn lỗi vào đường dẫn con chứ không phải
// gốc. `bilingualText()` dựng `z.object({ vi, en })`, nên một field khai báo
// `<FormField name="title">` nhận về:
//
//   { vi: { message: "Tiêu đề tối thiểu 3 ký tự.", type: "too_small", ref: … } }
//
// `error.message` ở gốc là `undefined`. `FormMessage` đọc mỗi chỗ đó nên render
// ra rỗng: người dùng thấy ô viền đỏ mà không có chữ nào giải thích, và
// `aria-describedby` trỏ tới một id không tồn tại.
//
// ── Vì sao sửa ở ĐÂY chứ không ở Zod ─────────────────────────────────────────
// Cách còn lại là cho `bilingualText()` dồn lỗi về gốc object bằng
// `superRefine`. Bỏ qua vì nó **phá ngữ nghĩa validate**: `vi` và `en` là hai
// ràng buộc độc lập (`vi` bắt buộc tối thiểu N ký tự, `en` tùy chọn nhưng vẫn
// có trần độ dài). Dồn về gốc sẽ mất thông tin ngôn ngữ nào hỏng, đúng thứ mà
// một form song ngữ cần giữ. Ngoài ra nó bắt phải sửa cả sáu nhóm schema
// (Banner, Cooperation, NewsCategory, News, Page, Project) thay vì một chỗ.
//
// Ở tầng hiển thị, đường dẫn của Zod giữ nguyên 100% — chỉ phần ĐỌC biết đi sâu.

/**
 * Khoá SIÊU DỮ LIỆU của `FieldError`, không phải field con.
 *
 * `message` xử lý riêng trước; `root` cũng vậy (xem dưới). Ba khoá còn lại là
 * phần ruột của react-hook-form và không bao giờ chứa lỗi của field con:
 *  - `type`  — mã lỗi ("too_small")
 *  - `ref`   — tham chiếu tới DOM node
 *  - `types` — bản đồ nhiều lỗi khi bật `criteriaMode: "all"`
 */
const METADATA_KEYS = new Set(["message", "type", "ref", "types", "root"]);

/** Trần độ sâu — chặn đứng mọi khả năng lặp vô hạn do tham chiếu vòng. */
const MAX_DEPTH = 5;

/** Cây lỗi của react-hook-form: `FieldError` hoặc object lồng các `FieldError`. */
type ErrorNode = { message?: unknown; [key: string]: unknown };

function isNode(value: unknown): value is ErrorNode {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Thông báo hiển thị được ĐẦU TIÊN trong cây lỗi, hoặc `undefined`.
 *
 * ## Thứ tự ưu tiên (tất định)
 *
 * 1. `error.message` — lỗi phẳng thắng tuyệt đối. Nhờ vậy mọi field vô hướng
 *    (đăng nhập, đặt lại mật khẩu, slug, ngày giờ, select) hành xử **y hệt**
 *    như trước bản sửa: cùng một nhánh, cùng một giá trị.
 * 2. `error.root.message` — react-hook-form dành `root` cho lỗi ở CẤP OBJECT.
 *    Nếu có thì nó nói về cả field, nên phải thắng lỗi của từng con.
 * 3. Con đầu tiên có thông báo, duyệt theo thứ tự khoá.
 *
 * ## Vì sao "con đầu tiên" là tất định
 *
 * Khoá chuỗi trong JS giữ thứ tự chèn, và zodResolver chèn theo thứ tự issue mà
 * Zod sinh ra — tức thứ tự khai báo trong schema. Với `bilingualText` thì `vi`
 * luôn đứng trước `en`. Điều đó vừa ổn định vừa đúng nghiệp vụ: `vi` là ngôn
 * ngữ bắt buộc, còn `en` tùy chọn, nên lỗi của `vi` mới là thứ cần nói trước.
 *
 * ## Điều hàm này CỐ Ý không làm
 *
 * Không `String(value)` lên một giá trị bất kỳ: chỉ trả về khi thật sự gặp một
 * chuỗi không rỗng. Nhờ vậy object lỗi dị dạng hay rỗng cho ra `undefined` và
 * `FormMessage` im lặng, thay vì đẩy "[object Object]" ra màn hình.
 *
 * Không biết gì về `vi`/`en`. Đây là hạ tầng chung của form; gắn cứng tên ngôn
 * ngữ vào đây sẽ biến một tiện ích dùng chung thành thứ chỉ phục vụ field song
 * ngữ.
 */
export function getFieldErrorMessage(
  error: unknown,
  depth = 0,
): string | undefined {
  if (!isNode(error) || depth > MAX_DEPTH) return undefined;

  if (typeof error.message === "string" && error.message !== "") {
    return error.message;
  }

  const fromRoot = getFieldErrorMessage(error.root, depth + 1);
  if (fromRoot !== undefined) return fromRoot;

  for (const [key, value] of Object.entries(error)) {
    if (METADATA_KEYS.has(key)) continue;
    const nested = getFieldErrorMessage(value, depth + 1);
    if (nested !== undefined) return nested;
  }

  return undefined;
}
