import { describe, it, expect } from "vitest";

import { canEditNews, canEditPublishableContent } from "@/lib/content-editing";
import type { ContentStatus, Role } from "@/types";
import type { SchedulableContent } from "@/lib/news-schedule";

/**
 * Batch 8 — ranh giới quyền sửa nội dung, bản UI.
 *
 * Hai hàm ở đây phải khớp TỪNG CA với backend (`editorMayEditNews` và
 * `editorMayEditUnpublished`): lệch một ca là hoặc hiện nút chắc chắn nổ 403,
 * hoặc ẩn mất một thao tác chính đáng.
 */

const PAST = "2026-08-01T01:00:00.000Z";
const FUTURE = "2099-08-20T01:00:00.000Z";

function post(overrides: Partial<SchedulableContent>): SchedulableContent {
  return {
    status: "DRAFT",
    scheduledAt: null,
    publishedAt: null,
    ...overrides,
  };
}

/** Sáu trạng thái xuất bản của một bài viết, theo đúng ba cột persisted. */
const newsStates = {
  "nháp chưa từng công khai": post({}),
  "chờ duyệt chưa hẹn giờ": post({ status: "PENDING" }),
  "đã lên lịch": post({
    status: "PENDING",
    scheduledAt: FUTURE,
    publishedAt: FUTURE,
  }),
  "lịch đã tới hạn": post({
    status: "PENDING",
    scheduledAt: PAST,
    publishedAt: PAST,
  }),
  "đang đăng": post({ status: "PUBLISHED", publishedAt: PAST }),
  "nháp từng đăng": post({ status: "DRAFT", publishedAt: PAST }),
} satisfies Record<string, SchedulableContent>;

describe("canEditNews — EDITOR", () => {
  it.each(["nháp chưa từng công khai", "chờ duyệt chưa hẹn giờ"] as const)(
    "%s → sửa được",
    (label) => {
      expect(canEditNews("EDITOR", newsStates[label])).toBe(true);
    },
  );

  it.each([
    "đã lên lịch",
    "lịch đã tới hạn",
    "đang đăng",
    "nháp từng đăng",
  ] as const)("%s → KHÔNG sửa được", (label) => {
    expect(canEditNews("EDITOR", newsStates[label])).toBe(false);
  });

  /**
   * Tổ hợp dị dạng: PENDING có lịch nhưng thiếu `publishedAt`. Không nên tồn
   * tại, nhưng nếu có thì phải fail closed — vế `scheduledAt === null` là lớp
   * chốt thứ hai đúng cho ca này.
   */
  it("PENDING có lịch nhưng thiếu publishedAt → fail closed", () => {
    expect(
      canEditNews("EDITOR", post({ status: "PENDING", scheduledAt: FUTURE })),
    ).toBe(false);
  });
});

describe("canEditNews — ADMIN / SUPER_ADMIN không bị siết", () => {
  const labels = Object.keys(newsStates) as (keyof typeof newsStates)[];

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s sửa được ở cả sáu trạng thái",
    (role) => {
      for (const label of labels) {
        expect(canEditNews(role, newsStates[label])).toBe(true);
      }
    },
  );

  it("vai trò thiếu → không sửa được gì (fail closed)", () => {
    for (const label of labels) {
      expect(canEditNews(undefined, newsStates[label])).toBe(false);
      expect(canEditNews(null, newsStates[label])).toBe(false);
    }
  });

  /** Chuỗi vai trò phải khớp tuyệt đối — biến thể sai chính tả không lên quyền. */
  it("biến thể sai chính tả không được coi là quản trị", () => {
    for (const role of ["Admin", "admin", "super_admin", ""]) {
      expect(canEditNews(role as Role, newsStates["đang đăng"])).toBe(false);
    }
  });
});

describe("canEditPublishableContent — Dự án / Dự án hợp tác / Trang", () => {
  it.each(["DRAFT", "PENDING"] as ContentStatus[])(
    "EDITOR sửa được nội dung %s",
    (status) => {
      expect(canEditPublishableContent("EDITOR", status)).toBe(true);
    },
  );

  it("EDITOR KHÔNG sửa được nội dung PUBLISHED", () => {
    expect(canEditPublishableContent("EDITOR", "PUBLISHED")).toBe(false);
  });

  it.each(["ADMIN", "SUPER_ADMIN"] as const)(
    "%s sửa được cả nội dung PUBLISHED",
    (role) => {
      expect(canEditPublishableContent(role, "PUBLISHED")).toBe(true);
    },
  );

  it("vai trò thiếu → không sửa được (fail closed)", () => {
    expect(canEditPublishableContent(undefined, "DRAFT")).toBe(false);
    expect(canEditPublishableContent(null, "DRAFT")).toBe(false);
  });
});
