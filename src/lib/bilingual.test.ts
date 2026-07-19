import { describe, it, expect } from "vitest";
import {
  emptyBilingual,
  toBilingualValue,
  toBilingualLoose,
  toBilingualPayload,
  hasEnglish,
} from "@/lib/bilingual";

describe("bilingual helpers", () => {
  it("emptyBilingual is two empty strings", () => {
    expect(emptyBilingual).toEqual({ vi: "", en: "" });
  });

  it("toBilingualValue fills missing sides with empty string", () => {
    expect(toBilingualValue({ vi: "Xin chào", en: "Hi" })).toEqual({
      vi: "Xin chào",
      en: "Hi",
    });
    expect(toBilingualValue({ vi: "Chỉ VI" })).toEqual({ vi: "Chỉ VI", en: "" });
    expect(toBilingualValue(null)).toEqual({ vi: "", en: "" });
    expect(toBilingualValue(undefined)).toEqual({ vi: "", en: "" });
  });

  it("toBilingualLoose accepts a plain string into the VI slot", () => {
    expect(toBilingualLoose("Số cũ")).toEqual({ vi: "Số cũ", en: "" });
    expect(toBilingualLoose({ vi: "a", en: "b" })).toEqual({ vi: "a", en: "b" });
    expect(toBilingualLoose(null)).toEqual({ vi: "", en: "" });
  });

  it("toBilingualPayload trims and drops empty English", () => {
    expect(toBilingualPayload({ vi: "  Dự án  ", en: "  Project " })).toEqual({
      vi: "Dự án",
      en: "Project",
    });
    // English only whitespace → omitted entirely (public site falls back to VI).
    expect(toBilingualPayload({ vi: "Dự án", en: "   " })).toEqual({
      vi: "Dự án",
    });
    expect(toBilingualPayload({ vi: "Dự án", en: "" })).not.toHaveProperty("en");
  });

  it("hasEnglish is true only for a non-blank English string", () => {
    expect(hasEnglish({ vi: "a", en: "b" })).toBe(true);
    expect(hasEnglish({ vi: "a", en: "   " })).toBe(false);
    expect(hasEnglish({ vi: "a" })).toBe(false);
    expect(hasEnglish(null)).toBe(false);
  });
});
