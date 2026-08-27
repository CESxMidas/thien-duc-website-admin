import { describe, it, expect } from "vitest";
import { toRouterBasename, withBase, isAppPath } from "./base-path";

/**
 * Batch 15B — Admin chuyển từ gốc `/` sang `/admin/`.
 *
 * Test truyền `base` TƯỜNG MINH thay vì dựa vào `import.meta.env.BASE_URL`:
 * vitest.config.ts không đặt `base` nên trong test BASE_URL luôn là `"/"`, tức
 * nếu chỉ dùng giá trị mặc định thì nhánh `/admin/` — nhánh THẬT SỰ chạy ở
 * production — sẽ không bao giờ được kiểm. Mỗi hàm vì vậy nhận `base` như tham
 * số cuối có giá trị mặc định.
 */
describe("toRouterBasename", () => {
  it("base /admin/ → /admin (React Router không muốn dấu / cuối)", () => {
    expect(toRouterBasename("/admin/")).toBe("/admin");
  });

  it("base gốc / → chuỗi rỗng (không có basename)", () => {
    expect(toRouterBasename("/")).toBe("");
  });

  it("base nhiều tầng giữ nguyên cấu trúc", () => {
    expect(toRouterBasename("/cms/quan-tri/")).toBe("/cms/quan-tri");
  });

  it("chịu được base đã không có dấu / cuối", () => {
    expect(toRouterBasename("/admin")).toBe("/admin");
  });
});

describe("withBase", () => {
  it("ghép path public vào base /admin/", () => {
    expect(withBase("/images/brand/logo-thien-duc.png", "/admin/")).toBe(
      "/admin/images/brand/logo-thien-duc.png",
    );
  });

  it("base gốc / → giữ nguyên path", () => {
    expect(withBase("/images/login-hero.jpg", "/")).toBe(
      "/images/login-hero.jpg",
    );
  });

  it("KHÔNG sinh dấu gạch đôi", () => {
    expect(withBase("/dang-nhap", "/admin/")).toBe("/admin/dang-nhap");
    expect(withBase("/dang-nhap", "/admin/")).not.toContain("//");
  });

  it("chấp nhận path không có / đầu", () => {
    expect(withBase("dang-nhap", "/admin/")).toBe("/admin/dang-nhap");
  });

  it("chịu được base thiếu / cuối", () => {
    expect(withBase("/dang-nhap", "/admin")).toBe("/admin/dang-nhap");
  });

  it("cắt nhiều dấu / thừa ở đầu path", () => {
    expect(withBase("///images/x.png", "/admin/")).toBe("/admin/images/x.png");
  });
});

describe("isAppPath", () => {
  it("nhận ra đang ở trang đăng nhập khi base là /admin/", () => {
    expect(isAppPath("/admin/dang-nhap", "/dang-nhap", "/admin/")).toBe(true);
  });

  it("nhận ra khi base là gốc /", () => {
    expect(isAppPath("/dang-nhap", "/dang-nhap", "/")).toBe(true);
  });

  it("chấp nhận biến thể có dấu / cuối", () => {
    expect(isAppPath("/admin/dang-nhap/", "/dang-nhap", "/admin/")).toBe(true);
  });

  it("trang khác → false", () => {
    expect(isAppPath("/admin/du-an", "/dang-nhap", "/admin/")).toBe(false);
  });

  /**
   * Đây chính là con bug mà Batch 15A tìm ra: so sánh
   * `location.pathname !== LOGIN_PATH` khi pathname là `/admin/dang-nhap` và
   * LOGIN_PATH là `/dang-nhap` luôn cho `true` → chốt chống lặp mất tác dụng.
   */
  it("KHÔNG nhầm path chưa gắn base là trang đăng nhập", () => {
    expect(isAppPath("/admin/dang-nhap", "/dang-nhap", "/")).toBe(false);
  });

  it("không khớp nhầm path chỉ trùng tiền tố", () => {
    expect(isAppPath("/admin/dang-nhap-abc", "/dang-nhap", "/admin/")).toBe(
      false,
    );
  });
});
