import { describe, expect, it } from "vitest";
import { slugify } from "./slugify";
import { SLUG_PATTERN } from "./form-validation";

/**
 * Slug sinh ra ở đây trở thành URL công khai và **bị khoá sau khi tạo**, nên
 * mọi kết quả phải hợp lệ ngay từ đầu — không có cơ hội sửa sau.
 */
describe("slugify", () => {
  it("bỏ dấu thanh và dấu mũ tiếng Việt", () => {
    expect(slugify("Tin dự án")).toBe("tin-du-an");
    expect(slugify("Tin thị trường")).toBe("tin-thi-truong");
    expect(slugify("Sự kiện nổi bật")).toBe("su-kien-noi-bat");
  });

  it("đổi đ/Đ thành d — NFD không tách được chữ cái này", () => {
    expect(slugify("Công ty Thiên Đức")).toBe("cong-ty-thien-duc");
    expect(slugify("đô thị")).toBe("do-thi");
    expect(slugify("Đầu tư")).toBe("dau-tu");
  });

  it("ký tự đặc biệt gộp thành MỘT gạch, không sinh gạch đôi", () => {
    expect(slugify("Kiến trúc & Xây dựng")).toBe("kien-truc-xay-dung");
    expect(slugify("Tin  --  tức")).toBe("tin-tuc");
    expect(slugify("A/B & C")).toBe("a-b-c");
  });

  it("bỏ gạch thừa ở đầu và cuối", () => {
    expect(slugify("  Tin dự án  ")).toBe("tin-du-an");
    expect(slugify("--Tin--")).toBe("tin");
    expect(slugify("!!!")).toBe("");
  });

  it("giữ nguyên số", () => {
    expect(slugify("Kiến trúc 2026")).toBe("kien-truc-2026");
    expect(slugify("Quý 1 / 2026")).toBe("quy-1-2026");
  });

  it("chuỗi đã là slug thì giữ nguyên (idempotent)", () => {
    expect(slugify("tin-du-an")).toBe("tin-du-an");
    expect(slugify(slugify("Kiến trúc & Xây dựng"))).toBe("kien-truc-xay-dung");
  });

  it("mọi kết quả không rỗng đều khớp quy tắc slug của hệ thống", () => {
    const inputs = [
      "Tin dự án",
      "Kiến trúc & Xây dựng",
      "Công ty Thiên Đức",
      "  ĐẦU TƯ -- Xây dựng  ",
      "Quý 1 / 2026",
      "Sự kiện nổi bật!!!",
    ];
    for (const input of inputs) {
      const slug = slugify(input);
      expect(slug).not.toBe("");
      expect(slug).toMatch(SLUG_PATTERN);
      // Quy tắc chặt của backend: không gạch đầu/cuối, không hai gạch liền.
      expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    }
  });
});
