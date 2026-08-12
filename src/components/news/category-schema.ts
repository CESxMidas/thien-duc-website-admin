import { z } from "zod";
import { bilingualText } from "@/lib/form-validation";

/**
 * Quy tắc slug chuyên mục — khớp ĐÚNG `NEWS_CATEGORY_SLUG_PATTERN` của backend
 * (`backend/src/news/news-category-slug.ts`).
 *
 * Chặt hơn `SLUG_PATTERN` chung của Admin (`/^[a-z0-9-]+$/`), vốn còn cho qua
 * `--`, `-abc`, `abc-`. Slug chuyên mục là URL công khai **bị khoá sau khi
 * tạo**, nên phải chặn ngay ở form thay vì để backend trả 400 sau khi người
 * dùng đã gõ xong cả biểu mẫu.
 */
export const CATEGORY_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const CATEGORY_SLUG_MIN = 3;
export const CATEGORY_SLUG_MAX = 160;

export const categorySchema = z.object({
  /** `vi` bắt buộc, `en` tuỳ chọn — cùng quy ước với mọi field song ngữ khác. */
  name: bilingualText(2, "Tên chuyên mục tối thiểu 2 ký tự."),
  slug: z
    .string()
    .trim()
    .min(CATEGORY_SLUG_MIN, `Slug tối thiểu ${CATEGORY_SLUG_MIN} ký tự.`)
    .max(CATEGORY_SLUG_MAX, `Slug tối đa ${CATEGORY_SLUG_MAX} ký tự.`)
    .regex(
      CATEGORY_SLUG_PATTERN,
      "Chỉ gồm chữ thường không dấu, số và dấu gạch ngang đơn (ví dụ: tin-du-an).",
    ),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;
