import { describe, it, expect } from "vitest";
import { getUserStatus, isPendingSetup } from "@/lib/user-status";

describe("getUserStatus", () => {
  it("isActive=false → 'Đã vô hiệu hóa' (ưu tiên cao nhất)", () => {
    const s = getUserStatus({ isActive: false, setupCompletedAt: null });
    expect(s.key).toBe("disabled");
    expect(s.label).toBe("Đã vô hiệu hóa");
    expect(s.isPending).toBe(false);
  });

  it("setupCompletedAt=null và đang active → 'Chờ thiết lập'", () => {
    const s = getUserStatus({ isActive: true, setupCompletedAt: null });
    expect(s.key).toBe("pending");
    expect(s.label).toBe("Chờ thiết lập");
    expect(s.isPending).toBe(true);
  });

  it("setupCompletedAt có giá trị và active → 'Đang hoạt động'", () => {
    const s = getUserStatus({
      isActive: true,
      setupCompletedAt: "2026-07-01T00:00:00Z",
    });
    expect(s.key).toBe("active");
    expect(s.label).toBe("Đang hoạt động");
  });

  it("setupCompletedAt=undefined (backend chưa expose) → coi như 'Đang hoạt động'", () => {
    const s = getUserStatus({ isActive: true });
    expect(s.key).toBe("active");
  });
});

describe("isPendingSetup", () => {
  it("null → true", () => {
    expect(isPendingSetup({ setupCompletedAt: null })).toBe(true);
  });
  it("undefined → false", () => {
    expect(isPendingSetup({})).toBe(false);
  });
  it("có giá trị → false", () => {
    expect(isPendingSetup({ setupCompletedAt: "2026-07-01T00:00:00Z" })).toBe(
      false,
    );
  });
});
