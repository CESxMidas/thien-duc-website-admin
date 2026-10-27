/** Trần tệp gốc ở trình duyệt và trần dữ liệu gửi tới API là hai giới hạn riêng. */
export const MAX_SOURCE_IMAGE_BYTES = 50 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const OPTIMIZE_ABOVE_BYTES = 2 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 64_000_000;
export const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "image/avif"];
export const IMAGE_UPLOAD_HINT =
  "JPG, PNG, WebP, AVIF | tối đa 50MB/ảnh. Ảnh lớn được tự tối ưu trước khi tải lên.";

export class ImageUploadError extends Error {}

export function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type)) {
    return `${file.name}: chỉ nhận ảnh JPG, PNG, WebP hoặc AVIF.`;
  }
  if (file.size === 0) return `${file.name}: tệp ảnh rỗng.`;
  if (file.size > MAX_SOURCE_IMAGE_BYTES) {
    return `${file.name}: ảnh gốc vượt quá 50MB. Vui lòng giảm dung lượng ảnh rồi thử lại.`;
  }
  return null;
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  dispose: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, dispose: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Không đọc được ảnh"));
      image.src = url;
    });
    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      dispose: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

function encodeCanvas(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob?.size) resolve(blob);
      else reject(new ImageUploadError("Không tối ưu được ảnh. Vui lòng xuất lại ảnh rồi thử lại."));
    }, "image/webp", quality);
  });
}

/** Không sửa tệp gốc; giữ tỉ lệ và nền trong suốt, không phóng lớn ảnh nhỏ. */
export async function prepareImageForUpload(file: File): Promise<File> {
  const reason = validateFile(file);
  if (reason) throw new ImageUploadError(reason);
  if (file.size <= OPTIMIZE_ABOVE_BYTES) return file;

  let image: DecodedImage;
  try {
    image = await decodeImage(file);
  } catch {
    throw new ImageUploadError(`${file.name}: không đọc được ảnh. Vui lòng đổi sang JPG, PNG hoặc WebP rồi thử lại.`);
  }

  const canvas = document.createElement("canvas");
  try {
    if (!image.width || !image.height || image.width * image.height > MAX_SOURCE_PIXELS) {
      throw new ImageUploadError(`${file.name}: độ phân giải ảnh quá lớn. Vui lòng giảm xuống tối đa 64 megapixel.`);
    }
    const context = canvas.getContext("2d");
    if (!context) throw new ImageUploadError("Trình duyệt không xử lý được ảnh. Vui lòng thử bằng trình duyệt khác.");

    let best: Blob | undefined;
    for (const edge of [2560, 1920, 1280]) {
      const ratio = Math.min(1, edge / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * ratio));
      canvas.height = Math.max(1, Math.round(image.height * ratio));
      context.drawImage(image.source, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.9, 0.82, 0.72]) {
        const blob = await encodeCanvas(canvas, quality);
        // Trình duyệt chưa xuất được WebP có thể trả PNG; dùng đúng MIME và đuôi tệp.
        if (blob.type !== "image/webp" && blob.type !== "image/png") {
          throw new ImageUploadError("Trình duyệt trả định dạng ảnh không được hỗ trợ.");
        }
        if (!best || blob.size < best.size) best = blob;
        if (best.size <= OPTIMIZE_ABOVE_BYTES) break;
        if (blob.type === "image/png") break;
      }
      if (best && best.size <= OPTIMIZE_ABOVE_BYTES) break;
    }

    if (!best || best.size >= MAX_UPLOAD_BYTES) {
      throw new ImageUploadError(`${file.name}: ảnh vẫn vượt giới hạn 10MB sau khi tối ưu. Vui lòng giảm kích thước ảnh rồi thử lại.`);
    }
    const extension = best.type === "image/webp" ? "webp" : "png";
    const name = file.name.replace(/\.[^.]+$/, "") || "image";
    return new File([best], `${name}.${extension}`, { type: best.type, lastModified: file.lastModified });
  } finally {
    image.dispose();
    canvas.width = 0;
    canvas.height = 0;
  }
}
