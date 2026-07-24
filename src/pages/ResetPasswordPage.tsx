import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

import { AuthLayout } from "@/components/layout/AuthLayout";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/PasswordInput";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { resetPassword, validatePasswordReset } from "@/lib/api/auth";
import {
  ApiRequestError,
  FORGOT_PASSWORD_PATH,
  LOGIN_PATH,
} from "@/lib/api/client";

// Mật khẩu khớp chính sách backend: tối thiểu 8, tối đa 128, xác nhận phải trùng.
const resetSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Mật khẩu phải có ít nhất 8 ký tự.")
      .max(128, "Mật khẩu tối đa 128 ký tự."),
    confirmPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu."),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Mật khẩu xác nhận không khớp.",
  });

type ResetValues = z.infer<typeof resetSchema>;

type PageState = "validating" | "invalid" | "form" | "success";

const INVALID_MESSAGE =
  "Link đặt lại mật khẩu không hợp lệ, đã được sử dụng hoặc đã hết hạn.";

/**
 * Trang CÔNG KHAI (không cần đăng nhập) để đặt lại mật khẩu bằng token gửi qua
 * email. Token đọc từ query `?token=...`, giữ trong ref (không state hiển thị,
 * không localStorage/sessionStorage/cookie/queryCache/global auth), và được xoá
 * khỏi URL/history ngay để không lộ qua referrer/lịch sử trình duyệt. Token
 * không bao giờ được log hay hiển thị.
 *
 * Đặt lại thành công KHÔNG tự đăng nhập — backend đã thu hồi mọi phiên cũ; người
 * dùng đăng nhập lại bằng mật khẩu mới.
 */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  // Bắt token NGAY trong thân render (một lần, có chốt) trước khi effect chạy —
  // để nó sống sót qua lần gọi effect kép của <StrictMode> ở dev: effect strip
  // URL rồi cleanup rồi chạy lại; nếu đọc token TRONG effect thì lần chạy thứ
  // hai sẽ thấy URL đã rỗng. Ref khởi tạo ở render thì được giữ nguyên.
  const tokenRef = useRef<string | null>(null);
  if (tokenRef.current === null) {
    tokenRef.current =
      new URLSearchParams(window.location.search).get("token") ?? "";
  }
  const [state, setState] = useState<PageState>("validating");

  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    // Xoá token khỏi URL ngay (thay thế lịch sử, không thêm entry) để không lộ
    // qua referrer/lịch sử. Token đã được bắt ở thân render nên strip an toàn.
    if (window.location.search) {
      window.history.replaceState({}, "", window.location.pathname);
    }

    const token = tokenRef.current ?? "";
    if (!token) {
      setState("invalid");
      return;
    }

    let active = true;
    validatePasswordReset(token)
      .then((res) => {
        if (!active) return;
        setState(res.valid ? "form" : "invalid");
      })
      .catch(() => {
        // Lỗi mạng hay 4xx đều coi như link không dùng được (không lộ lý do).
        // Trạng thái invalid vẫn có lối thoát rõ ràng (xin link mới / đăng nhập).
        if (active) setState("invalid");
      });

    // KHÔNG dọn tokenRef trong cleanup: cleanup chạy giữa hai lần gọi effect kép
    // của StrictMode, dọn ở đây sẽ làm lần chạy thứ hai mất token. Token được xoá
    // sau khi đặt lại thành công (dưới), còn khi rời trang thật thì ref tự bị thu
    // hồi cùng component. Chỉ cần cờ `active` để bỏ qua kết quả validate cũ.
    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: ResetValues) {
    try {
      await resetPassword({
        token: tokenRef.current ?? "",
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      // Xoá token khỏi bộ nhớ ngay sau khi dùng xong.
      tokenRef.current = "";
      setState("success");
    } catch (error) {
      // Phân biệt "token hỏng" với "mất mạng":
      // - Backend từ chối (status ≠ 0) → token hết hạn/đã dùng/bị thu hồi giữa
      //   lúc validate và submit → chuyển sang trạng thái không hợp lệ chung.
      // - Lỗi mạng (status 0) → giữ form để người dùng thử lại.
      if (error instanceof ApiRequestError && error.status !== 0) {
        tokenRef.current = "";
        setState("invalid");
      } else {
        toast.error("Không thể kết nối máy chủ. Vui lòng thử lại.");
      }
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <AuthLayout>
      {state === "validating" && (
        <div
          className="flex items-center gap-3 text-slate"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-5 animate-spin" />
          <span>Đang kiểm tra liên kết đặt lại...</span>
        </div>
      )}

      {state === "invalid" && (
        <div aria-live="polite">
          <div
            className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50"
            aria-hidden="true"
          >
            <ShieldAlert className="size-6 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Liên kết không còn hiệu lực
          </h1>
          <p className="mt-2 text-sm text-slate">{INVALID_MESSAGE}</p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button asChild className="h-11 sm:flex-1">
              <Link to={FORGOT_PASSWORD_PATH}>Yêu cầu liên kết mới</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 sm:flex-1">
              <Link to={LOGIN_PATH}>Quay lại đăng nhập</Link>
            </Button>
          </div>
        </div>
      )}

      {state === "success" && (
        <div aria-live="polite">
          <div
            className="mb-4 flex size-12 items-center justify-center rounded-full bg-green-50"
            aria-hidden="true"
          >
            <CheckCircle2 className="size-6 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Đặt lại mật khẩu thành công
          </h1>
          <p className="mt-2 text-sm text-slate">
            Mật khẩu của bạn đã được cập nhật. Vui lòng đăng nhập lại để tiếp
            tục.
          </p>
          <Button
            className="mt-6 h-11"
            onClick={() => navigate(LOGIN_PATH, { replace: true })}
          >
            Đăng nhập
          </Button>
        </div>
      )}

      {state === "form" && (
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">
            Đặt lại mật khẩu
          </h1>
          <p className="mt-2 text-sm text-slate">
            Tạo mật khẩu mới cho tài khoản CMS của bạn.
          </p>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="mt-8 space-y-4"
              noValidate
            >
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Mật khẩu mới</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        placeholder="Tối thiểu 8 ký tự"
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
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Xác nhận mật khẩu</FormLabel>
                    <FormControl>
                      <PasswordInput
                        autoComplete="new-password"
                        placeholder="Nhập lại mật khẩu"
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
                {submitting && <Loader2 className="size-4 animate-spin" />}
                {submitting ? "Đang đặt lại..." : "Đặt lại mật khẩu"}
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
        </div>
      )}
    </AuthLayout>
  );
}
