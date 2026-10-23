import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ImagePickerField,
  MultiImagePickerField,
} from "@/components/ui/ImagePickerField";
import type { MediaAsset } from "@/types";
import { toast } from "sonner";

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
    vi.clearAllMocks();
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
      publicId: file.name,
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
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toHaveTextContent("Chọn ảnh đại diện");

    fireEvent.click(
      screen.getByRole("button", {
        name: "Chọn anh-2.png làm ảnh đại diện",
      }),
    );

    expect(onChange).toHaveBeenCalledWith("https://cdn.example/anh-2.png.webp");
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

  it("nhận ảnh gốc trên 10MB, tiếp tục tải các ảnh khác khi một ảnh lỗi", async () => {
    const heavy = new File(["png"], "anh-lon.png", { type: "image/png" });
    Object.defineProperty(heavy, "size", { value: 12 * 1024 * 1024 });
    uploadMedia.mockRejectedValueOnce(new Error("failed")).mockResolvedValueOnce(media[1]);
    const onChange = vi.fn();
    const { container } = render(<MultiImagePickerField value={[]} onChange={onChange} />);
    fireEvent.change(container.querySelector("input[type='file']")!, {
      target: { files: [heavy, new File(["bad"], "sai.txt", { type: "text/plain" }), new File(["jpg"], "anh.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([media[1].url]));
    expect(uploadMedia).toHaveBeenCalledTimes(2);
    expect(uploadMedia.mock.calls[0][0].file).toBe(heavy);
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("sai.txt"));
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("anh-lon.png"));
  });

  it("khóa toàn bộ lô và báo trạng thái cho form dự án khi đang tải", async () => {
    let complete!: (asset: MediaAsset) => void;
    uploadMedia.mockReturnValue(new Promise<MediaAsset>((resolve) => { complete = resolve; }));
    const onChange = vi.fn();
    const onUploadStateChange = vi.fn();
    const { container } = render(<MultiImagePickerField value={[]} onChange={onChange} onUploadStateChange={onUploadStateChange} />);
    const input = container.querySelector("input[type='file']")!;
    fireEvent.change(input, { target: { files: [new File(["a"], "a.png", { type: "image/png" })] } });
    expect(screen.getByRole("button", { name: "Đang xử lý 1/1" })).toBeDisabled();
    expect(onUploadStateChange).toHaveBeenCalledWith(true);
    fireEvent.change(input, { target: { files: [new File(["b"], "b.png", { type: "image/png" })] } });
    expect(uploadMedia).toHaveBeenCalledTimes(1);
    complete(media[0]);
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([media[0].url]));
    expect(onUploadStateChange.mock.calls).toEqual([[true], [false]]);
  });

  it("không cho đổi ảnh chính khi field bị khóa quyền sửa", () => {
    const { container } = render(<ImagePickerField value={media[0].url} onChange={vi.fn()} disabled />);
    expect(screen.getByRole("button", { name: /Đổi hoặc tải thêm ảnh/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Chọn từ thư viện/ })).toBeDisabled();
    fireEvent.change(container.querySelector("input[type='file']")!, { target: { files: [new File(["png"], "a.png", { type: "image/png" })] } });
    expect(uploadMedia).not.toHaveBeenCalled();
  });
});
