import { describe, expect, it } from "vitest";

import {
  MAX_LONG_TEXT_LENGTH,
  longFormContentSchema,
  longestParagraphLength,
  paragraphsToText,
  splitParagraphs,
  toParagraphPayload,
} from "./long-form-content";

/**
 * Hồi quy cho việc nâng trần nội dung dài 5.000 → 100.000 ký tự/đoạn, khớp
 * `backend/src/common/dto/long-translated-text.dto.ts`.
 */

const OLD_LIMIT = 5_000;
const schema = longFormContentSchema(1, "Cần ít nhất một đoạn nội dung.");

/** Lỗi của field nào — dùng để assert đúng ô VI hay EN bị chặn. */
function failedFields(value: { vi: string; en: string }): string[] {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues.map((issue) => issue.path.join("."));
}

describe("trần độ dài mỗi đoạn", () => {
  it("khớp con số backend: 100.000", () => {
    expect(MAX_LONG_TEXT_LENGTH).toBe(100_000);
  });

  describe.each([
    ["vi", (text: string) => ({ vi: text, en: "" })],
    ["en", (text: string) => ({ vi: "Đoạn tiếng Việt", en: text })],
  ])("field %s", (field, build) => {
    it.each([
      ["5.001 (vượt trần cũ 5.000)", OLD_LIMIT + 1],
      ["50.000", 50_000],
      ["đúng 100.000 (biên trên)", MAX_LONG_TEXT_LENGTH],
    ])("chấp nhận đoạn %s ký tự", (_label, length) => {
      expect(failedFields(build("a".repeat(length)))).toEqual([]);
    });

    it("chặn đoạn 100.001 ký tự", () => {
      expect(
        failedFields(build("a".repeat(MAX_LONG_TEXT_LENGTH + 1))),
      ).toContain(field);
    });
  });

  it("kiểm theo từng đoạn, không theo tổng cả ô", () => {
    // 5 đoạn × 100.000 = 500.000 ký tự tổng, nhưng mỗi đoạn đúng trần → hợp lệ,
    // vì backend validate từng phần tử `content[]`.
    const fiveMaxParagraphs = Array.from({ length: 5 }, () =>
      "a".repeat(MAX_LONG_TEXT_LENGTH),
    ).join("\n\n");

    expect(failedFields({ vi: fiveMaxParagraphs, en: "" })).toEqual([]);
    expect(longestParagraphLength(fiveMaxParagraphs)).toBe(
      MAX_LONG_TEXT_LENGTH,
    );
  });

  it("vẫn chặn khi chỉ một đoạn giữa bài vượt trần", () => {
    const text = ["Đoạn ngắn", "b".repeat(MAX_LONG_TEXT_LENGTH + 1), "Kết"].join(
      "\n\n",
    );
    expect(failedFields({ vi: text, en: "" })).toContain("vi");
  });

  it("giữ ràng buộc cũ: nội dung rỗng vẫn bị chặn", () => {
    expect(failedFields({ vi: "   ", en: "" })).toContain("vi");
  });

  it("schema không bắt buộc (news) cho phép nội dung rỗng", () => {
    expect(longFormContentSchema().safeParse({ vi: "", en: "" }).success).toBe(
      true,
    );
  });
});

describe("không cắt chữ khi đi qua form (task 8)", () => {
  const longVi = "Nội dung tiếng Việt rất dài. ".repeat(3_000);
  const longEn = "Very long English content. ".repeat(3_000);

  it("payload gửi đi chứa đủ toàn bộ chữ, không truncate", () => {
    expect(longVi.length).toBeGreaterThan(OLD_LIMIT);

    const payload = toParagraphPayload({ vi: longVi, en: longEn });

    expect(payload).toHaveLength(1);
    expect(payload[0].vi).toBe(longVi.trim());
    expect(payload[0].en).toBe(longEn.trim());
    expect(payload[0].vi).toHaveLength(longVi.trim().length);
  });

  it("schema trả về nguyên văn, không rút gọn giá trị", () => {
    const parsed = schema.parse({ vi: longVi, en: longEn });
    expect(parsed.vi).toBe(longVi.trim());
    expect(parsed.en).toBe(longEn.trim());
  });

  it("nạp lại form từ API khôi phục đủ chữ (round-trip)", () => {
    const payload = toParagraphPayload({ vi: longVi, en: longEn });

    // Mô phỏng API trả về rồi form mở lại ở chế độ sửa.
    expect(paragraphsToText(payload, "vi")).toBe(longVi.trim());
    expect(paragraphsToText(payload, "en")).toBe(longEn.trim());
  });

  it("round-trip nhiều đoạn giữ đúng số đoạn và nội dung", () => {
    const vi = ["Đoạn một", "b".repeat(50_000), "Đoạn ba"].join("\n\n");
    const payload = toParagraphPayload({ vi, en: "" });

    expect(payload).toHaveLength(3);
    expect(payload[1].vi).toHaveLength(50_000);
    expect(paragraphsToText(payload, "vi")).toBe(vi);
  });

  it("lệch số đoạn VI/EN thì để trống chứ không cắt bớt", () => {
    const payload = toParagraphPayload({ vi: "A\n\nB", en: "Only one" });

    expect(payload).toHaveLength(2);
    expect(payload[0]).toEqual({ vi: "A", en: "Only one" });
    expect(payload[1]).toEqual({ vi: "B" });
  });

  it("splitParagraphs tách theo dòng trống và bỏ đoạn rỗng", () => {
    expect(splitParagraphs("A\n\n\n  \n\nB\n\n")).toEqual(["A", "B"]);
  });

  it("paragraphsToText chịu được content null từ API", () => {
    expect(paragraphsToText(null, "vi")).toBe("");
    expect(paragraphsToText(undefined, "en")).toBe("");
  });
});
