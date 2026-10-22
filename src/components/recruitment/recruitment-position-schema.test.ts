import { describe, expect, it } from "vitest";

import { recruitmentPositionSchema } from "./recruitment-position-schema";

const validValues = {
  title: { vi: "Kỹ sư xây dựng", en: "Construction Engineer" },
  department: { vi: "Kỹ thuật", en: "" },
  location: { vi: "Bến Tre", en: "" },
  type: { vi: "Toàn thời gian", en: "" },
  summary: { vi: "Tham gia triển khai dự án.", en: "" },
  responsibilities: { vi: "Giám sát công trình", en: "" },
  requirements: { vi: "", en: "" },
  benefits: { vi: "", en: "" },
  deadline: "2026-12-31",
  order: 0,
};

describe("recruitmentPositionSchema", () => {
  it("chấp nhận dữ liệu tuyển dụng hợp lệ và không bắt buộc bản dịch EN", () => {
    expect(recruitmentPositionSchema.safeParse(validValues).success).toBe(true);
  });

  it("bắt buộc các nội dung chính bằng tiếng Việt", () => {
    expect(
      recruitmentPositionSchema.safeParse({
        ...validValues,
        title: { vi: " ", en: "Construction Engineer" },
      }).success,
    ).toBe(false);
  });

  it("chỉ nhận deadline rỗng hoặc ngày YYYY-MM-DD", () => {
    expect(
      recruitmentPositionSchema.safeParse({
        ...validValues,
        deadline: "31/12/2026",
      }).success,
    ).toBe(false);
    expect(
      recruitmentPositionSchema.safeParse({
        ...validValues,
        deadline: "",
      }).success,
    ).toBe(true);
  });

  it("yêu cầu thứ tự là số nguyên", () => {
    expect(
      recruitmentPositionSchema.safeParse({ ...validValues, order: 1.5 })
        .success,
    ).toBe(false);
  });
});
