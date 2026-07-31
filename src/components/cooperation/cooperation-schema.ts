/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

import { bilingualText, optionalImageField } from "@/lib/form-validation";

/** Đối ứng `CreateCooperationProjectDto`. */
export const cooperationSchema = z.object({
  name: bilingualText(2, "Cần tên dự án hợp tác."),
  location: bilingualText(1, "Cần địa điểm."),
  role: bilingualText(1, "Cần vai trò của Thiên Đức."),
  partner: bilingualText(1, "Cần tên đối tác."),
  scale: bilingualText(1, "Cần thông tin quy mô."),
  status: bilingualText(1, "Cần trạng thái dự án."),
  image: optionalImageField(),
});

export type CooperationFormValues = z.infer<typeof cooperationSchema>;
