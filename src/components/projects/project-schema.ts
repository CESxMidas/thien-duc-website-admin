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
  bilingualText,
  optionalBilingualText,
  optionalImageField,
  slugField,
} from "@/lib/form-validation";

/**
 * Đối ứng `CreateProjectDto`.
 * Bản dịch tiếng Anh **không bắt buộc ở form**: biên tập viên thường nhập tiếng
 * Việt trước rồi bổ sung sau. Song ngữ là điều kiện go-live (câu 19) nên chỗ
 * thiếu được đánh dấu bằng chấm vàng trong `BilingualField`, không chặn lưu.
 */
export const projectSchema = z.object({
  title: bilingualText(3, "Tên dự án tối thiểu 3 ký tự."),
  slug: slugField(),
  summary: bilingualText(10, "Mô tả ngắn tối thiểu 10 ký tự."),
  location: optionalBilingualText(),
  category: optionalBilingualText(),
  // Ảnh đại diện (thẻ danh sách + hero trang chi tiết). Không bắt buộc nhưng
  // thiếu thì trang công khai hiện ô trống — nên khuyến khích nhập.
  image: optionalImageField(),
  status: z.enum(["DA_BAN_GIAO", "DANG_THI_CONG", "CHUAN_BI_KHOI_CONG"]),
});

export type ProjectFormValues = z.infer<typeof projectSchema>;
