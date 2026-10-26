import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";

import { ProjectDetailDialog } from "@/components/projects/ProjectDetailDialog";
import type { ProjectDetail } from "@/types";

const { updateItem } = vi.hoisted(() => ({
  updateItem: vi.fn<(input: { data: Record<string, unknown> }) => Promise<unknown>>(async () => ({})),
}));

// Giữ nguyên workspace và gallery thật để phát hiện bộ chọn ảnh bị render lặp.
vi.mock("@/components/ui/ImagePickerField", () => ({
  ImagePickerField: ({ onChange }: { onChange: (url: string) => void }) => (
    <button type="button" onClick={() => onChange("/images/new-cover.webp")}>
      Đổi ảnh chính thử nghiệm
    </button>
  ),
  MultiImagePickerField: () => <div>Thư viện ảnh</div>,
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { role: "ADMIN" } }),
}));

vi.mock("@/lib/api/queries", () => {
  const idle = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useProject: () => ({ data: project, isLoading: false, isError: false }),
    useUpdateProject: idle,
    useUpdateProjectStatus: idle,
    useUpdateProjectItem: () => ({ mutateAsync: updateItem, isPending: false }),
    useAddGalleryImage: idle,
    useDeleteGalleryImage: idle,
    useUpdateGalleryImage: idle,
    useReorderGallery: idle,
  };
});

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const timestamp = "2026-10-24T00:00:00Z";
const project: ProjectDetail = {
  id: "p1",
  slug: "hung-phu",
  title: { vi: "Khu đô thị Hưng Phú" },
  summary: { vi: "Thông tin dự án" },
  description: { vi: "Tổng quan dự án thử nghiệm.\nĐoạn tiếp theo." },
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
  createdAt: timestamp,
  updatedAt: timestamp,
  items: [{
    id: "item1",
    projectId: "p1",
    slug: "fancy-tower",
    title: { vi: "Fancy Tower" },
    summary: null,
    description: { vi: "Nội dung chi tiết hạng mục thử nghiệm." },
    highlights: null,
    quickFacts: null,
    status: null,
    image: "/images/old-cover.webp",
    order: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }],
  galleryImages: [],
};

it("chỉ có một bộ đổi ảnh chính; lưu nội dung không ghi đè ảnh vừa chọn", async () => {
  const user = userEvent.setup();
  render(<ProjectDetailDialog slug={project.slug} open onOpenChange={vi.fn()} />);

  await user.click(screen.getByRole("tab", { name: /Fancy Tower/ }));
  await user.click(screen.getByRole("button", { name: "Sửa hạng mục" }));

  expect(screen.getAllByRole("button", { name: "Đổi ảnh chính thử nghiệm" })).toHaveLength(1);
  await user.click(screen.getByRole("button", { name: "Đổi ảnh chính thử nghiệm" }));
  await waitFor(() => expect(updateItem).toHaveBeenCalledWith({
    slug: "hung-phu",
    itemSlug: "fancy-tower",
    data: { image: "/images/new-cover.webp" },
  }));

  await user.clear(screen.getByRole("textbox", { name: "Tên hạng mục" }));
  await user.type(screen.getByRole("textbox", { name: "Tên hạng mục" }), "Fancy Tower mới");
  await user.click(screen.getByRole("button", { name: "Lưu hạng mục" }));
  await waitFor(() => expect(updateItem).toHaveBeenCalledTimes(2));
  const savedData = updateItem.mock.calls[1][0].data;
  expect(savedData.title).toEqual({ vi: "Fancy Tower mới" });
  expect(savedData).not.toHaveProperty("image");
});

it("chỉ hiện tổng quan dự án một lần khi xem và khi đóng chỉnh sửa", async () => {
  const user = userEvent.setup();
  render(<ProjectDetailDialog slug={project.slug} open onOpenChange={vi.fn()} />);

  expect(screen.getAllByText("Nội dung tổng quan dự án")).toHaveLength(1);
  expect(screen.getAllByText(/Tổng quan dự án thử nghiệm/)).toHaveLength(1);
  expect(screen.getByText("Ngày tạo")).toBeInTheDocument();
  expect(screen.getByText("Cập nhật gần nhất")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Sửa thông tin" }));
  expect(screen.getAllByText("Nội dung tổng quan dự án")).toHaveLength(1);
  expect(screen.getByPlaceholderText("Giới thiệu tổng quan về quy mô, vị trí, hạ tầng và tiến độ dự án")).toHaveValue(project.description!.vi);
  expect(screen.queryByText(/Tổng quan dự án thử nghiệm/, { selector: "dd" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Đóng chỉnh sửa" }));
  expect(screen.getAllByText("Nội dung tổng quan dự án")).toHaveLength(1);
  expect(screen.getAllByText(/Tổng quan dự án thử nghiệm/)).toHaveLength(1);
});

it("chỉ hiện chi tiết hạng mục ở chế độ xem hoặc trong ô chỉnh sửa", async () => {
  const user = userEvent.setup();
  render(<ProjectDetailDialog slug={project.slug} open onOpenChange={vi.fn()} />);

  await user.click(screen.getByRole("tab", { name: /Fancy Tower/ }));
  expect(screen.getAllByText("Nội dung chi tiết hạng mục")).toHaveLength(1);
  expect(screen.queryByText("Nội dung tổng quan dự án")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Sửa hạng mục" }));
  expect(screen.getAllByText("Nội dung chi tiết hạng mục")).toHaveLength(1);
  expect(screen.getByRole("textbox", { name: "Nội dung chi tiết hạng mục" })).toHaveValue("Nội dung chi tiết hạng mục thử nghiệm.");
  expect(screen.queryByText("Nội dung chi tiết hạng mục thử nghiệm.", { selector: "dd" })).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Đóng chỉnh sửa" }));
  expect(screen.getAllByText("Nội dung chi tiết hạng mục")).toHaveLength(1);
  expect(screen.getByText("Nội dung chi tiết hạng mục thử nghiệm.", { selector: "dd" })).toBeInTheDocument();
});
