import { z } from "zod";

/**
 * Ràng buộc dùng chung cho các schema Zod của FormDialog, **soi gương hợp đồng
 * của backend DTO**.
 *
 * Nguyên tắc (giống `long-form-content.ts` đã áp cho nội dung dài): Admin kiểm
 * **đúng bằng** backend, không lỏng hơn và **không chặt hơn**.
 * - Lỏng hơn ⇒ biên tập viên chỉ biết sai sau khi bấm Lưu và nhận 400.
 * - Chặt hơn ⇒ Admin tự chặn dữ liệu mà API vốn chấp nhận.
 *
 * Mỗi hằng số dưới đây có một đối ứng ở backend; đổi một bên thì phải đổi bên
 * kia.
 */

/** `TranslatedTextDto` — trần mỗi field chữ ngắn (`vi`/`en`). */
export const MAX_TEXT_LENGTH = 5_000;

/** `@MaxLength(160)` trên `slug` của news / pages / projects. */
export const MAX_SLUG_LENGTH = 160;

/** `@MaxLength(500)` trên `image` / `href` / `gallery[]`. */
export const MAX_URL_LENGTH = 500;

/** `@MaxLength(60)` trên `CreateBannerDto.objectPosition`. */
export const MAX_OBJECT_POSITION_LENGTH = 60;

/** `@MaxLength(120)` trên `CreateNewsPostDto.author`. */
export const MAX_AUTHOR_LENGTH = 120;

/** `@MaxLength(60)` trên `CreateNewsPostDto.categoryId`. */
export const MAX_CATEGORY_ID_LENGTH = 60;

/** Slug: chỉ chữ thường, số, gạch ngang. */
export const SLUG_PATTERN = /^[a-z0-9-]+$/;

/** `<input type="date">` luôn trả `YYYY-MM-DD` — đối ứng `@IsDateString()`. */
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ký tự điều khiển + mọi loại khoảng trắng Unicode bị bỏ trước khi soi hình
 * dạng URL. Cổng chuyển thẳng từ `backend/src/common/validators/safe-url.ts` —
 * giữ **y hệt** danh sách ký tự, nếu không hai bên sẽ lệch nhau ở đúng những
 * biến thể lách mà hàng rào này sinh ra để chặn.
 */
const STRIPPABLE = new RegExp(
  // eslint-disable-next-line no-control-regex
  "[\u0000-\u0020\u007f-\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]",
  "g",
);

function collapse(value: string): string {
  return value.replace(STRIPPABLE, "");
}

/**
 * Đường dẫn nội bộ an toàn: bắt đầu bằng đúng MỘT dấu `/`.
 * Chặn `//evil.example.com` và `/\evil.com` (trình duyệt coi `/\` như `//`),
 * và chặn mọi thứ có scheme vì chúng không bắt đầu bằng `/`.
 */
export function isSafeInternalPath(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const v = collapse(value);
  if (v.length === 0) return false;
  if (v[0] !== "/") return false;
  if (v[1] === "/" || v[1] === "\\") return false;
  return true;
}

/**
 * Tham chiếu ảnh an toàn: đường dẫn nội bộ HOẶC URL tuyệt đối `https:`.
 * `http:` bị từ chối (mixed-content trên site https).
 */
export function isSafeImageRef(value: unknown): boolean {
  if (typeof value !== "string") return false;
  if (isSafeInternalPath(value)) return true;
  const v = collapse(value);
  if (!/^https:\/\//i.test(v)) return false;
  try {
    const url = new URL(v);
    return url.protocol === "https:" && url.hostname.length > 0;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   Mảnh schema dùng lại
   --------------------------------------------------------------------------- */

/** Chữ ngắn song ngữ: `vi` bắt buộc tối thiểu `minVi`, `en` tùy chọn. */
export function bilingualText(minVi: number, message: string) {
  return z.object({
    vi: z
      .string()
      .trim()
      .min(minVi, message)
      .max(MAX_TEXT_LENGTH, `Tối đa ${MAX_TEXT_LENGTH.toLocaleString("vi-VN")} ký tự.`),
    en: z
      .string()
      .trim()
      .max(MAX_TEXT_LENGTH, `Tối đa ${MAX_TEXT_LENGTH.toLocaleString("vi-VN")} ký tự.`),
  });
}

/** Chữ ngắn song ngữ không bắt buộc — `vi` được để trống. */
export function optionalBilingualText() {
  return bilingualText(0, "");
}

/** Slug: min 3, tối đa 160, chỉ `[a-z0-9-]`. */
export function slugField() {
  return z
    .string()
    .trim()
    .min(3, "Slug tối thiểu 3 ký tự.")
    .max(MAX_SLUG_LENGTH, `Slug tối đa ${MAX_SLUG_LENGTH} ký tự.`)
    .regex(SLUG_PATTERN, "Chỉ gồm chữ thường, số và dấu gạch ngang.");
}

/**
 * Ảnh: rỗng = không đặt ảnh (khớp `@IsOptional()`); có giá trị thì phải là
 * đường dẫn nội bộ hoặc URL https, tối đa 500 ký tự.
 */
export function optionalImageField() {
  return z
    .string()
    .trim()
    .max(MAX_URL_LENGTH, `Đường dẫn tối đa ${MAX_URL_LENGTH} ký tự.`)
    .refine((value) => value === "" || isSafeImageRef(value), {
      message: 'Ảnh phải là đường dẫn nội bộ bắt đầu bằng “/” hoặc URL https://.',
    });
}

/** Ảnh bắt buộc (banner) — cùng ràng buộc, nhưng không cho rỗng. */
export function requiredImageField(message: string) {
  return z
    .string()
    .trim()
    .min(1, message)
    .max(MAX_URL_LENGTH, `Đường dẫn tối đa ${MAX_URL_LENGTH} ký tự.`)
    .refine(isSafeImageRef, {
      message: 'Ảnh phải là đường dẫn nội bộ bắt đầu bằng “/” hoặc URL https://.',
    });
}

/** `href` của banner: bắt buộc, chỉ nhận đường dẫn nội bộ. */
export function internalHrefField() {
  return z
    .string()
    .trim()
    .min(1, "Cần đường dẫn đích.")
    .max(MAX_URL_LENGTH, `Đường dẫn tối đa ${MAX_URL_LENGTH} ký tự.`)
    .refine(isSafeInternalPath, {
      message: 'Đường dẫn nội bộ, bắt đầu bằng “/” (không nhận scheme hay “//host”).',
    });
}

/** Ngày `YYYY-MM-DD` tùy chọn — rỗng nghĩa là không đặt. */
export function optionalDateField() {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || DATE_ONLY_PATTERN.test(value), {
      message: "Ngày không hợp lệ (định dạng YYYY-MM-DD).",
    });
}
