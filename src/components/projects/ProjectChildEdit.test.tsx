/**
 * **Batch 8 (mở rộng) — thao tác trên nội dung CON của dự án khớp chốt backend.**
 *
 * Hạng mục và ảnh thư viện không có trạng thái xuất bản riêng: chúng ra công khai
 * vì dự án cha ra công khai. Nên khi cha là PUBLISHED, EDITOR không được thấy bất
 * kỳ thao tác con nào — backend trả 403 cho tất cả. ADMIN trở lên giữ nguyên
 * (luồng đính chính trên dự án đang chạy).
 *
 * Test render THẲNG hai tab thay vì đi qua modal chi tiết: chốt cần khoá là ma
 * trận vai trò × trạng thái cha, không phải cách mở modal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactElement } from "react";

import { ProjectItemsTab } from "@/components/projects/ProjectItemsTab";
import { ProjectGalleryTab } from "@/components/projects/ProjectGalleryTab";
import type {
  ContentStatus,
  ProjectDetail,
  ProjectGalleryImage,
  ProjectItem,
  Role,
} from "@/types";

const { role } = vi.hoisted(() => ({ role: { current: "EDITOR" as Role } }));

vi.mock("@/lib/api/queries", () => {
  const mutation = () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn(async () => {}),
    isPending: false,
  });
  return {
    queryKeys: {},
    useCreateProjectItem: mutation,
    useUpdateProjectItem: mutation,
    useDeleteProjectItem: mutation,
    useAddGalleryImage: mutation,
    useDeleteGalleryImage: mutation,
    useReorderGallery: mutation,
    useMedia: () => ({ data: [], isLoading: false }),
    useUploadMedia: mutation,
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "A", email: "a@b.c", role: role.current },
    isAuthenticated: true,
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const NOW = "2026-08-01T01:00:00.000Z";

const item: ProjectItem = {
  id: "item-1",
  projectId: "p1",
  slug: "hang-muc",
  title: { vi: "Hạng mục A" },
  summary: null,
  description: null,
  highlights: null,
  quickFacts: null,
  status: null,
  image: null,
  order: 0,
  createdAt: NOW,
  updatedAt: NOW,
};

const image: ProjectGalleryImage = {
  id: "img-1",
  projectId: "p1",
  projectItemId: null,
  url: "/images/a.jpg",
  caption: { vi: "Ảnh A" },
  order: 0,
  createdAt: NOW,
};

/**
 * Dự án cha ở một trạng thái xuất bản cho trước.
 *
 * Batch 9 thêm `publishedAt`/`scheduledAt`, và vị từ quyền sửa đọc cả hai. Mặc
 * định ở đây là nội dung CHƯA từng công khai, chưa hẹn giờ — trừ khi cha đã
 * `PUBLISHED` thì mốc công khai phải có thật. `schedule` cho phép dựng riêng ca
 * "đã lên lịch" / "nháp từng đăng" của Batch 9.
 */
function makeProject(
  contentStatus: ContentStatus,
  schedule: { publishedAt?: string | null; scheduledAt?: string | null } = {},
): ProjectDetail {
  return {
    id: "p1",
    slug: "du-an",
    title: { vi: "Dự án" },
    summary: { vi: "Tóm tắt." },
    description: null,
    status: "DANG_THI_CONG",
    contentStatus,
    publishedAt:
      schedule.publishedAt ?? (contentStatus === "PUBLISHED" ? NOW : null),
    scheduledAt: schedule.scheduledAt ?? null,
    location: null,
    image: null,
    category: null,
    highlights: null,
    quickFacts: null,
    gallery: [],
    gallerySections: null,
    mapLocation: null,
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
    items: [item],
    galleryImages: [image],
  };
}

beforeEach(() => {
  role.current = "EDITOR";
});

function renderTab(ui: ReactElement) {
  render(ui);
}

/* ------------------------------- Hạng mục -------------------------------- */

describe("ProjectItemsTab — thao tác theo vai trò × trạng thái cha", () => {
  it.each(["DRAFT", "PENDING"] as ContentStatus[])(
    "EDITOR + cha %s: có Thêm hạng mục và Sửa",
    (contentStatus) => {
      renderTab(<ProjectItemsTab project={makeProject(contentStatus)} />);

      expect(
        screen.getByRole("button", { name: /Thêm hạng mục/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
    },
  );

  it("EDITOR + cha PUBLISHED: KHÔNG có thao tác nào, có ghi chú lý do", () => {
    renderTab(<ProjectItemsTab project={makeProject("PUBLISHED")} />);

    expect(screen.queryByRole("button", { name: /Thêm hạng mục/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sửa/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa hạng mục" })).toBeNull();
    expect(
      screen.getByText(/chỉ quản trị viên sửa được hạng mục/),
    ).toBeInTheDocument();
  });

  it("EDITOR + cha PUBLISHED: vẫn ĐỌC được danh sách hạng mục", () => {
    renderTab(<ProjectItemsTab project={makeProject("PUBLISHED")} />);

    expect(screen.getByText("Hạng mục A")).toBeInTheDocument();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s + cha PUBLISHED: giữ nguyên thêm / sửa / xóa",
    (currentRole) => {
      role.current = currentRole;
      renderTab(<ProjectItemsTab project={makeProject("PUBLISHED")} />);

      expect(
        screen.getByRole("button", { name: /Thêm hạng mục/ }),
      ).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Sửa/ })).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Xóa hạng mục" }),
      ).toBeInTheDocument();
    },
  );
});

/**
 * **Batch 9 — cha ĐÃ LÊN LỊCH cũng phải khoá nội dung con.**
 *
 * Trước Batch 9 điều kiện chỉ là `PUBLISHED`, mà một dự án đã hẹn giờ vẫn lưu là
 * `PENDING` — để nguyên thì EDITOR sửa được hạng mục của bản sắp tự ra công khai.
 */
describe("ProjectItemsTab — cha đã lên lịch / từng đăng", () => {
  const FUTURE = "2099-08-20T01:00:00.000Z";

  it.each([
    ["đã lên lịch", { publishedAt: FUTURE, scheduledAt: FUTURE }],
    ["đã đến giờ đăng", { publishedAt: NOW, scheduledAt: NOW }],
    ["nháp từng đăng", { publishedAt: NOW, scheduledAt: null }],
  ] as const)("EDITOR + cha %s: không còn thao tác nào", (_label, schedule) => {
    const contentStatus: ContentStatus =
      schedule.scheduledAt === null ? "DRAFT" : "PENDING";
    renderTab(
      <ProjectItemsTab project={makeProject(contentStatus, schedule)} />,
    );

    expect(screen.queryByRole("button", { name: /Thêm hạng mục/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Sửa/ })).toBeNull();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s + cha đã lên lịch: giữ nguyên thao tác",
    (currentRole) => {
      role.current = currentRole;
      renderTab(
        <ProjectItemsTab
          project={makeProject("PENDING", {
            publishedAt: FUTURE,
            scheduledAt: FUTURE,
          })}
        />,
      );

      expect(
        screen.getByRole("button", { name: /Thêm hạng mục/ }),
      ).toBeInTheDocument();
    },
  );
});

/* ------------------------------ Thư viện ảnh ----------------------------- */

describe("ProjectGalleryTab — thao tác theo vai trò × trạng thái cha", () => {
  const galleryActions = [
    "Thêm ảnh",
    "Đưa ảnh lên trước",
    "Đưa ảnh xuống sau",
    "Xóa ảnh",
  ];

  it.each(["DRAFT", "PENDING"] as ContentStatus[])(
    "EDITOR + cha %s: có đủ thao tác thư viện",
    (contentStatus) => {
      renderTab(<ProjectGalleryTab project={makeProject(contentStatus)} />);

      for (const label of galleryActions) {
        expect(
          screen.getByRole("button", { name: label }),
        ).toBeInTheDocument();
      }
    },
  );

  it("EDITOR + cha PUBLISHED: KHÔNG có thêm / sắp xếp / xóa ảnh", () => {
    renderTab(<ProjectGalleryTab project={makeProject("PUBLISHED")} />);

    for (const label of galleryActions) {
      expect(screen.queryByRole("button", { name: label })).toBeNull();
    }
    expect(
      screen.getByText(/chỉ quản trị viên sửa được thư viện ảnh/),
    ).toBeInTheDocument();
  });

  it("EDITOR + cha PUBLISHED: vẫn XEM được ảnh đã có", () => {
    renderTab(<ProjectGalleryTab project={makeProject("PUBLISHED")} />);

    expect(screen.getByText("Ảnh A")).toBeInTheDocument();
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s + cha PUBLISHED: giữ nguyên đủ thao tác thư viện",
    (currentRole) => {
      role.current = currentRole;
      renderTab(<ProjectGalleryTab project={makeProject("PUBLISHED")} />);

      for (const label of galleryActions) {
        expect(
          screen.getByRole("button", { name: label }),
        ).toBeInTheDocument();
      }
    },
  );
});
