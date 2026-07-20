import { describe, it, expect } from "vitest";
import { canBypassApproval, isSuperAdmin } from "@/lib/roles";
import type { AuthUser } from "@/types";

/**
 * ADMIN-SUPER-ADMIN-GLOBAL-APPROVAL-BYPASS-M1: chỉ SUPER_ADMIN bỏ qua luồng
 * duyệt; EDITOR/ADMIN và trạng thái chưa đăng nhập thì không.
 */
const user = (role: AuthUser["role"]): AuthUser =>
  ({ id: "u1", email: "a@b.c", name: "A", role }) as AuthUser;

describe("roles helper", () => {
  it("isSuperAdmin đúng cho SUPER_ADMIN, sai cho vai trò khác/null", () => {
    expect(isSuperAdmin(user("SUPER_ADMIN"))).toBe(true);
    expect(isSuperAdmin(user("ADMIN"))).toBe(false);
    expect(isSuperAdmin(user("EDITOR"))).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
    expect(isSuperAdmin(undefined)).toBe(false);
  });

  it("canBypassApproval theo đúng SUPER_ADMIN", () => {
    expect(canBypassApproval(user("SUPER_ADMIN"))).toBe(true);
    expect(canBypassApproval(user("ADMIN"))).toBe(false);
  });
});
