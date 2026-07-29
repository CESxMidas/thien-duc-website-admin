import { z } from "zod";

import type { Bilingual } from "@/types";
import type { BilingualValue } from "@/lib/bilingual";

/**
 * Trần một **đoạn** nội dung dài, khớp `MAX_LONG_TEXT_LENGTH` ở
 * `backend/src/common/dto/long-translated-text.dto.ts`.
 *
 * Trước đây backend chặn ở 5.000 và Admin không kiểm gì cả, nên bài dài chỉ báo
 * lỗi khi đã bấm Lưu và nhận 400 từ API. Giữ con số này bằng backend để form
 * báo lỗi tại chỗ, và **không** đặt thấp hơn — thấp hơn là tự chặn nội dung mà
 * API vốn chấp nhận.
 */
export const MAX_LONG_TEXT_LENGTH = 100_000;

/** Mảng đoạn văn ↔ textarea: mỗi đoạn cách nhau một dòng trống. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Đổi mảng đoạn từ API về một chuỗi cho textarea. */
export function paragraphsToText(
  content: Bilingual[] | null | undefined,
  lang: "vi" | "en",
): string {
  return (content ?? [])
    .map((item) => item[lang] ?? "")
    .join("\n\n")
    .trim();
}

/**
 * Ghép đoạn VI với đoạn EN **theo vị trí**: đoạn 1 tiếng Việt đi với đoạn 1
 * tiếng Anh. Nếu hai bên lệch số đoạn, phần thiếu để trống thay vì bị cắt mất —
 * mất chữ âm thầm còn tệ hơn một đoạn trống nhìn thấy được.
 */
export function toParagraphPayload(content: BilingualValue): Bilingual[] {
  const vi = splitParagraphs(content.vi);
  const en = splitParagraphs(content.en);
  const length = Math.max(vi.length, en.length);

  return Array.from({ length }, (_, index) => ({
    vi: vi[index] ?? "",
    ...(en[index] && { en: en[index] }),
  }));
}

/** Đoạn dài nhất sau khi tách — đây mới là thứ backend soi, không phải cả ô. */
export function longestParagraphLength(text: string): number {
  return splitParagraphs(text).reduce(
    (max, paragraph) => Math.max(max, paragraph.length),
    0,
  );
}

/**
 * Ràng buộc độ dài cho ô nội dung dài song ngữ.
 *
 * Kiểm **theo từng đoạn** chứ không theo tổng số ký tự của ô, vì backend
 * validate từng phần tử `content[]`: một bài 300.000 ký tự chia thành nhiều đoạn
 * dưới trần vẫn hợp lệ, còn một đoạn duy nhất 100.001 ký tự thì không.
 */
function paragraphLimit(lang: "vi" | "en") {
  return (value: string, ctx: z.RefinementCtx) => {
    const longest = longestParagraphLength(value);
    if (longest > MAX_LONG_TEXT_LENGTH) {
      ctx.addIssue({
        code: "custom",
        message: `Mỗi đoạn ${
          lang === "vi" ? "tiếng Việt" : "tiếng Anh"
        } tối đa ${MAX_LONG_TEXT_LENGTH.toLocaleString("vi-VN")} ký tự (đoạn dài nhất đang ${longest.toLocaleString("vi-VN")}). Tách đoạn bằng một dòng trống.`,
      });
    }
  };
}

/**
 * Schema cho field `content` song ngữ dạng nội dung dài.
 * `minVi` = số ký tự tối thiểu của ô tiếng Việt (0 = không bắt buộc).
 */
export function longFormContentSchema(minVi = 0, message?: string) {
  return z.object({
    vi: z
      .string()
      .trim()
      .min(minVi, message ?? "Cần ít nhất một đoạn nội dung.")
      .superRefine(paragraphLimit("vi")),
    en: z.string().trim().superRefine(paragraphLimit("en")),
  });
}
