import { useEffect, useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userSchema, type UserFormValues } from "./user-schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import {
  useCreateUserInvitation,
  useUpdateUser,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { roleLabel } from "@/lib/labels";
import type { AdminUser, Role } from "@/types";

const roleOptions = Object.keys(roleLabel) as Role[];

// KHÔNG có field mật khẩu ở cả tạo mới lẫn sửa: người dùng tự đặt mật khẩu qua
// email lời mời, và tự đổi qua luồng quên mật khẩu. SUPER_ADMIN không chọn,
// không thấy, không gửi mật khẩu vĩnh viễn của tài khoản khác.

interface UserFormDialogProps {
  trigger: ReactNode;
  /** Có `user` = chế độ sửa; không có = tạo mới. */
  user?: AdminUser;
}

export function UserFormDialog({ trigger, user }: UserFormDialogProps) {
  const isEdit = user !== undefined;
  const [open, setOpen] = useState(false);
  const { user: currentUser } = useAuth();
  const createInvitation = useCreateUserInvitation();
  const updateUser = useUpdateUser();

  // Backend chặn tự đổi vai trò của chính mình — khóa sẵn ô chọn để người dùng
  // không chạm vào một thao tác chắc chắn thất bại.
  const isSelf = isEdit && user.id === currentUser?.id;

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: user?.name ?? "",
      email: user?.email ?? "",
      role: user?.role ?? "EDITOR",
    },
  });

  // Mở lại dialog phải thấy dữ liệu mới nhất của hàng đang sửa.
  useEffect(() => {
    if (open) {
      form.reset({
        name: user?.name ?? "",
        email: user?.email ?? "",
        role: user?.role ?? "EDITOR",
      });
    }
  }, [open, user, form]);

  async function onSubmit(values: UserFormValues) {
    try {
      if (isEdit) {
        await updateUser.mutateAsync({
          id: user.id,
          name: values.name,
          email: values.email,
          // Giữ nguyên vai trò khi sửa chính mình.
          ...(isSelf ? {} : { role: values.role }),
        });
        toast.success("Đã lưu thay đổi.");
      } else {
        // Luồng lời mời: KHÔNG gửi mật khẩu. Backend tạo tài khoản chờ thiết
        // lập và gửi email để người dùng tự đặt mật khẩu.
        await createInvitation.mutateAsync({
          name: values.name,
          email: values.email,
          role: values.role,
        });
        toast.success("Đã tạo tài khoản và gửi lời mời thiết lập mật khẩu.");
      }
      setOpen(false);
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          isEdit
            ? "Không lưu được thay đổi. Vui lòng thử lại."
            : "Không tạo được tài khoản. Vui lòng thử lại.",
        ),
      );
    }
  }

  const submitting = form.formState.isSubmitting;

  const formId = "user-form";

  return (
    <Form {...form}>
      <SplitModal
        open={open}
        onOpenChange={setOpen}
        trigger={trigger}
        size="default"
        title={isEdit ? "Sửa tài khoản" : "Thêm tài khoản"}
        description={
          isEdit
            ? "Cập nhật thông tin và vai trò. Nếu thay đổi vai trò, người dùng có thể cần đăng nhập lại."
            : "Hệ thống sẽ gửi email để người dùng tự thiết lập mật khẩu."
        }
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Hủy
            </Button>
            <Button type="submit" form={formId} disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Lưu thay đổi" : "Tạo tài khoản và gửi lời mời"}
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Họ tên</FormLabel>
                  <FormControl>
                    <Input placeholder="Nguyễn Văn A" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="off"
                      placeholder="ban@thienduc.vn"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vai trò</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSelf}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {roleOptions.map((role) => (
                        <SelectItem key={role} value={role}>
                          {roleLabel[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf && (
                    <FormDescription>
                      Bạn không thể tự đổi vai trò của mình. Nhờ một Super Admin
                      khác thực hiện.
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

        </form>
      </SplitModal>
    </Form>
  );
}
