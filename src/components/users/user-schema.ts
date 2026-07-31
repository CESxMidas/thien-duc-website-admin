/**
 * Schema Zod cho form — tách khỏi file component CÓ CHỦ Ý:
 *  1. `react-refresh/only-export-components`: file component chỉ nên export
 *     component, export thêm thứ khác làm hỏng Fast Refresh.
 *  2. Test schema trực tiếp mà KHÔNG kéo cả component (và hàng chục hàm chưa
 *     có test của nó) vào mẫu số coverage.
 * Ràng buộc soi gương DTO tương ứng ở backend.
 */
import { z } from "zod";

/**
 * Đối ứng `CreateAccountInvitationDto` / `UpdateUserDto`.
 * KHÔNG có field mật khẩu ở cả tạo mới lẫn sửa: người dùng tự đặt mật khẩu qua
 * email lời mời và tự đổi qua luồng quên mật khẩu.
 */
export const userSchema = z.object({
  name: z.string().trim().min(2, "Họ tên tối thiểu 2 ký tự."),
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng."),
  role: z.enum(["EDITOR", "ADMIN", "SUPER_ADMIN"]),
});

export type UserFormValues = z.infer<typeof userSchema>;
