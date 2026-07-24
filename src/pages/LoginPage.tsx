import { useState } from "react";
import {
  useNavigate,
  useLocation,
  Navigate,
  Link,
} from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { resolveLoginError } from "@/lib/auth-error-message";
import { FORGOT_PASSWORD_PATH } from "@/lib/api/client";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/PasswordInput";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng."),
  password: z
    .string()
    .min(1, "Vui lòng nhập mật khẩu.")
    .min(8, "Mật khẩu phải có ít nhất 8 ký tự."),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { user, isLoading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [remember, setRemember] = useState(true);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const from =
    (location.state as { from?: { pathname: string } } | null)?.from
      ?.pathname ?? "/";

  // Đang khôi phục phiên (đổi refresh token) → chưa vẽ form để tránh nháy.
  if (isLoading) return null;

  // Đã đăng nhập mà vào /dang-nhap → về Dashboard (hoặc route đã lưu).
  if (user) return <Navigate to={from} replace />;

  async function onSubmit(values: LoginValues) {
    try {
      await login(values.email, values.password, remember);
      toast.success("Đăng nhập thành công.");
      navigate(from, { replace: true });
    } catch (error) {
      // Lỗi phía server (đã qua validate client) → toast + xóa mật khẩu, giữ email.
      toast.error(resolveLoginError(error));
      form.resetField("password");
      form.setFocus("password");
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Đăng nhập hệ thống quản trị
      </h1>
      <p className="mt-2 text-sm text-slate">
        Chào mừng trở lại! Đăng nhập để quản lý dự án, tin tức và nội dung
        website Thiên Đức.
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mt-8 space-y-4"
          noValidate
        >
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="ban@thienduc.vn"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mật khẩu</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Ghi nhớ + Quên mật khẩu trên cùng một hàng: link phụ, không cạnh
              tranh với nút "Đăng nhập" đặc màu thương hiệu bên dưới. */}
          <div className="flex items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm text-slate">
              <input
                type="checkbox"
                className="size-4 rounded border-line-strong accent-brand"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Ghi nhớ đăng nhập
            </label>
            <Link
              to={FORGOT_PASSWORD_PATH}
              className="rounded-sm text-sm font-medium text-brand transition-colors hover:text-brand-dark hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              Quên mật khẩu?
            </Link>
          </div>

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <LogIn className="size-4" />
            )}
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </Form>

      <p className="mt-8 text-center text-xs text-slate">
        Chưa có tài khoản? Vui lòng liên hệ Super Admin để được cấp quyền truy
        cập.
      </p>
    </AuthLayout>
  );
}
