import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CompanyContactPage } from "./CompanyContactPage";

const state = vi.hoisted(() => ({
  data: {
    phone: "0909 768 001",
    email: "contact@thienduc.vn",
    taxCode: "0309910290",
    address: { vi: "Địa chỉ công ty", en: "Company address" },
  },
  isPending: false,
  isError: false,
  hasData: true,
  busy: false,
  save: vi.fn(),
  refetch: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/lib/api/queries", () => ({
  useCompanyContact: () => ({
    data: state.hasData ? state.data : undefined,
    isPending: state.isPending,
    isError: state.isError,
    refetch: state.refetch,
  }),
  useUpdateCompanyContact: () => ({
    mutateAsync: state.save,
    isPending: state.busy,
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: state.success, error: state.error },
}));
beforeEach(() => {
  vi.clearAllMocks();
  state.isPending = false;
  state.isError = false;
  state.hasData = true;
  state.busy = false;
  state.save.mockImplementation(async (values) => values);
});

describe("Quản lý thông tin liên hệ công ty", () => {
  it("đọc dữ liệu, xem trước, lưu dữ liệu đã chuẩn hoá và đánh dấu không còn thay đổi", async () => {
    const user = userEvent.setup();
    render(<CompanyContactPage />);
    expect(
      screen.getByRole("button", { name: "Lưu thông tin" }),
    ).toBeDisabled();
    const phone = screen.getByRole("textbox", { name: "Số điện thoại *" });
    await user.clear(phone);
    await user.type(phone, "028 1234 5678");
    expect(screen.getByText("028 1234 5678")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        ...state.data,
        phone: "028 1234 5678",
      }),
    );
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Lưu thông tin" }),
      ).toBeDisabled(),
    );
    expect(state.success).toHaveBeenCalled();
  });

  it("báo lỗi tại trường và focus email sai, không gửi API", async () => {
    const user = userEvent.setup();
    render(<CompanyContactPage />);
    const email = screen.getByRole("textbox", { name: "Email liên hệ *" });
    await user.clear(email);
    await user.type(email, "sai-email");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    expect(await screen.findByText("Email không hợp lệ.")).toBeInTheDocument();
    expect(email).toHaveAttribute("aria-invalid", "true");
    await waitFor(() => expect(email).toHaveFocus());
    expect(state.save).not.toHaveBeenCalled();
  });

  it("lưu lỗi giữ nội dung để thử lại, bỏ thay đổi trả về dữ liệu đã lưu", async () => {
    const user = userEvent.setup();
    state.save.mockRejectedValue(new Error("offline"));
    render(<CompanyContactPage />);
    const field = screen.getByRole("textbox", { name: "Địa chỉ tiếng Việt *" });
    await user.clear(field);
    await user.type(field, "Địa chỉ đang sửa");
    await user.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => expect(state.error).toHaveBeenCalled());
    expect(field).toHaveValue("Địa chỉ đang sửa");
    await user.click(screen.getByRole("button", { name: "Bỏ thay đổi" }));
    expect(field).toHaveValue(state.data.address.vi);
  });

  it("không hiển thị form trống khi tải lỗi; có thử lại", async () => {
    state.isError = true;
    state.hasData = false;
    const user = userEvent.setup();
    render(<CompanyContactPage />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(state.refetch).toHaveBeenCalled();
  });

  it("không mất nội dung đang sửa khi tải lại dữ liệu nền bị lỗi", async () => {
    const user = userEvent.setup();
    const view = render(<CompanyContactPage />);
    const phone = screen.getByRole("textbox", { name: "Số điện thoại *" });
    await user.clear(phone);
    await user.type(phone, "028 1234 5678");
    state.isError = true;
    view.rerender(<CompanyContactPage />);
    expect(
      screen.getByRole("textbox", { name: "Số điện thoại *" }),
    ).toHaveValue("028 1234 5678");
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("khoá các trường và nút trong khi lưu", () => {
    state.busy = true;
    render(<CompanyContactPage />);
    expect(
      screen.getByRole("textbox", { name: "Số điện thoại *" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
  });
});
