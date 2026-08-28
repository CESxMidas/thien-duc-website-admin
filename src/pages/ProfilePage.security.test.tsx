/**
 * Trang Thông tin cá nhân — khối "Bảo mật".
 *
 * Điểm cần khoá không phải là giao diện mà là RANH GIỚI giữa hai luồng:
 *   - hồ sơ   → `PATCH /users/me` → EDITOR phải chờ quản trị viên duyệt;
 *   - mật khẩu → `POST /auth/change-password` → hiệu lực ngay, không ai duyệt.
 * Nếu ô mật khẩu lọt vào biểu mẫu hồ sơ thì mật khẩu sẽ đi nhầm đường (và với
 * EDITOR là đi qua tay người duyệt) — đúng thứ kiến trúc backend đang cấm.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ProfilePage } from "@/pages/ProfilePage";
import type { MyProfile, Role } from "@/types";

const updateMutate = vi.hoisted(() => vi.fn());

const profile: MyProfile = {
  id: "me",
  name: "Nguyễn Văn A",
  email: "a@thienduc.vn",
  role: "ADMIN",
  phone: null,
  avatarUrl: null,
  position: null,
  department: null,
  bio: null,
  isActive: true,
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-01T00:00:00Z",
  pendingRequest: null,
};

let currentProfile: MyProfile = profile;

vi.mock("@/lib/api/queries", () => ({
  useMyProfile: () => ({ data: currentProfile, isLoading: false }),
  useUpdateMyProfile: () => ({
    mutateAsync: updateMutate,
    isPending: false,
  }),
}));

// Hộp thoại thật đã có bộ test riêng; ở đây chỉ cần biết nó được mở hay chưa.
vi.mock("@/components/profile/ChangePasswordDialog", () => ({
  ChangePasswordDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="change-password-dialog" /> : null,
}));

vi.mock("@/components/ui/ImagePickerField", () => ({
  ImagePickerField: () => <div data-testid="avatar-picker" />,
}));

function setProfile(role: Role) {
  currentProfile = { ...profile, role };
}

beforeEach(() => {
  vi.clearAllMocks();
  setProfile("ADMIN");
});

describe("ProfilePage — khối Bảo mật", () => {
  it("hiện mục Bảo mật kèm nút Đổi mật khẩu", () => {
    render(<ProfilePage />);

    expect(screen.getByText("Bảo mật")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Đổi mật khẩu/ }),
    ).toBeInTheDocument();
  });

  it("chưa bấm thì hộp thoại chưa mở", () => {
    render(<ProfilePage />);

    expect(
      screen.queryByTestId("change-password-dialog"),
    ).not.toBeInTheDocument();
  });

  it("bấm Đổi mật khẩu thì mở hộp thoại", async () => {
    const user = userEvent.setup();
    render(<ProfilePage />);

    await user.click(screen.getByRole("button", { name: /Đổi mật khẩu/ }));

    expect(screen.getByTestId("change-password-dialog")).toBeInTheDocument();
  });

  it("EDITOR cũng đổi được mật khẩu của chính mình", () => {
    // Đổi mật khẩu KHÔNG phụ thuộc vai trò: mọi tài khoản đều tự đổi được mật
    // khẩu của mình. (Khác hẳn nút lưu hồ sơ — EDITOR chỉ "Gửi yêu cầu duyệt".)
    setProfile("EDITOR");
    render(<ProfilePage />);

    expect(
      screen.getByRole("button", { name: /Đổi mật khẩu/ }),
    ).toBeInTheDocument();
  });

  it("KHÔNG có ô mật khẩu nào nằm trong biểu mẫu hồ sơ", () => {
    const { container } = render(<ProfilePage />);

    // Biểu mẫu hồ sơ đi PATCH /users/me — tuyệt đối không được mang mật khẩu.
    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(
      0,
    );
    expect(screen.queryByLabelText("Mật khẩu hiện tại")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mật khẩu mới")).not.toBeInTheDocument();
  });

  it("nút Đổi mật khẩu nằm NGOÀI <form> hồ sơ (không submit nhầm hồ sơ)", async () => {
    const user = userEvent.setup();
    const { container } = render(<ProfilePage />);

    const button = screen.getByRole("button", { name: /Đổi mật khẩu/ });
    const profileForm = container.querySelector("form");

    expect(profileForm).not.toBeNull();
    expect(profileForm?.contains(button)).toBe(false);

    // Và bấm nó không được kích hoạt mutation cập nhật hồ sơ.
    await user.click(button);
    expect(updateMutate).not.toHaveBeenCalled();
  });
});
