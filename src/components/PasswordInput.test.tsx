import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { PasswordInput } from "@/components/PasswordInput";

/** Render ô mật khẩu có label liên kết để truy vấn bằng getByLabelText. */
function renderInput() {
  return render(
    <>
      <label htmlFor="pw">Mật khẩu</label>
      <PasswordInput id="pw" />
    </>,
  );
}

describe("PasswordInput — nút hiện/ẩn khả truy cập bàn phím", () => {
  it("mặc định ẩn (type=password), nút có nhãn 'Hiện mật khẩu'", () => {
    renderInput();
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute(
      "type",
      "password",
    );
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    // Vẫn là type="button" — không bao giờ submit form.
    expect(toggle).toHaveAttribute("type", "button");
  });

  it("nút nằm trong tab order tự nhiên và nhận focus bằng Tab", async () => {
    const user = userEvent.setup();
    renderInput();
    const input = screen.getByLabelText("Mật khẩu");
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });

    await user.tab();
    expect(input).toHaveFocus();
    // Tab kế tiếp phải tới được nút hiện/ẩn (trước đây tabIndex={-1} chặn điều này).
    await user.tab();
    expect(toggle).toHaveFocus();
  });

  it("Enter khi nút focus → hiện mật khẩu (password → text), nhãn đổi thành 'Ẩn mật khẩu'", async () => {
    const user = userEvent.setup();
    renderInput();
    const input = screen.getByLabelText("Mật khẩu");

    await user.tab();
    await user.tab(); // focus nút toggle
    await user.keyboard("{Enter}");

    expect(input).toHaveAttribute("type", "text");
    // Nhãn cập nhật và focus vẫn ở trên nút.
    expect(screen.getByRole("button", { name: "Ẩn mật khẩu" })).toHaveFocus();
  });

  it("Space khi nút focus → ẩn lại (text → password), nhãn trở về 'Hiện mật khẩu'", async () => {
    const user = userEvent.setup();
    renderInput();
    const input = screen.getByLabelText("Mật khẩu");

    await user.tab();
    await user.tab();
    await user.keyboard("{Enter}"); // hiện
    expect(input).toHaveAttribute("type", "text");

    await user.keyboard(" "); // Space → ẩn
    expect(input).toHaveAttribute("type", "password");
    expect(
      screen.getByRole("button", { name: "Hiện mật khẩu" }),
    ).toBeInTheDocument();
  });

  it("click chuột vẫn đảo trạng thái hiện/ẩn như cũ", async () => {
    const user = userEvent.setup();
    renderInput();
    const input = screen.getByLabelText("Mật khẩu");

    await user.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(input).toHaveAttribute("type", "text");
    await user.click(screen.getByRole("button", { name: "Ẩn mật khẩu" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("Enter trong ô mật khẩu submit form; kích hoạt nút toggle KHÔNG submit", async () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    const user = userEvent.setup();
    render(
      <form onSubmit={onSubmit}>
        <label htmlFor="pw">Mật khẩu</label>
        <PasswordInput id="pw" />
        <button type="submit">Gửi</button>
      </form>,
    );
    const input = screen.getByLabelText("Mật khẩu");

    // Enter trong input → submit đúng một lần.
    await user.click(input);
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);

    // Enter rồi Space trên nút toggle → chỉ đổi hiển thị, KHÔNG submit thêm.
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    toggle.focus();
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(input).toHaveAttribute("type", "password");
  });
});
