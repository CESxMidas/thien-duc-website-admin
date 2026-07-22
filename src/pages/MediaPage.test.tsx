import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { MediaPage } from "@/pages/MediaPage";
import type { MediaAsset } from "@/types";
import type { Role } from "@/types";

/**
 * ADMIN-ROLE-VISIBILITY-AUDIT-M1 / R1: nút xóa ảnh (thao tác phá hủy) chỉ hiện
 * với ADMIN/SUPER_ADMIN. EDITOR vẫn tải ảnh lên nhưng không thấy nút xóa — khớp
 * `@Roles(ADMIN, SUPER_ADMIN)` ở `DELETE /media/:id`.
 */

const asset: MediaAsset = {
  id: "m1",
  url: "https://res.cloudinary.com/demo/image/upload/projects/anh-mau.webp",
  publicId: "projects/anh-mau",
  width: 1200,
  height: 800,
  format: "webp",
  bytes: 152000,
  folder: "projects",
  uploadedById: "u1",
  createdAt: "2026-07-01T00:00:00Z",
};

// Vai trò hiện tại của phiên test — đổi trước mỗi lần render để phủ 3 vai trò.
let currentRole: Role = "EDITOR";

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", email: "u@thienduc.vn", role: currentRole, name: "U" },
    isAuthenticated: true,
    isLoading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock("@/lib/api/queries", () => {
  const mutation = {
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  };
  return {
    useMedia: () => ({ data: [asset], isLoading: false }),
    useUploadMedia: () => mutation,
    useDeleteMedia: () => mutation,
  };
});

function renderMediaPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MediaPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MediaPage — quyền xóa ảnh theo vai trò", () => {
  beforeEach(() => {
    currentRole = "EDITOR";
  });

  it("EDITOR: thấy nút Tải ảnh lên nhưng KHÔNG thấy nút xóa", () => {
    currentRole = "EDITOR";
    renderMediaPage();
    expect(
      screen.getByRole("button", { name: /Tải ảnh lên/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Xóa ảnh/ })).toBeNull();
  });

  it("ADMIN: thấy nút xóa ảnh", () => {
    currentRole = "ADMIN";
    renderMediaPage();
    expect(
      screen.getByRole("button", { name: /^Xóa ảnh/ }),
    ).toBeInTheDocument();
  });

  it("SUPER_ADMIN: thấy nút xóa ảnh", () => {
    currentRole = "SUPER_ADMIN";
    renderMediaPage();
    expect(
      screen.getByRole("button", { name: /^Xóa ảnh/ }),
    ).toBeInTheDocument();
  });
});
