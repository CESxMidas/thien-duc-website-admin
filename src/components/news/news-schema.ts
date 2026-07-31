/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

import {
  MAX_AUTHOR_LENGTH,
  MAX_CATEGORY_ID_LENGTH,
  bilingualText,
  optionalDateField,
  optionalImageField,
  slugField,
} from "@/lib/form-validation";
import { longFormContentSchema } from "@/lib/long-form-content";

/**
 * Đối ứng `CreateNewsPostDto`.
 * Bản dịch tiếng Anh không bắt buộc ở form — xem `BilingualField`.
 */
export const newsSchema = z.object({
  title: bilingualText(3, "Tiêu đề tối thiểu 3 ký tự."),
  slug: slugField(),
  summary: bilingualText(10, "Tóm tắt tối thiểu 10 ký tự."),
  // Nội dung bài không bắt buộc (bài có thể chỉ có tóm tắt), nhưng mỗi đoạn
  // phải nằm trong trần độ dài mà backend chấp nhận.
  content: longFormContentSchema(),
  categoryId: z
    .string()
    .max(MAX_CATEGORY_ID_LENGTH, `Tối đa ${MAX_CATEGORY_ID_LENGTH} ký tự.`),
  author: z
    .string()
    .trim()
    .max(MAX_AUTHOR_LENGTH, `Tối đa ${MAX_AUTHOR_LENGTH} ký tự.`),
  image: optionalImageField(),
  eventDate: optionalDateField(),
});

export type NewsFormValues = z.infer<typeof newsSchema>;
