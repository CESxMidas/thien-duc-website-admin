/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

import { bilingualText, slugField } from "@/lib/form-validation";
import { longFormContentSchema } from "@/lib/long-form-content";

/** Đối ứng `CreatePageDto` (`content` là mảng đoạn, không được rỗng). */
export const pageSchema = z.object({
  slug: slugField(),
  title: bilingualText(3, "Tiêu đề tối thiểu 3 ký tự."),
  content: longFormContentSchema(1, "Cần ít nhất một đoạn nội dung."),
});

export type PageFormValues = z.infer<typeof pageSchema>;
