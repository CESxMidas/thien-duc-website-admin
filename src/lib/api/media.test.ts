import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "./client";
import { uploadMedia } from "./media";
import { prepareImageForUpload } from "@/lib/image-upload";

vi.mock("./client", () => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/image-upload", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/image-upload")>(),
  prepareImageForUpload: vi.fn(),
}));

describe("uploadMedia", () => {
  beforeEach(() => vi.clearAllMocks());

  it("gửi tệp đã tối ưu qua client chung và giữ thư mục ảnh", async () => {
    const original = new File(["source"], "large.png", { type: "image/png" });
    const prepared = new File(["webp"], "large.webp", { type: "image/webp" });
    vi.mocked(prepareImageForUpload).mockResolvedValue(prepared);
    vi.mocked(apiFetch).mockResolvedValue({ id: "media-1" });
    await expect(uploadMedia(original, "projects/hung-phu")).resolves.toEqual({ id: "media-1" });
    expect(prepareImageForUpload).toHaveBeenCalledWith(original);
    const [path, options] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/media/upload?folder=projects%2Fhung-phu");
    expect(options?.method).toBe("POST");
    const file = (options?.body as FormData).get("file") as File;
    expect(file.name).toBe("large.webp");
    expect(file.type).toBe("image/webp");
    expect(file.size).toBe(prepared.size);
  });

  it("không gọi API khi ảnh không xử lý được", async () => {
    vi.mocked(prepareImageForUpload).mockRejectedValue(new Error("Ảnh không hợp lệ"));
    await expect(uploadMedia(new File(["bad"], "bad.png"), "news")).rejects.toThrow("Ảnh không hợp lệ");
    expect(apiFetch).not.toHaveBeenCalled();
  });
});
