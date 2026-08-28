// Hộp thoại người dùng ĐANG ĐĂNG NHẬP tự đổi mật khẩu của chính mình.
//
// CỐ Ý TÁCH KHỎI biểu mẫu hồ sơ ở `ProfilePage`, vì hai thứ đi hai đường khác
// hẳn nhau:
//   - Hồ sơ  → `PATCH /users/me` → EDITOR rơi vào luồng DUYỆT
//     (`ProfileChangeRequest`), quản trị viên phải bấm chấp thuận.
//   - Mật khẩu → `POST /auth/change-password` → có hiệu lực NGAY, không ai duyệt.
// Gộp chung sẽ vừa hỏng UX (chờ duyệt mới đổi được mật khẩu?) vừa sai bảo mật
// (kéo quản trị viên vào quy trình mật khẩu của người khác — đúng thứ mà
// `UpdateUserDto` bên backend đang cố ý cấm).
//
// Sau khi đổi thành công backend đã thu hồi MỌI refresh token, nên phiên hiện
// tại chắc chắn không gia hạn được nữa. Ta chủ động dọn token và đưa về trang
// đăng nhập thay vì để người dùng lang thang tới lần 401 kế tiếp.

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SplitModal } from "@/components/ui/SplitModal";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { changePassword } from "@/lib/api/auth";
import { clearTokens, LOGIN_PATH } from "@/lib/api/client";
import { withBase } from "@/lib/base-path";
import { resolveApiError } from "@/lib/api-error-message";
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from "./change-password-schema";

const EMPTY: ChangePasswordValues = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  // Mở lại là sạch: không giữ mật khẩu của lượt trước trong state, cũng không
  // giữ lỗi cũ khiến người dùng tưởng vừa nhập sai.
  useEffect(() => {
    if (open) {
      form.reset(EMPTY);
      setSubmitting(false);
    }
  }, [open, form]);

  async function onSubmit(values: ChangePasswordValues) {
    setSubmitting(true);
    try {
      await changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });

      toast.success("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");

      // Backend đã thu hồi toàn bộ refresh token; dọn nốt phía client để không
      // còn access token cũ nằm lại trong storage. `clearTokens` xóa CẢ
      // localStorage lẫn sessionStorage nên không phụ thuộc lựa chọn "ghi nhớ
      // đăng nhập" lúc đăng nhập.
      clearTokens();

      // Điều hướng CỨNG (thoát React Router) để mọi state trong bộ nhớ — cache
      // TanStack Query, context người dùng — bị vứt hẳn thay vì còn sót lại ở
      // trang đăng nhập. `withBase` giữ đúng tiền tố `/admin` (Batch 15B);
      // gán thẳng `LOGIN_PATH` sẽ rơi ra 404 của website công khai.
      window.location.assign(withBase(LOGIN_PATH));
    } catch (error) {
      // Sai mật khẩu hiện tại → backend trả 400 kèm message tiếng Việt, và
      // `resolveApiError` hiện thẳng message đó. 400 KHÔNG chạm nhánh 401/403
      // toàn cục nên người dùng không bị đăng xuất hay đẩy sang /403.
      const message = resolveApiError(error, "Không đổi được mật khẩu.");
      toast.error(message);
      // Giữ nguyên ô đang nhập, chỉ xóa mật khẩu hiện tại và đưa con trỏ về đó
      // — gõ nhầm ô này là trường hợp phổ biến nhất.
      form.resetField("currentPassword");
      form.setFocus("currentPassword");
      setSubmitting(false);
    }
  }

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title="Đổi mật khẩu"
      description="Sau khi đổi, bạn sẽ được đăng xuất khỏi mọi thiết bị và cần đăng nhập lại."
      footer={
        <>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Hủy
          </Button>
          <Button
            type="submit"
            form="change-password-form"
            disabled={submitting}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            Đổi mật khẩu
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id="change-password-form"
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="currentPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu hiện tại</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu mới</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormDescription>Tối thiểu 8 ký tự.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Xác nhận mật khẩu mới</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    autoComplete="new-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </SplitModal>
  );
}
