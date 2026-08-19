import { describe, expect, it } from "vitest";

import {
  canScheduleCooperation,
  cooperationHasHistoricalPublication,
  cooperationScheduleActions,
  deriveCooperationPublicationState,
  isActiveFutureCooperationSchedule,
  isDueCooperationSchedule,
  type SchedulableCooperationProject,
} from "@/lib/cooperation-schedule";
import { canEditCooperation } from "@/lib/content-editing";
import type { ContentStatus, Role } from "@/types";

/**
 * **Batch 10 — trạng thái xuất bản suy ra của dự án hợp tác.**
 *
 * Luật lấy nguyên từ `news-schedule.ts`; file `cooperation-schedule.ts` chỉ đổi
 * tên `contentStatus` → `status`. Bộ test này khoá đúng **phép đổi tên đó** và
 * ma trận nút — nếu ai đó lỡ đọc thẳng `project.status` (vốn là TIẾN ĐỘ dự án
 * bằng chữ, không phải trạng thái duyệt) thì mọi ca dưới đây sẽ đỏ.
 */

const NOW = new Date("2026-08-13T10:00:00.000Z");
const PAST = "2026-08-13T09:00:00.000Z";
const FUTURE = "2026-08-14T10:00:00.000Z";

function coop(
  contentStatus: ContentStatus,
  scheduledAt: string | null = null,
  publishedAt: string | null = null,
): SchedulableCooperationProject {
  return { contentStatus, scheduledAt, publishedAt };
}

/** Bộ ca dùng lại cho nhiều nhóm test. */
const DRAFT = coop("DRAFT");
const PENDING_UNSCHEDULED = coop("PENDING");
const SCHEDULED = coop("PENDING", FUTURE, FUTURE);
const DUE = coop("PENDING", PAST, PAST);
const PUBLISHED = coop("PUBLISHED", null, PAST);
const HISTORICAL_DRAFT = coop("DRAFT", null, PAST);

describe("deriveCooperationPublicationState", () => {
  it.each([
    ["nháp", DRAFT, "DRAFT"],
    ["chờ duyệt chưa hẹn giờ", PENDING_UNSCHEDULED, "PENDING"],
    ["đã lên lịch", SCHEDULED, "SCHEDULED"],
    ["đã đến giờ đăng", DUE, "DUE"],
    ["đã đăng", PUBLISHED, "PUBLISHED"],
  ])("%s → %s", (_label, project, expected) => {
    expect(deriveCooperationPublicationState(project, NOW)).toBe(expected);
  });

  /**
   * `status` của model này là chuỗi song ngữ mô tả tiến độ. Nếu hàm suy trạng
   * thái lỡ đọc nhầm field đó, nó sẽ nhận một câu tiếng Việt thay vì enum — ca
   * này chốt rằng chỉ `contentStatus` được dùng.
   */
  it("KHÔNG đọc `status` (tiến độ dự án bằng chữ)", () => {
    const withMisleadingStatus = {
      ...DRAFT,
      // Cố tình gài một giá trị trông giống trạng thái xuất bản.
      status: "PUBLISHED",
    } as SchedulableCooperationProject;

    expect(deriveCooperationPublicationState(withMisleadingStatus, NOW)).toBe(
      "DRAFT",
    );
  });
});

describe("vị từ lịch", () => {
  it("lịch tương lai hợp lệ = PENDING + hai mốc bằng nhau, ở tương lai", () => {
    expect(isActiveFutureCooperationSchedule(SCHEDULED, NOW)).toBe(true);
    expect(isActiveFutureCooperationSchedule(DUE, NOW)).toBe(false);
    expect(isActiveFutureCooperationSchedule(DRAFT, NOW)).toBe(false);
  });

  /**
   * `publishedAt` KHÁC `scheduledAt` nghĩa là mốc kia là lịch sử thật, không
   * phải dự định của lệnh đặt lịch → không được coi là lịch đang hoạt động.
   */
  it("hai mốc lệch nhau → KHÔNG phải lịch đang hoạt động", () => {
    const mismatched = coop("PENDING", FUTURE, PAST);
    expect(isActiveFutureCooperationSchedule(mismatched, NOW)).toBe(false);
    expect(cooperationHasHistoricalPublication(mismatched, NOW)).toBe(true);
  });

  it("lịch đã tới hạn được nhận diện riêng", () => {
    expect(isDueCooperationSchedule(DUE, NOW)).toBe(true);
    expect(isDueCooperationSchedule(SCHEDULED, NOW)).toBe(false);
  });
});

describe("canScheduleCooperation", () => {
  it("EDITOR không bao giờ đặt lịch được", () => {
    for (const project of [DRAFT, PENDING_UNSCHEDULED, SCHEDULED]) {
      expect(canScheduleCooperation("EDITOR", project, NOW)).toBe(false);
    }
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: đặt lịch được cho nháp chưa từng công khai và chờ duyệt chưa hẹn giờ",
    (role) => {
      expect(canScheduleCooperation(role, DRAFT, NOW)).toBe(true);
      expect(canScheduleCooperation(role, PENDING_UNSCHEDULED, NOW)).toBe(true);
    },
  );

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s: đổi lịch được khi đang giữ lịch tương lai",
    (role) => {
      expect(canScheduleCooperation(role, SCHEDULED, NOW)).toBe(true);
    },
  );

  it.each([
    ["đang đăng", PUBLISHED],
    ["đã tới hạn", DUE],
    ["nháp từng đăng", HISTORICAL_DRAFT],
  ])("ADMIN: KHÔNG đặt lịch lần đầu cho bản %s", (_label, project) => {
    expect(canScheduleCooperation("ADMIN", project, NOW)).toBe(false);
  });
});

describe("cooperationScheduleActions — ma trận nút", () => {
  it("EDITOR không thấy nút lịch nào", () => {
    for (const project of [DRAFT, PENDING_UNSCHEDULED, SCHEDULED, DUE]) {
      expect(cooperationScheduleActions("EDITOR", project, NOW)).toEqual({
        schedule: false,
        reschedule: false,
        cancel: false,
      });
    }
  });

  it('ADMIN + nháp → chỉ "Lên lịch"', () => {
    expect(cooperationScheduleActions("ADMIN", DRAFT, NOW)).toEqual({
      schedule: true,
      reschedule: false,
      cancel: false,
    });
  });

  it('ADMIN + chờ duyệt chưa hẹn giờ → "Lên lịch" (duyệt bằng lịch)', () => {
    expect(
      cooperationScheduleActions("ADMIN", PENDING_UNSCHEDULED, NOW).schedule,
    ).toBe(true);
  });

  it('ADMIN + đã lên lịch → "Đổi lịch" + "Huỷ lịch", không có "Lên lịch"', () => {
    expect(cooperationScheduleActions("ADMIN", SCHEDULED, NOW)).toEqual({
      schedule: false,
      reschedule: true,
      cancel: true,
    });
  });

  /** §42 — tới hạn thì không còn "huỷ lịch tương lai": nội dung đã công khai. */
  it("ADMIN + đã tới hạn → không có thao tác lịch nào", () => {
    expect(cooperationScheduleActions("ADMIN", DUE, NOW)).toEqual({
      schedule: false,
      reschedule: false,
      cancel: false,
    });
  });

  it("ADMIN + đã đăng → không đặt lịch lần đầu được", () => {
    expect(cooperationScheduleActions("ADMIN", PUBLISHED, NOW).schedule).toBe(
      false,
    );
  });
});

describe("canEditCooperation — §49", () => {
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

  it.each(ALLOWED)("EDITOR sửa được: %s", (_label, project) => {
    expect(canEditCooperation("EDITOR", project)).toBe(true);
  });

  it.each(DENIED)("EDITOR KHÔNG sửa được: %s", (_label, project) => {
    expect(canEditCooperation("EDITOR", project)).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s sửa được ở mọi trạng thái",
    (role: Role) => {
      for (const [, project] of [...ALLOWED, ...DENIED]) {
        expect(canEditCooperation(role, project)).toBe(true);
      }
    },
  );

  it("thiếu vai trò → không sửa được (fail closed)", () => {
    expect(canEditCooperation(undefined, DRAFT)).toBe(false);
    expect(canEditCooperation(null, DRAFT)).toBe(false);
  });
});
