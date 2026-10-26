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

import { useEffect, useRef, useState } from "react";
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
import { changePassword, requestPasswordChangeCode } from "@/lib/api/auth";
import type { PasswordChangeChallenge } from "@/types";
import { ApiRequestError, clearTokens, LOGIN_PATH } from "@/lib/api/client";
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
  const [challenge, setChallenge] = useState<PasswordChangeChallenge | null>(
    null,
  );
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const codeInput = useRef<HTMLInputElement>(null);

  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: EMPTY,
  });

  // Mở lại là sạch: không giữ mật khẩu của lượt trước trong state, cũng không
  // giữ lỗi cũ khiến người dùng tưởng vừa nhập sai.
  useEffect(() => {
    form.reset(EMPTY);
    setSubmitting(false);
    setChallenge(null);
    setCode("");
    setCodeError(null);
  }, [open, form]);

  useEffect(() => {
    if (!open || !challenge) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [open, challenge]);

  const resendWait = challenge
    ? Math.max(
        0,
        Math.ceil((Date.parse(challenge.resendAvailableAt) - now) / 1000),
      )
    : 0;
  const expired = challenge ? now >= Date.parse(challenge.expiresAt) : false;

  async function sendCode(values: ChangePasswordValues) {
    setSubmitting(true);
    setCodeError(null);
    try {
      const next = await requestPasswordChangeCode({
        currentPassword: values.currentPassword,
      });
      setChallenge(next);
      setCode("");
      setNow(Date.now());
    } catch (error) {
      const message =
        error instanceof ApiRequestError && error.status === 429
          ? "Vui lòng chờ ít nhất 60 giây trước khi gửi lại mã."
          : resolveApiError(
              error,
              "Không gửi được mã xác nhận. Vui lòng thử lại sau.",
            );
      setCodeError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSubmit(values: ChangePasswordValues) {
    if (!challenge) {
      await sendCode(values);
      return;
    }
    if (expired) {
      setCodeError("Mã đã hết hạn. Hãy gửi lại mã để tiếp tục.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setCodeError("Vui lòng nhập đủ 6 chữ số.");
      codeInput.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({
        challengeId: challenge.challengeId,
        verificationCode: code,
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
      setCodeError(message);
      codeInput.current?.focus();
      setSubmitting(false);
    }
  }

  return (
    <SplitModal
      open={open}
      onOpenChange={(value) => {
        if (!submitting) onOpenChange(value);
      }}
      size="default"
      title="Đổi mật khẩu"
      description={
        challenge
          ? `Nhập mã 6 số đã gửi tới ${challenge.maskedEmail}. Mã có hiệu lực 10 phút và chỉ dùng một lần.`
          : "Nhập mật khẩu mới, sau đó xác nhận bằng mã gửi tới email của tài khoản."
      }
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
            disabled={submitting || Boolean(challenge && expired)}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {challenge ? "Xác nhận đổi mật khẩu" : "Gửi mã xác nhận"}
          </Button>
        </>
      }
    >
      {challenge ? (
        <form
          noValidate
          id="change-password-form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit(form.getValues());
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <label
              htmlFor="password-verification-code"
              className="text-sm font-medium"
            >
              Mã xác nhận
            </label>
            <Input
              ref={codeInput}
              id="password-verification-code"
              autoFocus
              autoComplete="one-time-code"
              inputMode="numeric"
              maxLength={6}
              pattern="[0-9]{6}"
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setCodeError(null);
              }}
              disabled={submitting || expired}
              aria-invalid={Boolean(codeError)}
              aria-describedby={
                codeError
                  ? "password-code-help password-code-error"
                  : "password-code-help"
              }
              className="h-12 text-center text-xl tracking-[0.4em]"
            />
            <p id="password-code-help" className="text-sm text-slate">
              {expired
                ? "Mã đã hết hạn. Hãy gửi lại mã để tiếp tục."
                : "Kiểm tra hộp thư đến và thư rác. Không chia sẻ mã với người khác."}
            </p>
          </div>
          <p className="text-sm text-slate">
            Sau khi xác nhận, bạn cần đăng nhập lại bằng mật khẩu mới.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={submitting || resendWait > 0}
              onClick={() => void sendCode(form.getValues())}
            >
              {resendWait > 0 ? `Gửi lại sau ${resendWait}s` : "Gửi lại mã"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={submitting}
              onClick={() => {
                setChallenge(null);
                setCode("");
                setCodeError(null);
              }}
            >
              Sửa mật khẩu
            </Button>
          </div>
        </form>
      ) : (
        <Form {...form}>
          <form
            id="change-password-form"
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <fieldset disabled={submitting} className="space-y-4">
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
            </fieldset>
          </form>
        </Form>
      )}
      {codeError && (
        <p
          id="password-code-error"
          role="alert"
          className="mt-3 text-sm text-destructive"
        >
          {codeError}
        </p>
      )}
    </SplitModal>
  );
}
