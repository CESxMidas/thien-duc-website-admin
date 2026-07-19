import { describe, it, expect } from "vitest";
import {
  contentStatusLabel,
  contentStatusTone,
  projectStatusLabel,
  leadStatusLabel,
  roleLabel,
  profileStatusLabel,
  formatDateTime,
} from "@/lib/labels";

describe("enum label maps", () => {
  it("labels content status in Vietnamese", () => {
    expect(contentStatusLabel.DRAFT).toBe("Nháp");
    expect(contentStatusLabel.PENDING).toBe("Chờ duyệt");
    expect(contentStatusLabel.PUBLISHED).toBe("Đã đăng");
  });

  it("assigns a tone to every content status", () => {
    expect(contentStatusTone.PUBLISHED).toBe("green");
    expect(Object.keys(contentStatusTone)).toEqual(
      Object.keys(contentStatusLabel),
    );
  });

  it("labels project/lead/role/profile enums", () => {
    expect(projectStatusLabel.DA_BAN_GIAO).toBe("Đã bàn giao");
    expect(leadStatusLabel.NEW).toBe("Mới");
    expect(roleLabel.SUPER_ADMIN).toBe("Super Admin");
    expect(profileStatusLabel.REJECTED).toBe("Từ chối");
  });
});

describe("formatDateTime", () => {
  it("renders a UTC instant in Vietnam time (UTC+7)", () => {
    // 2026-07-19T00:00:00Z → 07:00 the same day in Asia/Ho_Chi_Minh.
    const out = formatDateTime("2026-07-19T00:00:00Z");
    expect(out).toMatch(/19\/07\/2026/);
    expect(out).toMatch(/07:00/);
  });

  it("rolls over the date when +7 crosses midnight", () => {
    // 2026-07-19T18:00:00Z → 01:00 on 2026-07-20 local.
    const out = formatDateTime("2026-07-19T18:00:00Z");
    expect(out).toMatch(/20\/07\/2026/);
    expect(out).toMatch(/01:00/);
  });
});
