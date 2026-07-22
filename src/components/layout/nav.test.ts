import { describe, it, expect } from "vitest";

import { navItems } from "./nav";
import type { Role } from "@/types";

/**
 * ADMIN-ROLE-VISIBILITY-AUDIT-M1 / R2: Banner là nội dung trang chủ, chỉ ADMIN+
 * quản lý — mục "Banner" phải ẩn với EDITOR và hiện với ADMIN/SUPER_ADMIN. Test
 * dùng đúng biểu thức lọc mà `Sidebar` áp dụng.
 */
function visibleFor(role: Role): string[] {
  return navItems
    .filter((item) => !item.roles || item.roles.includes(role))
    .map((item) => item.to);
}

describe("navItems — hiển thị theo vai trò", () => {
  it("EDITOR: không thấy mục Banner (và các mục ADMIN+ khác)", () => {
    const editor = visibleFor("EDITOR");
    expect(editor).not.toContain("/banner");
    // Cùng nhóm ADMIN+: liên hệ, duyệt hồ sơ, tài khoản cũng phải ẩn.
    expect(editor).not.toContain("/lien-he");
    expect(editor).not.toContain("/duyet-ho-so");
    expect(editor).not.toContain("/tai-khoan");
    // Nội dung EDITOR vẫn quản lý được thì vẫn hiện.
    expect(editor).toContain("/du-an");
    expect(editor).toContain("/tin-tuc");
    expect(editor).toContain("/thu-vien");
  });

  it("ADMIN và SUPER_ADMIN: thấy mục Banner", () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const) {
      expect(visibleFor(role)).toContain("/banner");
    }
  });
});
