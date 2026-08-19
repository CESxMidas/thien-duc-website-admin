import { describe, it, expect } from "vitest";

import {
  canScheduleProject,
  deriveProjectPublicationState,
  isActiveFutureProjectSchedule,
  isDueProjectSchedule,
  projectHasHistoricalPublication,
  projectScheduleActions,
  type SchedulableProject,
} from "@/lib/project-schedule";
import { canEditProject } from "@/lib/content-editing";
import type { ContentStatus, Role } from "@/types";

/**
 * **Batch 9 — trạng thái suy ra và ma trận thao tác lịch của DỰ ÁN.**
 *
 * Dự án gọi cột trạng thái duyệt là `contentStatus` (vì `status` đã dùng cho
 * TÌNH TRẠNG THI CÔNG). Bộ test này khoá đúng chỗ dễ sai nhất: việc đổi tên
 * trường phải giữ nguyên từng ca của luật gốc, và không được để tình trạng thi
 * công lọt vào một vị từ xuất bản.
 */

const NOW = new Date("2026-08-13T10:00:00.000Z");
const FUTURE = "2026-08-20T01:00:00.000Z";
const PAST = "2026-08-13T09:00:00.000Z";

function make(overrides: Partial<SchedulableProject>): SchedulableProject {
  return {
    contentStatus: "DRAFT",
    scheduledAt: null,
    publishedAt: null,
    ...overrides,
  };
}

const states = {
  "nháp sạch": make({}),
  "chờ duyệt chưa hẹn giờ": make({ contentStatus: "PENDING" }),
  "đã lên lịch": make({
    contentStatus: "PENDING",
    scheduledAt: FUTURE,
    publishedAt: FUTURE,
  }),
  "đã đến giờ đăng": make({
    contentStatus: "PENDING",
    scheduledAt: PAST,
    publishedAt: PAST,
  }),
  "đang đăng": make({ contentStatus: "PUBLISHED", publishedAt: PAST }),
  "nháp từng đăng": make({ contentStatus: "DRAFT", publishedAt: PAST }),
} satisfies Record<string, SchedulableProject>;

describe("deriveProjectPublicationState", () => {
  it.each([
    ["nháp sạch", "DRAFT"],
    ["chờ duyệt chưa hẹn giờ", "PENDING"],
    ["đã lên lịch", "SCHEDULED"],
    ["đã đến giờ đăng", "DUE"],
    ["đang đăng", "PUBLISHED"],
    ["nháp từng đăng", "DRAFT"],
  ] as const)("%s → %s", (label, expected) => {
    expect(deriveProjectPublicationState(states[label], NOW)).toBe(expected);
  });

  /**
   * PENDING mang tổ hợp lịch dị dạng (hai mốc không khớp nhau) rơi về `PENDING`
   * — fail closed. Không được coi là lịch hợp lệ, vì thao tác huỷ lịch sẽ xoá
   * mất một mốc công khai có thật.
   */
  it("tổ hợp lịch dị dạng rơi về PENDING, không phải SCHEDULED", () => {
    const malformed = make({
      contentStatus: "PENDING",
      scheduledAt: FUTURE,
      publishedAt: PAST,
    });

    expect(deriveProjectPublicationState(malformed, NOW)).toBe("PENDING");
    expect(isActiveFutureProjectSchedule(malformed, NOW)).toBe(false);
  });
});

describe("vị từ lịch của dự án", () => {
  it("lịch tương lai hợp lệ", () => {
    expect(isActiveFutureProjectSchedule(states["đã lên lịch"], NOW)).toBe(true);
    expect(isDueProjectSchedule(states["đã lên lịch"], NOW)).toBe(false);
  });

  it("lịch đã tới hạn", () => {
    expect(isDueProjectSchedule(states["đã đến giờ đăng"], NOW)).toBe(true);
    expect(isActiveFutureProjectSchedule(states["đã đến giờ đăng"], NOW)).toBe(
      false,
    );
  });

  it("lịch tương lai KHÔNG bị coi là lịch sử xuất bản", () => {
    expect(projectHasHistoricalPublication(states["đã lên lịch"], NOW)).toBe(
      false,
    );
  });

  it("nháp từng đăng LÀ lịch sử xuất bản", () => {
    expect(projectHasHistoricalPublication(states["nháp từng đăng"], NOW)).toBe(
      true,
    );
  });
});

describe("canScheduleProject", () => {
  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s hẹn được giờ cho nháp sạch và cho dự án chờ duyệt",
    (role) => {
      expect(canScheduleProject(role, states["nháp sạch"], NOW)).toBe(true);
      expect(
        canScheduleProject(role, states["chờ duyệt chưa hẹn giờ"], NOW),
      ).toBe(true);
    },
  );

  it("EDITOR KHÔNG bao giờ hẹn được giờ", () => {
    for (const state of Object.values(states)) {
      expect(canScheduleProject("EDITOR", state, NOW)).toBe(false);
    }
  });

  it("vai trò thiếu → không hẹn được giờ (fail closed)", () => {
    expect(canScheduleProject(undefined, states["nháp sạch"], NOW)).toBe(false);
    expect(canScheduleProject(null, states["nháp sạch"], NOW)).toBe(false);
  });

  it("đang đăng → không hẹn giờ (một slug là một URL công khai)", () => {
    expect(canScheduleProject("ADMIN", states["đang đăng"], NOW)).toBe(false);
  });

  it("nháp TỪNG đăng → không hẹn giờ (v1 chỉ lần công khai đầu)", () => {
    expect(canScheduleProject("ADMIN", states["nháp từng đăng"], NOW)).toBe(
      false,
    );
  });

  it("đã tới hạn → không hẹn lại (đã hiển thị công khai)", () => {
    expect(canScheduleProject("ADMIN", states["đã đến giờ đăng"], NOW)).toBe(
      false,
    );
  });
});

describe("projectScheduleActions", () => {
  it("nháp sạch: chỉ có Lên lịch", () => {
    expect(projectScheduleActions("ADMIN", states["nháp sạch"], NOW)).toEqual({
      schedule: true,
      reschedule: false,
      cancel: false,
    });
  });

  it("chờ duyệt chưa hẹn giờ: duyệt-bằng-cách-hẹn-giờ", () => {
    expect(
      projectScheduleActions("ADMIN", states["chờ duyệt chưa hẹn giờ"], NOW),
    ).toEqual({ schedule: true, reschedule: false, cancel: false });
  });

  it("đã lên lịch: Đổi lịch + Huỷ lịch, KHÔNG có Lên lịch", () => {
    expect(projectScheduleActions("ADMIN", states["đã lên lịch"], NOW)).toEqual({
      schedule: false,
      reschedule: true,
      cancel: true,
    });
  });

  /** Lịch đã qua giờ: dự án đang công khai — huỷ lịch sẽ bị backend từ chối 409. */
  it("đã đến giờ đăng: KHÔNG có thao tác lịch nào", () => {
    expect(
      projectScheduleActions("ADMIN", states["đã đến giờ đăng"], NOW),
    ).toEqual({ schedule: false, reschedule: false, cancel: false });
  });

  it("EDITOR: không có thao tác lịch nào ở mọi trạng thái", () => {
    for (const state of Object.values(states)) {
      expect(projectScheduleActions("EDITOR", state, NOW)).toEqual({
        schedule: false,
        reschedule: false,
        cancel: false,
      });
    }
  });
});

/**
 * §45 — quyền sửa của EDITOR phải siết theo lịch, y như bài viết. Đây là phần
 * dễ quên nhất khi thêm lịch cho một module đã có luật sửa từ batch trước.
 */
describe("canEditProject — siết theo lịch (Batch 9)", () => {
  it.each(["nháp sạch", "chờ duyệt chưa hẹn giờ"] as const)(
    "EDITOR sửa được: %s",
    (label) => {
      expect(canEditProject("EDITOR", states[label])).toBe(true);
    },
  );

  it.each([
    "đã lên lịch",
    "đã đến giờ đăng",
    "đang đăng",
    "nháp từng đăng",
  ] as const)("EDITOR KHÔNG sửa được: %s", (label) => {
    expect(canEditProject("EDITOR", states[label])).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s sửa được ở mọi trạng thái",
    (role) => {
      for (const state of Object.values(states)) {
        expect(canEditProject(role, state)).toBe(true);
      }
    },
  );

  it("vai trò thiếu / sai chính tả → không sửa được", () => {
    expect(canEditProject(undefined, states["nháp sạch"])).toBe(false);
    for (const role of ["Admin", "admin", "editor", ""]) {
      expect(canEditProject(role as Role, states["đang đăng"])).toBe(false);
    }
  });

  /**
   * Bảo hiểm chống nhầm hai khái niệm: `Project.status` (tình trạng thi công)
   * KHÔNG được ảnh hưởng tới quyền sửa. Ở đây một dự án nháp sạch vẫn sửa được
   * bất kể tình trạng thi công là gì — vị từ chỉ đọc `contentStatus`.
   */
  it("tình trạng thi công không ảnh hưởng quyền sửa", () => {
    const draft = make({ contentStatus: "DRAFT" as ContentStatus });
    expect(canEditProject("EDITOR", draft)).toBe(true);
  });
});
