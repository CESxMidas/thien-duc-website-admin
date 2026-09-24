import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ImagePickerField } from "@/components/ui/ImagePickerField";

vi.mock("@/lib/api/queries", () => ({
  useMedia: () => ({ data: [], isLoading: false }),
  useUploadMedia: () => ({
    isPending: false,
    mutateAsync: vi.fn(),
  }),
}));

describe("ImagePickerField", () => {
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
});
