import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { UserFormDialog } from "@/components/users/UserFormDialog";

const createInvitationMutate = vi.fn(async (_input: unknown) => ({}));
const updateUserMutate = vi.fn(async (_input: unknown) => ({}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "me", email: "boss@thienduc.vn", role: "SUPER_ADMIN", name: "Boss" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api/queries", () => ({
  useCreateUserInvitation: () => ({ mutateAsync: createInvitationMutate }),
  useUpdateUser: () => ({ mutateAsync: updateUserMutate }),
}));

describe("UserFormDialog — chế độ tạo mới (luồng lời mời)", () => {
  beforeEach(() => {
    createInvitationMutate.mockClear();
    updateUserMutate.mockClear();
  });

  async function openCreateDialog() {
    render(<UserFormDialog trigger={<button>Thêm tài khoản</button>} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Thêm tài khoản" }),
    );
    // Chờ modal mở (tiêu đề "Thêm tài khoản").
    await screen.findByText("Thêm tài khoản", { selector: "h2, [id]" }).catch(
      () => undefined,
    );
  }

  it("KHÔNG hiển thị ô mật khẩu khi tạo mới", async () => {
    await openCreateDialog();
    expect(screen.queryByLabelText(/Mật khẩu/i)).toBeNull();
  });

  it("nút submit ghi 'Tạo tài khoản và gửi lời mời'", async () => {
    await openCreateDialog();
    expect(
      screen.getByRole("button", { name: /Tạo tài khoản và gửi lời mời/ }),
    ).toBeInTheDocument();
  });

  it("submit gọi createUserInvitation với payload KHÔNG chứa mật khẩu", async () => {
    await openCreateDialog();

    await userEvent.type(screen.getByLabelText(/Họ tên/i), "Người Mới");
    await userEvent.type(
      screen.getByLabelText(/Email/i),
      "moi@thienduc.vn",
    );
    // Vai trò mặc định EDITOR — không cần đổi.
    await userEvent.click(
      screen.getByRole("button", { name: /Tạo tài khoản và gửi lời mời/ }),
    );

    await waitFor(() => {
      expect(createInvitationMutate).toHaveBeenCalledTimes(1);
    });
    const payload = createInvitationMutate.mock.calls[0][0] as Record<
      string,
      unknown
    > & { password?: unknown };
    expect(payload).toMatchObject({
      name: "Người Mới",
      email: "moi@thienduc.vn",
      role: "EDITOR",
    });
    expect(payload).not.toHaveProperty("password");
  });
});
