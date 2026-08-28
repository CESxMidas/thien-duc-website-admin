/**
 * Đổi mật khẩu khi đang đăng nhập — thứ dễ hỏng nhất KHÔNG phải là biểu mẫu mà
 * là hậu quả sau khi gọi API:
 *
 *  1. sai mật khẩu hiện tại (400) **không được** kích hoạt đăng xuất toàn cục;
 *  2. đổi thành công **phải** dọn token và về ĐÚNG `/admin/dang-nhap` — gán
 *     thẳng `/dang-nhap` sẽ rơi ra 404 của website công khai (bài học Batch 15B);
 *  3. payload gửi lên **không** được kèm `userId`.
 *
 * Bộ test khoá cả ba, cộng phần validate phía client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChangePasswordDialog } from "@/components/profile/ChangePasswordDialog";
import { ApiRequestError, LOGIN_PATH } from "@/lib/api/client";
import * as basePath from "@/lib/base-path";
import { withBase } from "@/lib/base-path";

const changePassword = vi.hoisted(() => vi.fn());
const clearTokens = vi.hoisted(() => vi.fn());
const toastSuccess = vi.hoisted(() => vi.fn());
const toastError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api/auth", () => ({ changePassword }));

vi.mock("sonner", () => ({
  toast: { success: toastSuccess, error: toastError },
}));

// Giữ NGUYÊN `ApiRequestError` và `LOGIN_PATH` thật, chỉ thay `clearTokens` —
// test phải kiểm đúng hằng số route mà production dùng, không phải bản giả.
vi.mock("@/lib/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/client")>();
  return { ...actual, clearTokens };
});

const assign = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  changePassword.mockResolvedValue({ success: true, message: "ok" });
  // jsdom không cho gán `window.location.assign` trực tiếp.
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, assign, pathname: "/admin/ho-so" },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

function setup() {
  const user = userEvent.setup();
  const onOpenChange = vi.fn();
  render(<ChangePasswordDialog open onOpenChange={onOpenChange} />);
  return { user, onOpenChange };
}

function fields() {
  return {
    current: screen.getByLabelText("Mật khẩu hiện tại"),
    next: screen.getByLabelText("Mật khẩu mới"),
    confirm: screen.getByLabelText("Xác nhận mật khẩu mới"),
    submit: screen.getByRole("button", { name: "Đổi mật khẩu" }),
  };
}

/** Điền một bộ giá trị hợp lệ rồi bấm gửi. */
async function submitValid(user: ReturnType<typeof userEvent.setup>) {
  const f = fields();
  await user.type(f.current, "MatKhauCu123");
  await user.type(f.next, "MatKhauMoi456");
  await user.type(f.confirm, "MatKhauMoi456");
  await user.click(f.submit);
}

describe("ChangePasswordDialog", () => {
  it("hiện đủ ba ô mật khẩu và hai nút", () => {
    setup();
    const f = fields();

    expect(f.current).toBeInTheDocument();
    expect(f.next).toBeInTheDocument();
    expect(f.confirm).toBeInTheDocument();
    expect(f.submit).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeInTheDocument();
  });

  it("cả ba ô đều là type=password (không lộ khi gõ)", () => {
    setup();
    const f = fields();

    expect(f.current).toHaveAttribute("type", "password");
    expect(f.next).toHaveAttribute("type", "password");
    expect(f.confirm).toHaveAttribute("type", "password");
  });

  it("bỏ trống thì báo lỗi bắt buộc và KHÔNG gọi API", async () => {
    const { user } = setup();

    await user.click(fields().submit);

    expect(
      await screen.findByText("Vui lòng nhập mật khẩu hiện tại."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("mật khẩu mới dưới 8 ký tự thì báo lỗi, không gọi API", async () => {
    const { user } = setup();
    const f = fields();

    await user.type(f.current, "MatKhauCu123");
    await user.type(f.next, "ngan12");
    await user.type(f.confirm, "ngan12");
    await user.click(f.submit);

    expect(
      await screen.findByText("Mật khẩu phải có ít nhất 8 ký tự."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("xác nhận không khớp thì báo lỗi, không gọi API", async () => {
    const { user } = setup();
    const f = fields();

    await user.type(f.current, "MatKhauCu123");
    await user.type(f.next, "MatKhauMoi456");
    await user.type(f.confirm, "MatKhauKhac789");
    await user.click(f.submit);

    expect(
      await screen.findByText("Mật khẩu xác nhận không khớp."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("mật khẩu mới trùng mật khẩu hiện tại thì báo lỗi, không gọi API", async () => {
    const { user } = setup();
    const f = fields();

    await user.type(f.current, "MatKhauCu123");
    await user.type(f.next, "MatKhauCu123");
    await user.type(f.confirm, "MatKhauCu123");
    await user.click(f.submit);

    expect(
      await screen.findByText("Mật khẩu mới phải khác mật khẩu hiện tại."),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("gửi ĐÚNG ba field, KHÔNG kèm userId", async () => {
    const { user } = setup();

    await submitValid(user);

    await waitFor(() => expect(changePassword).toHaveBeenCalledTimes(1));
    const payload = changePassword.mock.calls[0][0] as Record<string, unknown>;

    expect(payload).toEqual({
      currentPassword: "MatKhauCu123",
      newPassword: "MatKhauMoi456",
      confirmPassword: "MatKhauMoi456",
    });
    expect(Object.keys(payload)).not.toContain("userId");
  });

  it("đổi thành công thì dọn token rồi điều hướng về trang đăng nhập", async () => {
    const { user } = setup();

    await submitValid(user);

    await waitFor(() => expect(clearTokens).toHaveBeenCalledTimes(1));
    expect(toastSuccess).toHaveBeenCalledWith(
      "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
    );
    expect(assign).toHaveBeenCalledTimes(1);
    // Dưới vitest `import.meta.env.BASE_URL` là "/" nên đích rút gọn còn
    // `/dang-nhap`. Việc ghép tiền tố `/admin` do `withBase` lo và đã được
    // `base-path.test.ts` khoá riêng; test kế bên chứng minh hộp thoại có ĐI
    // QUA helper đó thay vì gõ cứng đường dẫn.
    expect(assign).toHaveBeenCalledWith(withBase(LOGIN_PATH));
  });

  it("đích điều hướng đi QUA withBase — base /admin/ ra /admin/dang-nhap", async () => {
    // Giả lập bản build production (base `/admin/`). Đây là chốt chặn hồi quy
    // Batch 15B: gán thẳng LOGIN_PATH sẽ đưa người dùng ra `/dang-nhap` —
    // trang 404 của website công khai, không phải trang đăng nhập CMS.
    const spy = vi
      .spyOn(basePath, "withBase")
      .mockImplementation((path: string) => `/admin${path}`);

    const { user } = setup();
    await submitValid(user);

    await waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
    expect(spy).toHaveBeenCalledWith(LOGIN_PATH);
    expect(assign).toHaveBeenCalledWith("/admin/dang-nhap");
  });

  it("sai mật khẩu hiện tại (400): hiện message của backend, KHÔNG đăng xuất", async () => {
    changePassword.mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "BAD_REQUEST",
        message: "Mật khẩu hiện tại không đúng.",
      }),
    );
    const { user } = setup();

    await submitValid(user);

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Mật khẩu hiện tại không đúng."),
    );
    // Đây là điểm mấu chốt: gõ nhầm mật khẩu KHÔNG được đá người dùng ra ngoài.
    expect(clearTokens).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
  });

  it("sai mật khẩu hiện tại: giữ nguyên hộp thoại để nhập lại", async () => {
    changePassword.mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "BAD_REQUEST",
        message: "Mật khẩu hiện tại không đúng.",
      }),
    );
    const { user, onOpenChange } = setup();

    await submitValid(user);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByLabelText("Mật khẩu hiện tại")).toBeInTheDocument();
  });

  it("bấm Hủy thì đóng hộp thoại, không gọi API", async () => {
    const { user, onOpenChange } = setup();

    await user.click(screen.getByRole("button", { name: "Hủy" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(changePassword).not.toHaveBeenCalled();
  });
});
