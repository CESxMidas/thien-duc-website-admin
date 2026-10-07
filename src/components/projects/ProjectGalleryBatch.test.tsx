import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectGalleryTab } from "@/components/projects/ProjectGalleryTab";
import type { ProjectDetail } from "@/types";

const { addGalleryImage, updateProject } = vi.hoisted(() => ({
  addGalleryImage: vi.fn(async () => ({})),
  updateProject: vi.fn(async () => ({})),
}));

vi.mock("@/components/ui/ImagePickerField", () => ({
  ImagePickerField: ({ value }: { value: string }) => (
    <div data-testid="image-picker-field">{value || "Chưa có ảnh chính"}</div>
  ),
  MultiImagePickerField: ({
    onChange,
    footer,
  }: {
    onChange: (urls: string[]) => void;
    footer?: React.ReactNode;
  }) => (
    <div>
      <button
        type="button"
        onClick={() => onChange(["/images/a.webp", "/images/b.webp"])}
      >
        Chọn 2 ảnh giả
      </button>
      {footer}
    </div>
  ),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", role: "ADMIN", name: "Admin", email: "a@b.c" },
  }),
}));

vi.mock("@/lib/api/queries", () => {
  const idleMutation = {
    mutateAsync: vi.fn(async () => ({})),
    isPending: false,
  };
  return {
    useAddGalleryImage: () => ({
      mutateAsync: addGalleryImage,
      isPending: false,
    }),
    useDeleteGalleryImage: () => idleMutation,
    useUpdateGalleryImage: () => idleMutation,
    useReorderGallery: () => idleMutation,
    useUpdateProject: () => ({
      mutateAsync: updateProject,
      isPending: false,
    }),
    useUpdateProjectItem: () => idleMutation,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const project: ProjectDetail = {
  id: "p1",
  slug: "du-an",
  title: { vi: "Dự án" },
  summary: { vi: "Tóm tắt" },
  description: null,
  status: "DANG_THI_CONG",
  contentStatus: "DRAFT",
  publishedAt: null,
  scheduledAt: null,
  location: null,
  image: null,
  category: null,
  highlights: null,
  quickFacts: null,
  gallery: [],
  gallerySections: null,
  mapLocation: null,
  order: 0,
  createdAt: "2026-09-26T00:00:00Z",
  updatedAt: "2026-09-26T00:00:00Z",
  items: [],
  galleryImages: [],
};

describe("ProjectGalleryTab — thêm ảnh theo lô", () => {
  it("gửi toàn bộ ảnh đã chọn vào gallery bằng một lần bấm", async () => {
    const user = userEvent.setup();
    addGalleryImage.mockClear();
    render(<ProjectGalleryTab project={project} />);

    await user.click(screen.getByRole("button", { name: "Chọn 2 ảnh giả" }));
    await user.click(screen.getByRole("button", { name: /^Thêm ảnh/ }));

    await waitFor(() => expect(addGalleryImage).toHaveBeenCalledTimes(2));
    expect(addGalleryImage).toHaveBeenNthCalledWith(1, {
      slug: "du-an",
      data: { url: "/images/a.webp" },
    });
    expect(addGalleryImage).toHaveBeenNthCalledWith(2, {
      slug: "du-an",
      data: { url: "/images/b.webp" },
    });
  });

  it("đặt một ảnh trong gallery làm ảnh đại diện dự án", async () => {
    const user = userEvent.setup();
    updateProject.mockClear();
    render(
      <ProjectGalleryTab
        project={{
          ...project,
          galleryImages: [
            {
              id: "img-1",
              projectId: "p1",
              projectItemId: null,
              url: "/images/a.webp",
              caption: null,
              order: 0,
              isActive: true,
              createdAt: "2026-09-26T00:00:00Z",
            },
          ],
        }}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Đặt làm ảnh đại diện" }),
    );

    await waitFor(() =>
      expect(updateProject).toHaveBeenCalledWith({
        slug: "du-an",
        data: { image: "/images/a.webp" },
      }),
    );
  });
});
