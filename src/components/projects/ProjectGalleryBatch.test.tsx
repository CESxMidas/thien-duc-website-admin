import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProjectGalleryTab } from "@/components/projects/ProjectGalleryTab";
import type { ProjectDetail } from "@/types";

const { addGalleryImage } = vi.hoisted(() => ({
  addGalleryImage: vi.fn(async () => ({})),
}));

vi.mock("@/components/ui/ImagePickerField", () => ({
  MultiImagePickerField: ({
    onChange,
  }: {
    onChange: (urls: string[]) => void;
  }) => (
    <button
      type="button"
      onClick={() => onChange(["/images/a.webp", "/images/b.webp"])}
    >
      Chọn 2 ảnh giả
    </button>
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
});
