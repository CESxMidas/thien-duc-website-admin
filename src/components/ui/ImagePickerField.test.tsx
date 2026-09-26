import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ImagePickerField,
  MultiImagePickerField,
} from "@/components/ui/ImagePickerField";
import type { MediaAsset } from "@/types";

const { uploadMedia } = vi.hoisted(() => ({ uploadMedia: vi.fn() }));

const media: MediaAsset[] = [
  {
    id: "m1",
    url: "https://cdn.example/projects/a.webp",
    publicId: "projects/a",
    width: 1200,
    height: 800,
    format: "webp",
    bytes: 100,
    folder: "projects",
    uploadedById: "u1",
    createdAt: "2026-09-26T00:00:00Z",
  },
  {
    id: "m2",
    url: "https://cdn.example/projects/b.webp",
    publicId: "projects/b",
    width: 1200,
    height: 800,
    format: "webp",
    bytes: 100,
    folder: "projects",
    uploadedById: "u1",
    createdAt: "2026-09-26T00:00:00Z",
  },
];

vi.mock("@/lib/api/queries", () => ({
  useMedia: () => ({ data: media, isLoading: false }),
  useUploadMedia: () => ({
    isPending: false,
    mutateAsync: uploadMedia,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

describe("ImagePickerField", () => {
  beforeEach(() => {
    uploadMedia.mockReset();
  });

  it("thử tải lại ảnh xem trước khi URL thay đổi sau một lần tải lỗi", () => {
    const { rerender } = render(
      <ImagePickerField
        value="https://cdn.example/anh-cu.webp"
        onChange={vi.fn()}
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "Ảnh đã chọn" }));
    expect(screen.getByText("Không tải được ảnh")).toBeInTheDocument();

    rerender(
      <ImagePickerField
        value="https://cdn.example/anh-moi.webp"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("img", { name: "Ảnh đã chọn" })).toHaveAttribute(
      "src",
      "https://cdn.example/anh-moi.webp",
    );
    expect(screen.queryByText("Không tải được ảnh")).not.toBeInTheDocument();
  });

  it("tải nhiều ảnh trong một lần và dùng ảnh đầu tiên cho field đơn", async () => {
    const onChange = vi.fn();
    uploadMedia.mockImplementation(async ({ file }: { file: File }) => ({
      ...media[0],
      id: file.name,
      url: `https://cdn.example/${file.name}.webp`,
    }));

    const { container } = render(
      <ImagePickerField value="" onChange={onChange} folder="news" />,
    );
    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    expect(input).toHaveAttribute("multiple");

    fireEvent.change(input, {
      target: {
        files: [
          new File(["a"], "anh-1.png", { type: "image/png" }),
          new File(["b"], "anh-2.png", { type: "image/png" }),
        ],
      },
    });

    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(2));
    expect(onChange).toHaveBeenCalledWith("https://cdn.example/anh-1.png.webp");
  });

  it("chọn nhiều ảnh từ thư viện cho gallery trong một thao tác", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MultiImagePickerField value={[]} onChange={onChange} />);

    await user.click(
      screen.getByRole("button", { name: "Chọn nhiều từ thư viện" }),
    );
    await user.click(screen.getByRole("button", { name: "a" }));
    await user.click(screen.getByRole("button", { name: "b" }));
    await user.click(screen.getByRole("button", { name: "Dùng 2 ảnh đã chọn" }));

    expect(onChange).toHaveBeenCalledWith(media.map((asset) => asset.url));
  });
});
