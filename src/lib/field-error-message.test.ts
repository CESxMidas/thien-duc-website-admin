import { describe, it, expect } from "vitest";

import { getFieldErrorMessage } from "@/lib/field-error-message";

/**
 * `getFieldErrorMessage` — hàm thuần, test thẳng không qua React.
 *
 * Hai điều quan trọng nhất được khoá ở đây:
 *  1. Lỗi PHẲNG đi đúng nhánh đầu tiên ⇒ mọi form vô hướng hành xử y hệt như
 *     trước bản sửa.
 *  2. Không bao giờ `String()` một giá trị bất kỳ ⇒ object dị dạng cho ra
 *     `undefined` chứ không đẩy "[object Object]" ra màn hình.
 */

describe("getFieldErrorMessage — lỗi phẳng (giữ nguyên hành vi cũ)", () => {
  it("trả thẳng `message` khi có", () => {
    expect(
      getFieldErrorMessage({ message: "Slug tối thiểu 3 ký tự.", type: "too_small" }),
    ).toBe("Slug tối thiểu 3 ký tự.");
  });

  it("`message` ở gốc THẮNG mọi lỗi con", () => {
    expect(
      getFieldErrorMessage({
        message: "Lỗi ở cấp field.",
        vi: { message: "Lỗi ở cấp con." },
      }),
    ).toBe("Lỗi ở cấp field.");
  });

  it("`message` rỗng không được coi là thông báo", () => {
    expect(getFieldErrorMessage({ message: "" })).toBeUndefined();
    expect(
      getFieldErrorMessage({ message: "", vi: { message: "Lỗi con." } }),
    ).toBe("Lỗi con.");
  });
});

describe("getFieldErrorMessage — lỗi lồng của field song ngữ", () => {
  /** Đúng hình dạng đo được từ react-hook-form + zodResolver. */
  const bilingual = {
    vi: {
      message: "Tiêu đề tối thiểu 3 ký tự.",
      type: "too_small",
      ref: { name: "title.vi" },
    },
  };

  it("lấy được thông báo nằm dưới `vi`", () => {
    expect(getFieldErrorMessage(bilingual)).toBe("Tiêu đề tối thiểu 3 ký tự.");
  });

  it("lấy được thông báo nằm dưới `en`", () => {
    expect(
      getFieldErrorMessage({ en: { message: "Tối đa 5.000 ký tự." } }),
    ).toBe("Tối đa 5.000 ký tự.");
  });

  /**
   * §12D — hai ngôn ngữ cùng hỏng thì kết quả phải TẤT ĐỊNH. Khoá chuỗi trong
   * JS giữ thứ tự chèn, zodResolver chèn theo thứ tự issue của Zod (thứ tự khai
   * báo trong schema), nên `vi` luôn đứng trước `en`. Điều đó cũng đúng nghiệp
   * vụ: `vi` là ngôn ngữ bắt buộc.
   */
  it("cả hai ngôn ngữ cùng hỏng: ưu tiên `vi`, lặp lại nhiều lần vẫn như nhau", () => {
    const both = {
      vi: { message: "Lỗi tiếng Việt." },
      en: { message: "Lỗi tiếng Anh." },
    };
    for (let i = 0; i < 5; i += 1) {
      expect(getFieldErrorMessage(both)).toBe("Lỗi tiếng Việt.");
    }
  });

  it("`vi` không có thông báo thì rơi xuống `en`", () => {
    expect(
      getFieldErrorMessage({
        vi: { type: "custom" },
        en: { message: "Lỗi tiếng Anh." },
      }),
    ).toBe("Lỗi tiếng Anh.");
  });

  it("lồng sâu nhiều tầng vẫn tìm ra", () => {
    expect(
      getFieldErrorMessage({ items: { 0: { name: { vi: { message: "Sâu." } } } } }),
    ).toBe("Sâu.");
  });
});

describe("getFieldErrorMessage — `root` là lỗi cấp object", () => {
  it("`root.message` thắng lỗi của từng con", () => {
    expect(
      getFieldErrorMessage({
        root: { message: "Lỗi của cả cụm." },
        vi: { message: "Lỗi của riêng vi." },
      }),
    ).toBe("Lỗi của cả cụm.");
  });

  it("`message` ở gốc vẫn thắng cả `root`", () => {
    expect(
      getFieldErrorMessage({
        message: "Trực tiếp.",
        root: { message: "Từ root." },
      }),
    ).toBe("Trực tiếp.");
  });
});

describe("getFieldErrorMessage — bỏ qua siêu dữ liệu", () => {
  it("`type` / `ref` / `types` không bị nhầm là field con", () => {
    expect(
      getFieldErrorMessage({
        type: "too_small",
        ref: { name: "title.vi", message: "KHÔNG được lấy từ ref" },
        types: { too_small: "KHÔNG được lấy từ types" },
      }),
    ).toBeUndefined();
  });

  it("có siêu dữ liệu lẫn lỗi con thật thì chỉ lấy lỗi con thật", () => {
    expect(
      getFieldErrorMessage({
        type: "invalid_type",
        ref: { message: "bẫy" },
        vi: { message: "Thông báo thật." },
      }),
    ).toBe("Thông báo thật.");
  });
});

describe("getFieldErrorMessage — đầu vào dị dạng trả undefined", () => {
  it.each([
    ["undefined", undefined],
    ["null", null],
    ["object rỗng", {}],
    ["chuỗi", "một chuỗi trần"],
    ["số", 42],
    ["mảng", [{ message: "trong mảng" }]],
    ["message không phải chuỗi", { message: 123 }],
    ["con rỗng", { vi: {}, en: {} }],
    ["con không phải object", { vi: "chuỗi", en: null }],
  ])("%s → undefined", (_label, input) => {
    expect(getFieldErrorMessage(input)).toBeUndefined();
  });

  it("KHÔNG bao giờ trả về chuỗi kiểu [object Object]", () => {
    const result = getFieldErrorMessage({ vi: { nested: { deep: {} } } });
    expect(result).toBeUndefined();
    expect(String(result)).not.toContain("[object");
  });
});

describe("getFieldErrorMessage — an toàn với tham chiếu vòng", () => {
  it("cây lỗi tự trỏ vào chính nó: dừng lại, không tràn ngăn xếp", () => {
    const cyclic: Record<string, unknown> = { type: "custom" };
    cyclic.self = cyclic;

    expect(() => getFieldErrorMessage(cyclic)).not.toThrow();
    expect(getFieldErrorMessage(cyclic)).toBeUndefined();
  });

  it("vòng lặp nhưng có thông báo hợp lệ ở nông: vẫn lấy được", () => {
    const cyclic: Record<string, unknown> = { vi: { message: "Lỗi thật." } };
    cyclic.self = cyclic;

    expect(getFieldErrorMessage(cyclic)).toBe("Lỗi thật.");
  });

  it("lồng sâu quá trần thì dừng, trả undefined", () => {
    // 8 tầng — vượt trần MAX_DEPTH = 5.
    const deep = { a: { b: { c: { d: { e: { f: { g: { message: "Quá sâu." } } } } } } } };
    expect(getFieldErrorMessage(deep)).toBeUndefined();
  });
});
