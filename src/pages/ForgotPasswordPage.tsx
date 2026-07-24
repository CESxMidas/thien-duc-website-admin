import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Send } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { requestPasswordReset } from "@/lib/api/auth";
import { LOGIN_PATH } from "@/lib/api/client";

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Vui lòng nhập email.")
    .email("Email không đúng định dạng."),
});

type ForgotValues = z.infer<typeof forgotSchema>;

type PageState = "form" | "sent";

/**
 * Trang CÔNG KHAI: yêu cầu email đặt lại mật khẩu. Phản hồi LUÔN trung tính —
 * dù email có tồn tại hay không, người dùng đều thấy cùng một màn hình "đã gửi"
 * để không lộ tài khoản nào có trong hệ thống (chống dò email).
 *
 * Email đã gửi được giữ trong ref (không hiển thị) chỉ để phục vụ nút "Gửi lại"
 * — backend đã có cooldown 60 giây nên bấm lại trong thời gian đó chỉ no-op an
 * toàn, không spam mail.
 */
export function ForgotPasswordPage() {
  const [state, setState] = useState<PageState>("form");
  const [resending, setResending] = useState(false);
  // Giữ email đã gửi để "Gửi lại" — KHÔNG hiển thị ra UI (không lộ/gợi ý tài khoản).
  const lastEmailRef = useRef<string>("");

  const form = useForm<ForgotValues>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotValues) {
    try {
      await requestPasswordReset(values.email);
      lastEmailRef.current = values.email;
      setState("sent");
    } catch {
      // Lỗi mạng/máy chủ thật (không phải "email không tồn tại" — cái đó backend
      // trả 2xx trung tính). Không lộ chi tiết kỹ thuật, cho phép thử lại.
      toast.error("Không thể gửi yêu cầu ngay lúc này. Vui lòng thử lại sau.");
    }
  }

  async function handleResend() {
    if (!lastEmailRef.current || resending) return;
    setResending(true);
    try {
      await requestPasswordReset(lastEmailRef.current);
      toast.success("Đã gửi lại. Vui lòng kiểm tra hộp thư của bạn.");
    } catch {
      toast.error("Không thể gửi lại ngay lúc này. Vui lòng thử lại sau.");
    } finally {
      setResending(false);
    }
  }

  const submitting = form.formState.isSubmitting;

  if (state === "sent") {
    return (
      <AuthLayout>
        <div aria-live="polite">
          <div
            className="mb-4 flex size-12 items-center justify-center rounded-full bg-cream"
            aria-hidden="true"
          >
            <Mail className="size-6 text-brand" />
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Kiểm tra email của bạn
          </h1>
          <p className="mt-2 text-sm text-slate">
            Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được
            gửi.
          </p>
          <p className="mt-2 text-sm text-slate">
            Liên kết đặt lại mật khẩu có hiệu lực trong 20 phút.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 sm:flex-1">
              <Link to={LOGIN_PATH}>Quay lại đăng nhập</Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:flex-1"
              onClick={handleResend}
              disabled={resending}
            >
              {resending && <Loader2 className="size-4 animate-spin" />}
              {resending ? "Đang gửi lại..." : "Gửi lại"}
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-bold text-ink sm:text-3xl">
        Quên mật khẩu?
      </h1>
      <p className="mt-2 text-sm text-slate">
        Nhập email tài khoản CMS. Nếu email tồn tại trong hệ thống, chúng tôi sẽ
        gửi hướng dẫn đặt lại mật khẩu.
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
                    autoComplete="email"
                    placeholder="ban@thienduc.vn"
                    autoFocus
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            className="h-11 w-full"
            disabled={submitting}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            {submitting ? "Đang gửi..." : "Gửi hướng dẫn đặt lại mật khẩu"}
          </Button>
        </form>
      </Form>

      <p className="mt-8 text-center text-xs text-slate">
        <Link
          to={LOGIN_PATH}
          className="rounded-sm underline underline-offset-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        >
          Quay lại đăng nhập
        </Link>
      </p>
    </AuthLayout>
  );
}
