import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ImageUploadError,
  MAX_SOURCE_IMAGE_BYTES,
  MAX_UPLOAD_BYTES,
  prepareImageForUpload,
  validateFile,
} from "./image-upload";

function sourceFile(size: number, type = "image/png") {
  const file = new File(["source"], "phoi-canh.png", { type, lastModified: 123 });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

describe("xử lý ảnh trước khi tải lên", () => {
  const close = vi.fn();
  const drawImage = vi.fn();
  let bitmap: { width: number; height: number; close: typeof close };

  beforeEach(() => {
    bitmap = { width: 6000, height: 4000, close };
    close.mockClear();
    drawImage.mockClear();
    vi.stubGlobal("createImageBitmap", vi.fn(async () => bitmap));
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => {
      callback(new Blob(["optimized"], { type: "image/webp" }));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("nhận ảnh gốc trên 10MB nhưng từ chối tệp trên 50MB", () => {
    expect(validateFile(sourceFile(15 * 1024 * 1024))).toBeNull();
    expect(validateFile(sourceFile(MAX_SOURCE_IMAGE_BYTES))).toBeNull();
    expect(validateFile(sourceFile(MAX_SOURCE_IMAGE_BYTES + 1))).toMatch(/50MB/);
    expect(validateFile(sourceFile(0))).toMatch(/rỗng/);
    expect(validateFile(sourceFile(10, "image/svg+xml"))).toMatch(/chỉ nhận/);
  });

  it("giữ nguyên ảnh nhỏ, không giải mã hoặc chuyển định dạng", async () => {
    const file = sourceFile(1024);
    expect(await prepareImageForUpload(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each([3 * 1024 * 1024, MAX_UPLOAD_BYTES, 15 * 1024 * 1024])("tối ưu ảnh %i byte trước giới hạn API", async (size) => {
    const result = await prepareImageForUpload(sourceFile(size));
    expect(result.type).toBe("image/webp");
    expect(result.name).toBe("phoi-canh.webp");
    expect(result.size).toBeLessThan(MAX_UPLOAD_BYTES);
    expect(result.lastModified).toBe(123);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2560, 1707);
    expect(close).toHaveBeenCalledOnce();
  });

  it("không phóng lớn ảnh nhỏ có tệp nặng", async () => {
    bitmap.width = 800;
    bitmap.height = 600;
    await prepareImageForUpload(sourceFile(12 * 1024 * 1024));
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 800, 600);
  });

  it("giữ đúng PNG nếu trình duyệt chưa hỗ trợ xuất WebP", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(new Blob(["png"], { type: "image/png" })));
    const result = await prepareImageForUpload(sourceFile(12 * 1024 * 1024));
    expect(result.name).toBe("phoi-canh.png");
    expect(result.type).toBe("image/png");
  });

  it("từ chối độ phân giải quá lớn và đóng bitmap", async () => {
    bitmap.width = 20_000;
    bitmap.height = 20_000;
    await expect(prepareImageForUpload(sourceFile(12 * 1024 * 1024))).rejects.toThrow(/64 megapixel/);
    expect(drawImage).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });

  it("báo ảnh không đọc được thay vì tiếp tục gửi tệp gốc quá lớn", async () => {
    vi.mocked(createImageBitmap).mockRejectedValueOnce(new Error("decode failed"));
    await expect(prepareImageForUpload(sourceFile(12 * 1024 * 1024))).rejects.toThrow(/không đọc được ảnh/);
  });

  it("giải phóng bitmap và canvas khi trình duyệt xuất ảnh thất bại", async () => {
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(null));
    await expect(prepareImageForUpload(sourceFile(12 * 1024 * 1024))).rejects.toBeInstanceOf(ImageUploadError);
    expect(close).toHaveBeenCalledOnce();
    const canvas = vi.mocked(HTMLCanvasElement.prototype.toBlob).mock.instances[0] as unknown as HTMLCanvasElement;
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it("không gửi ảnh vẫn bằng hoặc vượt 10MB sau mọi lần tối ưu", async () => {
    const blob = new Blob(["large"], { type: "image/webp" });
    Object.defineProperty(blob, "size", { value: MAX_UPLOAD_BYTES });
    vi.mocked(HTMLCanvasElement.prototype.toBlob).mockImplementation((callback) => callback(blob));
    await expect(prepareImageForUpload(sourceFile(12 * 1024 * 1024))).rejects.toThrow(/vẫn vượt giới hạn 10MB/);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(9);
    expect(close).toHaveBeenCalledOnce();
  });
});
