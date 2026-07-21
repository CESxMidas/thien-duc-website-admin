import { describe, it, expect } from "vitest";

import { contentStatusActions } from "@/lib/content-status-actions";

/**
 * ADMIN-SUPER-ADMIN-GLOBAL-ADMIN-WORKFLOW-FIX-M1: SUPER_ADMIN đăng thẳng từ nháp
 * ("Đăng ngay" → PUBLISHED), không đi qua "Gửi duyệt". ADMIN/EDITOR giữ luồng
 * duyệt cũ (nháp → gửi duyệt → duyệt & đăng).
 */
describe("contentStatusActions", () => {
  it("SUPER_ADMIN: nháp đăng thẳng (PUBLISHED), không gửi duyệt", () => {
    const actions = contentStatusActions("SUPER_ADMIN", "DRAFT");
    expect(actions).toEqual([
      { to: "PUBLISHED", label: "Đăng ngay", intent: "publish" },
    ]);
  });

  it("ADMIN: nháp → Gửi duyệt (PENDING)", () => {
    const actions = contentStatusActions("ADMIN", "DRAFT");
    expect(actions).toEqual([
      { to: "PENDING", label: "Gửi duyệt", intent: "submit" },
    ]);
  });

  it("EDITOR: nháp → Gửi duyệt (PENDING)", () => {
    const actions = contentStatusActions("EDITOR", "DRAFT");
    expect(actions).toEqual([
      { to: "PENDING", label: "Gửi duyệt", intent: "submit" },
    ]);
  });

  it("SUPER_ADMIN/ADMIN: chờ duyệt có Duyệt & đăng + Trả về nháp", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN"] as const) {
      const actions = contentStatusActions(role, "PENDING");
      expect(actions.map((a) => a.to)).toEqual(["PUBLISHED", "DRAFT"]);
      expect(actions[0].intent).toBe("approve");
      expect(actions[1].intent).toBe("revert");
    }
  });

  it("EDITOR: chờ duyệt không có thao tác (chỉ chờ)", () => {
    expect(contentStatusActions("EDITOR", "PENDING")).toEqual([]);
  });

  it("SUPER_ADMIN/ADMIN: đã đăng có thể Trả về nháp", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN"] as const) {
      expect(contentStatusActions(role, "PUBLISHED")).toEqual([
        { to: "DRAFT", label: "Trả về nháp", intent: "revert" },
      ]);
    }
  });

  it("EDITOR: đã đăng không có thao tác", () => {
    expect(contentStatusActions("EDITOR", "PUBLISHED")).toEqual([]);
  });
});
