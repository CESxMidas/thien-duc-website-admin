/**
 * Luật nghiệp vụ Batch 4 (lên lịch đăng tin — CHỈ cho lần công khai đầu tiên).
 *
 * Điểm dễ sai nhất: `publishedAt != null` KHÔNG có nghĩa là bài đã từng công
 * khai — chính lệnh đặt lịch cũng ghi `publishedAt = scheduledAt` ở tương lai.
 * Thiếu phép tách này thì hoặc mọi bài đã đặt lịch đều không đổi lịch được nữa,
 * hoặc một bài từng đăng năm 2020 bị hẹn lịch và mất mốc lịch sử.
 */
import { describe, it, expect } from "vitest";

import {
  MAX_SCHEDULE_HORIZON_MS,
  MIN_SCHEDULE_LEAD_MS,
  NEAR_SCHEDULE_WARNING_MS,
  bySoonestSchedule,
  canScheduleNews,
  canScheduleRole,
  derivePublicationState,
  hasHistoricalPublication,
  isActiveFutureSchedule,
  isDueSchedule,
  newsScheduleActions,
  validateScheduleFields,
  type SchedulableContent,
} from "@/lib/news-schedule";
import type { Role } from "@/types";

const NOW = new Date("2026-08-13T10:00:00.000Z");

const FUTURE = "2026-08-20T01:00:00.000Z";
const PAST = "2026-08-01T01:00:00.000Z";

/** Bài nháp chưa từng công khai — điểm xuất phát của mọi lịch hợp lệ. */
const draft: SchedulableContent = {
  status: "DRAFT",
  scheduledAt: null,
  publishedAt: null,
};

/** Chờ duyệt thật (EDITOR gửi lên), không có lịch. */
const pending: SchedulableContent = {
  status: "PENDING",
  scheduledAt: null,
  publishedAt: null,
};

/** Lịch tương lai hợp lệ: PENDING + hai mốc trùng khít, ở tương lai. */
const scheduled: SchedulableContent = {
  status: "PENDING",
  scheduledAt: FUTURE,
  publishedAt: FUTURE,
};

/** Lịch đã tới hạn, reconciler chưa chạy — bài ĐANG hiển thị công khai. */
const due: SchedulableContent = {
  status: "PENDING",
  scheduledAt: PAST,
  publishedAt: PAST,
};

const published: SchedulableContent = {
  status: "PUBLISHED",
  scheduledAt: null,
  publishedAt: PAST,
};

/** Từng đăng thật rồi bị gỡ về nháp — v1 KHÔNG cho hẹn giờ đăng lại. */
const historicalDraft: SchedulableContent = {
  status: "DRAFT",
  scheduledAt: null,
  publishedAt: PAST,
};

const ADMINS: Role[] = ["ADMIN", "SUPER_ADMIN"];

describe("derivePublicationState", () => {
  it("nháp chưa từng đăng → DRAFT", () => {
    expect(derivePublicationState(draft, NOW)).toBe("DRAFT");
  });

  it("chờ duyệt không có lịch → PENDING", () => {
    expect(derivePublicationState(pending, NOW)).toBe("PENDING");
  });

  it("lịch tương lai hợp lệ → SCHEDULED", () => {
    expect(derivePublicationState(scheduled, NOW)).toBe("SCHEDULED");
  });

  it("đúng ngay khoảnh khắc tới hạn → DUE (không còn là SCHEDULED)", () => {
    const exact: SchedulableContent = {
      status: "PENDING",
      scheduledAt: NOW.toISOString(),
      publishedAt: NOW.toISOString(),
    };
    expect(derivePublicationState(exact, NOW)).toBe("DUE");
  });

  it("đã qua giờ hẹn → DUE", () => {
    expect(derivePublicationState(due, NOW)).toBe("DUE");
  });

  it("đã đăng → PUBLISHED", () => {
    expect(derivePublicationState(published, NOW)).toBe("PUBLISHED");
  });

  it("nháp từng đăng vẫn là DRAFT (mốc lịch sử không đổi trạng thái)", () => {
    expect(derivePublicationState(historicalDraft, NOW)).toBe("DRAFT");
  });

  it.each<[string, SchedulableContent]>([
    [
      "PENDING có scheduledAt nhưng publishedAt = null",
      { status: "PENDING", scheduledAt: FUTURE, publishedAt: null },
    ],
    [
      "PENDING có hai mốc LỆCH nhau",
      { status: "PENDING", scheduledAt: FUTURE, publishedAt: PAST },
    ],
    [
      "PENDING mang mốc không phân giải được",
      { status: "PENDING", scheduledAt: "rác", publishedAt: "rác" },
    ],
  ])("tổ hợp dị dạng — %s → PENDING (fail closed)", (_label, post) => {
    expect(derivePublicationState(post, NOW)).toBe("PENDING");
  });

  it("DRAFT mang scheduledAt sót lại vẫn là DRAFT", () => {
    expect(
      derivePublicationState(
        { status: "DRAFT", scheduledAt: FUTURE, publishedAt: FUTURE },
        NOW,
      ),
    ).toBe("DRAFT");
  });
});

describe("vị từ lịch", () => {
  it("isActiveFutureSchedule chỉ đúng với PENDING + hai mốc trùng + tương lai", () => {
    expect(isActiveFutureSchedule(scheduled, NOW)).toBe(true);
    expect(isActiveFutureSchedule(due, NOW)).toBe(false);
    expect(isActiveFutureSchedule(draft, NOW)).toBe(false);
    expect(
      isActiveFutureSchedule(
        { status: "PENDING", scheduledAt: FUTURE, publishedAt: PAST },
        NOW,
      ),
    ).toBe(false);
  });

  it("isDueSchedule đúng khi mốc đã qua, sai khi còn ở tương lai", () => {
    expect(isDueSchedule(due, NOW)).toBe(true);
    expect(isDueSchedule(scheduled, NOW)).toBe(false);
  });

  it("hasHistoricalPublication tách lịch tương lai khỏi lần đăng đã xảy ra", () => {
    // Lịch tương lai: publishedAt chỉ là DỰ ĐỊNH, chưa bao giờ thành sự thật.
    expect(hasHistoricalPublication(scheduled, NOW)).toBe(false);
    // Đã tới hạn: bài đã ra công khai theo vị từ hiển thị của backend.
    expect(hasHistoricalPublication(due, NOW)).toBe(true);
    expect(hasHistoricalPublication(historicalDraft, NOW)).toBe(true);
    expect(hasHistoricalPublication(draft, NOW)).toBe(false);
  });
});

describe("quyền đặt lịch theo vai trò", () => {
  it("ADMIN và SUPER_ADMIN được đặt lịch, EDITOR thì không", () => {
    expect(canScheduleRole("ADMIN")).toBe(true);
    expect(canScheduleRole("SUPER_ADMIN")).toBe(true);
    expect(canScheduleRole("EDITOR")).toBe(false);
    expect(canScheduleRole(null)).toBe(false);
    expect(canScheduleRole(undefined)).toBe(false);
  });

  it.each(ADMINS)("%s: nháp/chờ duyệt chưa từng đăng đều đặt lịch được", (role) => {
    expect(canScheduleNews(role, draft, NOW)).toBe(true);
    expect(canScheduleNews(role, pending, NOW)).toBe(true);
  });

  it.each(ADMINS)("%s: lịch tương lai hợp lệ vẫn đổi được", (role) => {
    expect(canScheduleNews(role, scheduled, NOW)).toBe(true);
  });

  it.each(ADMINS)("%s: bài ĐANG đăng không đặt lịch được", (role) => {
    expect(canScheduleNews(role, published, NOW)).toBe(false);
  });

  it.each(ADMINS)("%s: bài TỪNG đăng (đã gỡ về nháp) không đặt lịch được", (role) => {
    expect(canScheduleNews(role, historicalDraft, NOW)).toBe(false);
  });

  it.each(ADMINS)("%s: lịch đã tới hạn không đặt lịch mới được", (role) => {
    expect(canScheduleNews(role, due, NOW)).toBe(false);
  });

  it("EDITOR không đặt lịch được ở BẤT KỲ trạng thái nào", () => {
    for (const post of [draft, pending, scheduled, due, published, historicalDraft]) {
      expect(canScheduleNews("EDITOR", post, NOW)).toBe(false);
    }
  });
});

describe("newsScheduleActions — ma trận nút", () => {
  it.each(ADMINS)("%s: nháp chưa từng đăng → chỉ Lên lịch", (role) => {
    expect(newsScheduleActions(role, draft, NOW)).toEqual({
      schedule: true,
      reschedule: false,
      cancel: false,
    });
  });

  it.each(ADMINS)("%s: chờ duyệt chưa từng đăng → chỉ Lên lịch", (role) => {
    expect(newsScheduleActions(role, pending, NOW)).toEqual({
      schedule: true,
      reschedule: false,
      cancel: false,
    });
  });

  it.each(ADMINS)("%s: lịch tương lai → Đổi lịch + Huỷ lịch, không Lên lịch", (role) => {
    expect(newsScheduleActions(role, scheduled, NOW)).toEqual({
      schedule: false,
      reschedule: true,
      cancel: true,
    });
  });

  it.each(ADMINS)("%s: đã tới hạn → KHÔNG có nút nào (huỷ lịch chắc chắn 409)", (role) => {
    expect(newsScheduleActions(role, due, NOW)).toEqual({
      schedule: false,
      reschedule: false,
      cancel: false,
    });
  });

  it.each(ADMINS)("%s: đã đăng → không có nút nào", (role) => {
    expect(newsScheduleActions(role, published, NOW)).toEqual({
      schedule: false,
      reschedule: false,
      cancel: false,
    });
  });

  it.each(ADMINS)("%s: nháp từng đăng → không có nút nào", (role) => {
    expect(newsScheduleActions(role, historicalDraft, NOW)).toEqual({
      schedule: false,
      reschedule: false,
      cancel: false,
    });
  });

  it("EDITOR: không có nút đặt lịch ở mọi trạng thái", () => {
    for (const post of [draft, pending, scheduled, due, published, historicalDraft]) {
      expect(newsScheduleActions("EDITOR", post, NOW)).toEqual({
        schedule: false,
        reschedule: false,
        cancel: false,
      });
    }
  });
});

describe("validateScheduleFields", () => {
  it("hợp lệ → instant kèm offset +07:00", () => {
    const result = validateScheduleFields("2026-08-20", "08:00", NOW);
    expect(result).toMatchObject({
      ok: true,
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  it("thiếu ngày / thiếu giờ báo đúng ô", () => {
    expect(validateScheduleFields("", "08:00", NOW)).toMatchObject({
      ok: false,
      field: "date",
    });
    expect(validateScheduleFields("2026-08-20", "", NOW)).toMatchObject({
      ok: false,
      field: "time",
    });
  });

  it("ngày không có thật bị chặn trước khi gọi API", () => {
    expect(validateScheduleFields("2026-02-31", "08:00", NOW)).toMatchObject({
      ok: false,
      field: "date",
    });
  });

  it("đúng ngưỡng 60 giây: bằng thì qua, thiếu 1 giây thì chặn", () => {
    // 17:00 giờ VN = 10:00Z. Đứng ở 09:59:00Z là còn đúng 60 giây.
    const exactly60s = new Date("2026-08-13T09:59:00.000Z");
    expect(validateScheduleFields("2026-08-13", "17:00", exactly60s)).toEqual({
      ok: true,
      scheduledAt: "2026-08-13T17:00:00+07:00",
      leadMs: MIN_SCHEDULE_LEAD_MS,
    });

    const oneSecondShort = new Date("2026-08-13T09:59:01.000Z");
    expect(
      validateScheduleFields("2026-08-13", "17:00", oneSecondShort),
    ).toMatchObject({ ok: false, field: "time" });
  });

  it("mốc trong quá khứ bị chặn", () => {
    expect(validateScheduleFields("2026-08-01", "08:00", NOW)).toMatchObject({
      ok: false,
      field: "time",
    });
  });

  it("quá 2 năm bị chặn, sát dưới trần thì qua", () => {
    const withinHorizon = new Date(
      NOW.getTime() + MAX_SCHEDULE_HORIZON_MS - 24 * 60 * 60 * 1000,
    );
    const fieldsInside = withinHorizon.toISOString().slice(0, 10);
    expect(
      validateScheduleFields(fieldsInside, "00:00", NOW).ok,
    ).toBe(true);

    expect(validateScheduleFields("2030-08-20", "08:00", NOW)).toMatchObject({
      ok: false,
      field: "date",
    });
  });

  it("cảnh báo 'rất gần' là ngưỡng 15 phút, không phải điều kiện chặn", () => {
    const soon = validateScheduleFields("2026-08-13", "17:10", NOW); // +10 phút
    expect(soon.ok).toBe(true);
    if (soon.ok) {
      expect(soon.leadMs).toBeLessThan(NEAR_SCHEDULE_WARNING_MS);
    }
  });
});

describe("bySoonestSchedule", () => {
  it("xếp lịch gần nhất lên trước, bài thiếu mốc xuống cuối", () => {
    const rows: SchedulableContent[] = [
      { status: "PENDING", scheduledAt: null, publishedAt: null },
      { status: "PENDING", scheduledAt: FUTURE, publishedAt: FUTURE },
      { status: "PENDING", scheduledAt: PAST, publishedAt: PAST },
    ];
    expect([...rows].sort(bySoonestSchedule).map((r) => r.scheduledAt)).toEqual([
      PAST,
      FUTURE,
      null,
    ]);
  });
});
