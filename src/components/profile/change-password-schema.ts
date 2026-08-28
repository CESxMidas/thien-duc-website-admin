import { z } from "zod";

/**
 * Schema đổi mật khẩu — tách khỏi component theo đúng quy ước sẵn có của repo
 * (`user-schema.ts`, `news-schema.ts`, `banner-schema.ts`…): file component chỉ
 * export component, nếu không `react-refresh/only-export-components` sẽ cảnh báo.
 *
 * Chính sách độ dài khớp NGUYÊN VẸN backend (`ChangePasswordDto`: min 8 /
 * max 128) và hai form mật khẩu còn lại (thiết lập tài khoản, đặt lại mật
 * khẩu). Backend vẫn là nơi phán quyết cuối cùng — validate ở đây chỉ để người
 * dùng biết sớm, KHÔNG phải hàng rào bảo mật.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Vui lòng nhập mật khẩu hiện tại."),
    newPassword: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .max(128, "Mật khẩu tối đa 128 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp.",
  })
  // Backend cũng chặn (so bằng bcrypt với hash đang lưu, chắc chắn hơn), nhưng
  // bắt sớm ở đây thì người dùng không tốn một vòng mạng để nhận lỗi hiển nhiên.
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Mật khẩu mới phải khác mật khẩu hiện tại.",
  });

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
