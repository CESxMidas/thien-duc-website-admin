import { describe, expect, it } from "vitest";

import {
  canSchedulePage,
  derivePagePublicationState,
  isActiveFuturePageSchedule,
  isDuePageSchedule,
  pageHasHistoricalPublication,
  pageScheduleActions,
  type SchedulablePage,
} from "@/lib/page-schedule";
import { canEditPage } from "@/lib/content-editing";
import type { ContentStatus, Role } from "@/types";

/**
 * **Batch 11 — trạng thái xuất bản suy ra của trang nội dung.**
 *
 * Luật lấy nguyên từ `news-schedule.ts`; trang gọi cột bậc thang duyệt là
 * `status` đúng như `NewsPost`, nên `page-schedule.ts` không cần đổi tên trường.
 * Bộ test này khoá ma trận trạng thái/nút và luật sửa cho riêng trang.
 */

const NOW = new Date("2026-08-13T10:00:00.000Z");
const PAST = "2026-08-13T09:00:00.000Z";
const FUTURE = "2026-08-14T10:00:00.000Z";

function page(
  status: ContentStatus,
  scheduledAt: string | null = null,
  publishedAt: string | null = null,
): SchedulablePage {
  return { status, scheduledAt, publishedAt };
}

const DRAFT = page("DRAFT");
const PENDING_UNSCHEDULED = page("PENDING");
const SCHEDULED = page("PENDING", FUTURE, FUTURE);
const DUE = page("PENDING", PAST, PAST);
const PUBLISHED = page("PUBLISHED", null, PAST);
const HISTORICAL_DRAFT = page("DRAFT", null, PAST);

describe("derivePagePublicationState", () => {
  it.each([
    ["nháp", DRAFT, "DRAFT"],
    ["chờ duyệt chưa hẹn giờ", PENDING_UNSCHEDULED, "PENDING"],
    ["đã lên lịch", SCHEDULED, "SCHEDULED"],
    ["đã đến giờ đăng", DUE, "DUE"],
    ["đã đăng", PUBLISHED, "PUBLISHED"],
  ])("%s → %s", (_label, value, expected) => {
    expect(derivePagePublicationState(value, NOW)).toBe(expected);
  });
});

describe("vị từ lịch", () => {
  it("lịch tương lai hợp lệ = PENDING + hai mốc bằng nhau, ở tương lai", () => {
    expect(isActiveFuturePageSchedule(SCHEDULED, NOW)).toBe(true);
    expect(isActiveFuturePageSchedule(DUE, NOW)).toBe(false);
    expect(isActiveFuturePageSchedule(DRAFT, NOW)).toBe(false);
  });

  /**
   * `publishedAt` KHÁC `scheduledAt` nghĩa là mốc kia là lịch sử thật, không
   * phải dự định của lệnh đặt lịch → không được coi là lịch đang hoạt động.
   */
  it("hai mốc lệch nhau → KHÔNG phải lịch đang hoạt động", () => {
    const mismatched = page("PENDING", FUTURE, PAST);
    expect(isActiveFuturePageSchedule(mismatched, NOW)).toBe(false);
    expect(pageHasHistoricalPublication(mismatched, NOW)).toBe(true);
  });

  it("lịch đã tới hạn được nhận diện riêng", () => {
    expect(isDuePageSchedule(DUE, NOW)).toBe(true);
    expect(isDuePageSchedule(SCHEDULED, NOW)).toBe(false);
  });
});

describe("canSchedulePage", () => {
  it("EDITOR không bao giờ đặt lịch được", () => {
    for (const value of [DRAFT, PENDING_UNSCHEDULED, SCHEDULED]) {
      expect(canSchedulePage("EDITOR", value, NOW)).toBe(false);
    }
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: đặt lịch được cho nháp chưa từng công khai và chờ duyệt chưa hẹn giờ",
    (role) => {
      expect(canSchedulePage(role, DRAFT, NOW)).toBe(true);
      expect(canSchedulePage(role, PENDING_UNSCHEDULED, NOW)).toBe(true);
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: đổi lịch được khi đang giữ lịch tương lai",
    (role) => {
      expect(canSchedulePage(role, SCHEDULED, NOW)).toBe(true);
    },
  );

  it.each([
    ["đang đăng", PUBLISHED],
    ["đã tới hạn", DUE],
    ["nháp từng đăng", HISTORICAL_DRAFT],
  ])("ADMIN: KHÔNG đặt lịch lần đầu cho trang %s", (_label, value) => {
    expect(canSchedulePage("ADMIN", value, NOW)).toBe(false);
  });
});

describe("pageScheduleActions — ma trận nút", () => {
  it("EDITOR không thấy nút lịch nào", () => {
    for (const value of [DRAFT, PENDING_UNSCHEDULED, SCHEDULED, DUE]) {
      expect(pageScheduleActions("EDITOR", value, NOW)).toEqual({
        schedule: false,
        reschedule: false,
        cancel: false,
      });
    }
  });

  it('ADMIN + nháp → chỉ "Lên lịch"', () => {
    expect(pageScheduleActions("ADMIN", DRAFT, NOW)).toEqual({
      schedule: true,
      reschedule: false,
      cancel: false,
    });
  });

  it('ADMIN + chờ duyệt chưa hẹn giờ → "Lên lịch" (duyệt bằng lịch)', () => {
    expect(
      pageScheduleActions("ADMIN", PENDING_UNSCHEDULED, NOW).schedule,
    ).toBe(true);
  });

  it('ADMIN + đã lên lịch → "Đổi lịch" + "Huỷ lịch", không có "Lên lịch"', () => {
    expect(pageScheduleActions("ADMIN", SCHEDULED, NOW)).toEqual({
      schedule: false,
      reschedule: true,
      cancel: true,
    });
  });

  /** §39 — tới hạn thì không còn "huỷ lịch tương lai": nội dung đã công khai. */
  it("ADMIN + đã tới hạn → không có thao tác lịch nào", () => {
    expect(pageScheduleActions("ADMIN", DUE, NOW)).toEqual({
      schedule: false,
      reschedule: false,
      cancel: false,
    });
  });

  it("ADMIN + đã đăng → không đặt lịch lần đầu được", () => {
    expect(pageScheduleActions("ADMIN", PUBLISHED, NOW).schedule).toBe(false);
  });
});

describe("canEditPage — §47", () => {
  const ALLOWED = [
    ["nháp chưa từng công khai", DRAFT],
    ["chờ duyệt chưa hẹn giờ", PENDING_UNSCHEDULED],
  ] as const;
  const DENIED = [
    ["đã lên lịch", SCHEDULED],
    ["đã tới hạn", DUE],
    ["đang đăng", PUBLISHED],
    ["nháp từng đăng", HISTORICAL_DRAFT],
  ] as const;

  it.each(ALLOWED)("EDITOR sửa được: %s", (_label, value) => {
    expect(canEditPage("EDITOR", value)).toBe(true);
  });

  it.each(DENIED)("EDITOR KHÔNG sửa được: %s", (_label, value) => {
    expect(canEditPage("EDITOR", value)).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s sửa được ở mọi trạng thái",
    (role: Role) => {
      for (const [, value] of [...ALLOWED, ...DENIED]) {
        expect(canEditPage(role, value)).toBe(true);
      }
    },
  );

  it("thiếu vai trò → không sửa được (fail closed)", () => {
    expect(canEditPage(undefined, DRAFT)).toBe(false);
    expect(canEditPage(null, DRAFT)).toBe(false);
  });
});
