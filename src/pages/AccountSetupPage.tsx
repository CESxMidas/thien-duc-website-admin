import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

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
import { acceptInvitation, validateInvitation } from "@/lib/api/auth";
import { LOGIN_PATH } from "@/lib/api/client";

// Mật khẩu khớp chính sách backend: tối thiểu 8, tối đa 128, xác nhận phải trùng.
const setupSchema = z
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

type SetupValues = z.infer<typeof setupSchema>;

type PageState = "validating" | "invalid" | "form" | "success";

const INVALID_MESSAGE =
  "Link thiết lập tài khoản không hợp lệ hoặc đã hết hạn.";

/**
 * Trang CÔNG KHAI (không cần đăng nhập) để người được mời tự đặt mật khẩu đầu
 * tiên. Token đọc từ query `?token=...`, giữ trong ref (không state hiển thị,
 * không localStorage/sessionStorage/cookie), và được xoá khỏi URL/history ngay
 * để không lộ qua referrer/lịch sử trình duyệt. Token không bao giờ được log
 * hay hiển thị.
 */
export function AccountSetupPage() {
  const navigate = useNavigate();
  const tokenRef = useRef<string>("");
  const [state, setState] = useState<PageState>("validating");

  const form = useForm<SetupValues>({
    resolver: zodResolver(setupSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  useEffect(() => {
    // Đọc token một lần rồi xoá khỏi URL (thay thế lịch sử, không thêm entry).
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token") ?? "";
    if (window.location.search) {
      window.history.replaceState(
        {},
        "",
        window.location.pathname,
      );
    }

    if (!token) {
      setState("invalid");
      return;
    }
    tokenRef.current = token;

    let active = true;
    validateInvitation(token)
      .then((res) => {
        if (!active) return;
        setState(res.valid ? "form" : "invalid");
      })
      .catch(() => {
        // Lỗi mạng hay 4xx đều coi như link không dùng được (không lộ lý do).
        if (active) setState("invalid");
      });

    return () => {
      active = false;
    };
  }, []);

  async function onSubmit(values: SetupValues) {
    try {
      await acceptInvitation({
        token: tokenRef.current,
        newPassword: values.newPassword,
        confirmPassword: values.confirmPassword,
      });
      // Xoá token khỏi bộ nhớ ngay sau khi dùng xong.
      tokenRef.current = "";
      setState("success");
      // Không tự đăng nhập — điều hướng về trang đăng nhập sau ít giây.
      setTimeout(() => navigate(LOGIN_PATH, { replace: true }), 2500);
    } catch {
      // Thông báo chung, không lộ chi tiết (hết hạn/đã dùng/thu hồi...).
      toast.error(INVALID_MESSAGE);
      setState("invalid");
    }
  }

  const submitting = form.formState.isSubmitting;

  return (
    <div className="flex min-h-screen flex-col justify-center bg-white px-6 py-12 sm:px-12">
      <div className="mx-auto w-full max-w-md">
        {/* Logo + tiêu đề thương hiệu */}
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-black/10 bg-white p-1.5 shadow-sm">
            <img
              src="/images/brand/logo-thien-duc.png"
              alt="Logo Thiên Đức"
              width={48}
              height={48}
              className="size-full object-contain"
            />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold text-ink">Thiên Đức</p>
            <p className="text-xs text-slate">Hệ thống quản trị</p>
          </div>
        </div>

        {state === "validating" && (
          <div className="flex items-center gap-3 text-slate">
            <Loader2 className="size-5 animate-spin" />
            <span>Đang kiểm tra link thiết lập...</span>
          </div>
        )}

        {state === "invalid" && (
          <div>
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50">
              <ShieldAlert className="size-6 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-ink">
              Link không hợp lệ
            </h1>
            <p className="mt-2 text-sm text-slate">{INVALID_MESSAGE}</p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => navigate(LOGIN_PATH, { replace: true })}
            >
              Quay lại đăng nhập
            </Button>
          </div>
        )}

        {state === "success" && (
          <div>
            <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-green-50">
              <CheckCircle2 className="size-6 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-ink">Hoàn tất</h1>
            <p className="mt-2 text-sm text-slate">
              Thiết lập mật khẩu thành công. Vui lòng đăng nhập để tiếp tục.
            </p>
            <Button
              className="mt-6"
              onClick={() => navigate(LOGIN_PATH, { replace: true })}
            >
              Quay lại đăng nhập
            </Button>
          </div>
        )}

        {state === "form" && (
          <div>
            <h1 className="text-2xl font-bold text-ink sm:text-3xl">
              Thiết lập tài khoản
            </h1>
            <p className="mt-2 text-sm text-slate">
              Vui lòng tạo mật khẩu để hoàn tất tài khoản CMS của bạn.
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
                      <FormLabel>Nhập lại mật khẩu</FormLabel>
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
                  className="w-full"
                  disabled={submitting}
                >
                  {submitting && <Loader2 className="size-4 animate-spin" />}
                  {submitting ? "Đang thiết lập..." : "Hoàn tất thiết lập"}
                </Button>
              </form>
            </Form>

            <p className="mt-8 text-center text-xs text-slate">
              <button
                type="button"
                className="underline hover:text-ink"
                onClick={() => navigate(LOGIN_PATH, { replace: true })}
              >
                Quay lại đăng nhập
              </button>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
