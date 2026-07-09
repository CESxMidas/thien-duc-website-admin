import { useState } from "react";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { resolveLoginError } from "@/lib/auth-error-message";
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
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      {/* ---- Cột form ---- */}
      <div className="flex min-h-screen flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-gold text-lg font-bold text-ink">
              TĐ
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold text-ink">Thiên Đức</p>
              <p className="text-xs text-slate">Hệ thống quản trị</p>
            </div>
          </div>

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

              <label className="flex items-center gap-2 text-sm text-slate">
                <input
                  type="checkbox"
                  className="size-4 rounded border-gray-300 accent-brand"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Ghi nhớ đăng nhập
              </label>

              <Button type="submit" className="w-full" disabled={submitting}>
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
            Chưa có tài khoản? Vui lòng liên hệ Super Admin để được cấp quyền
            truy cập.
          </p>
        </div>
      </div>

      {/* ---- Cột ảnh (ẩn trên mobile) ---- */}
      <div className="relative hidden lg:block">
        <img
          src="/images/login-hero.jpg"
          alt="Phối cảnh tổng thể Khu đô thị Hưng Phú — Thiên Đức"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Lớp phủ màu thương hiệu */}
        <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/25 to-transparent" />
        <div className="absolute inset-0 bg-brand/10 mix-blend-multiply" />

        {/* Nội dung trên ảnh */}
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <span className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
            Dự án tiêu biểu
          </span>
          <h2 className="mt-4 max-w-md text-3xl font-bold leading-tight">
            Khu đô thị Hưng Phú
          </h2>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Kiến tạo không gian sống hiện đại, hạ tầng đồng bộ tại TP. Thủ Đức —
            biểu tượng phát triển của Công ty Thiên Đức.
          </p>
        </div>
      </div>
    </div>
  );
}
