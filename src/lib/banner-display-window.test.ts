import { describe, it, expect } from "vitest";

import {
  DISPLAY_STATE_LABEL,
  NO_END_LABEL,
  NO_START_LABEL,
  deriveDisplayState,
  formatBound,
  toDisplayWindowFields,
  validateDisplayWindowFields,
  type DisplayWindowFields,
} from "@/lib/banner-display-window";

/**
 * Cửa sổ hiển thị banner — phía Admin.
 *
 * Đồng hồ LUÔN được truyền vào, không có `Date.now()` trần và không có `sleep`:
 * trạng thái suy ra phải tất định để test không bao giờ nhấp nháy theo giờ chạy.
 */

const at = (iso: string) => new Date(iso);

const NOW = at("2026-09-15T00:00:00.000Z");
const FROM = "2026-09-10T00:00:00.000Z";
const UNTIL = "2026-09-20T00:00:00.000Z";

const fields = (patch: Partial<DisplayWindowFields> = {}): DisplayWindowFields => ({
  fromDate: "",
  fromTime: "",
  untilDate: "",
  untilTime: "",
  ...patch,
});

describe("deriveDisplayState — trạng thái suy ra (không lưu DB)", () => {
  it("không biên nào → ALWAYS", () => {
    expect(
      deriveDisplayState({ displayFrom: null, displayUntil: null }, NOW),
    ).toBe("ALWAYS");
  });

  it("chưa tới biên dưới → UPCOMING", () => {
    expect(
      deriveDisplayState(
        { displayFrom: "2026-09-30T00:00:00.000Z", displayUntil: null },
        NOW,
      ),
    ).toBe("UPCOMING");
  });

  it("đã qua biên trên → EXPIRED", () => {
    expect(
      deriveDisplayState(
        { displayFrom: null, displayUntil: "2026-09-01T00:00:00.000Z" },
        NOW,
      ),
    ).toBe("EXPIRED");
  });

  it("ở giữa hai biên → ACTIVE", () => {
    expect(
      deriveDisplayState({ displayFrom: FROM, displayUntil: UNTIL }, NOW),
    ).toBe("ACTIVE");
  });

  it("chỉ có biên dưới đã qua → ACTIVE (không phải ALWAYS)", () => {
    expect(
      deriveDisplayState({ displayFrom: FROM, displayUntil: null }, NOW),
    ).toBe("ACTIVE");
  });

  /** Cùng luật nửa mở với backend: vào đúng mốc bắt đầu là hiện, đúng mốc kết thúc là tắt. */
  describe("BIÊN chính xác — khớp khoảng nửa mở của backend", () => {
    it.each([
      ["một mili giây trước mốc bắt đầu", "2026-09-09T23:59:59.999Z", "UPCOMING"],
      ["ĐÚNG mốc bắt đầu", FROM, "ACTIVE"],
      ["ở giữa", "2026-09-15T00:00:00.000Z", "ACTIVE"],
      ["một mili giây trước mốc kết thúc", "2026-09-19T23:59:59.999Z", "ACTIVE"],
      ["ĐÚNG mốc kết thúc", UNTIL, "EXPIRED"],
      ["sau mốc kết thúc", "2026-09-21T00:00:00.000Z", "EXPIRED"],
    ])("%s → %s", (_label, instant, expected) => {
      expect(
        deriveDisplayState({ displayFrom: FROM, displayUntil: UNTIL }, at(instant)),
      ).toBe(expected);
    });
  });

  it("không dùng từ vựng xuất bản trong nhãn", () => {
    const labels = Object.values(DISPLAY_STATE_LABEL).join(" ").toLowerCase();
    for (const forbidden of ["xuất bản", "lên lịch", "đăng bài", "duyệt"]) {
      expect(labels).not.toContain(forbidden);
    }
  });

  /** Cửa sổ đảo ngược (chỉ vào được nếu sửa tay DB): mọi nhãn đều là "không hiện". */
  it("cửa sổ đảo ngược: luôn rơi vào UPCOMING hoặc EXPIRED", () => {
    const broken = { displayFrom: UNTIL, displayUntil: FROM };
    for (const instant of [
      "2026-09-05T00:00:00.000Z",
      "2026-09-15T00:00:00.000Z",
      "2026-09-25T00:00:00.000Z",
    ]) {
      expect(["UPCOMING", "EXPIRED"]).toContain(
        deriveDisplayState(broken, at(instant)),
      );
    }
  });
});

describe("formatBound — hiển thị theo giờ Việt Nam", () => {
  it("null dùng nhãn nói rõ hệ quả, không phải chuỗi rỗng", () => {
    expect(formatBound(null, NO_START_LABEL)).toBe("Ngay lập tức");
    expect(formatBound(null, NO_END_LABEL)).toBe("Không giới hạn");
  });

  it("instant UTC hiện thành giờ VN dd/MM/yyyy", () => {
    // 01:00Z = 08:00 giờ Việt Nam cùng ngày.
    expect(formatBound("2026-09-01T01:00:00.000Z", NO_START_LABEL)).toBe(
      "01/09/2026 · 08:00",
    );
  });

  it("qua nửa đêm UTC vẫn ra đúng ngày Việt Nam", () => {
    // 17:00Z ngày 31/08 = 00:00 ngày 01/09 giờ VN.
    expect(formatBound("2026-08-31T17:00:00.000Z", NO_START_LABEL)).toBe(
      "01/09/2026 · 00:00",
    );
  });
});

describe("validateDisplayWindowFields — kiểm bốn ô nhập", () => {
  it("bốn ô rỗng: hợp lệ, cả hai biên null", () => {
    const result = validateDisplayWindowFields(fields());
    expect(result).toEqual({
      ok: true,
      window: { displayFrom: null, displayUntil: null },
    });
  });

  /** §43 — giờ Việt Nam người dùng gõ phải ra đúng instant. */
  it("08:00 ngày 01/09 giờ VN → instant kèm offset +07:00", () => {
    const result = validateDisplayWindowFields(
      fields({ fromDate: "2026-09-01", fromTime: "08:00" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.window.displayFrom).toBe("2026-09-01T08:00:00+07:00");
    // Điều thật sự quan trọng: INSTANT, không phải hình dạng chuỗi.
    expect(Date.parse(result.window.displayFrom!)).toBe(
      Date.parse("2026-09-01T01:00:00.000Z"),
    );
    expect(result.window.displayUntil).toBeNull();
  });

  it("chỉ đặt biên trên: biên dưới vẫn null", () => {
    const result = validateDisplayWindowFields(
      fields({ untilDate: "2026-12-31", untilTime: "23:59" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.window.displayFrom).toBeNull();
    expect(result.window.displayUntil).toBe("2026-12-31T23:59:00+07:00");
  });

  it("đủ hai biên, từ < đến: hợp lệ", () => {
    const result = validateDisplayWindowFields(
      fields({
        fromDate: "2026-09-01",
        fromTime: "08:00",
        untilDate: "2026-09-30",
        untilTime: "08:00",
      }),
    );
    expect(result.ok).toBe(true);
  });

  it.each([
    [
      "từ == đến",
      { fromDate: "2026-09-01", fromTime: "08:00", untilDate: "2026-09-01", untilTime: "08:00" },
    ],
    [
      "từ > đến",
      { fromDate: "2026-09-30", fromTime: "08:00", untilDate: "2026-09-01", untilTime: "08:00" },
    ],
  ])("%s: từ chối, lỗi trỏ vào ô “đến”", (_label, patch) => {
    const result = validateDisplayWindowFields(fields(patch));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("untilDate");
    expect(result.message).toContain("phải sau");
  });

  it("có ngày mà thiếu giờ: từ chối, KHÔNG tự đoán 00:00", () => {
    const result = validateDisplayWindowFields(
      fields({ fromDate: "2026-09-01" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("fromTime");
  });

  it("có giờ mà thiếu ngày: từ chối", () => {
    const result = validateDisplayWindowFields(
      fields({ untilTime: "08:00" }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.field).toBe("untilDate");
  });

  it("ngày không có thật (31/02): từ chối", () => {
    const result = validateDisplayWindowFields(
      fields({ fromDate: "2026-02-31", fromTime: "08:00" }),
    );
    expect(result.ok).toBe(false);
  });

  /**
   * §12 + §13 — ba luật của lịch xuất bản KHÔNG được áp ở đây. Test này là chốt
   * chặn: nếu ai đó "tiện tay" dùng lại `validateScheduleFields`, nó đỏ ngay.
   */
  describe("không thừa hưởng luật của lịch xuất bản", () => {
    it("mốc trong QUÁ KHỨ: hợp lệ", () => {
      expect(
        validateDisplayWindowFields(
          fields({ fromDate: "2020-01-01", fromTime: "08:00" }),
        ).ok,
      ).toBe(true);
    });

    it("mốc cách hiện tại hơn 2 năm: hợp lệ", () => {
      expect(
        validateDisplayWindowFields(
          fields({ untilDate: "2035-01-01", untilTime: "08:00" }),
        ).ok,
      ).toBe(true);
    });

    it("cửa sổ chỉ dài một phút: hợp lệ", () => {
      expect(
        validateDisplayWindowFields(
          fields({
            fromDate: "2026-09-01",
            fromTime: "08:00",
            untilDate: "2026-09-01",
            untilTime: "08:01",
          }),
        ).ok,
      ).toBe(true);
    });
  });
});

describe("toDisplayWindowFields — nạp cửa sổ đang lưu lên ô nhập", () => {
  it("hai biên null → bốn ô rỗng", () => {
    expect(
      toDisplayWindowFields({ displayFrom: null, displayUntil: null }),
    ).toEqual({ fromDate: "", fromTime: "", untilDate: "", untilTime: "" });
  });

  it("instant UTC → ô nhập theo giờ VN", () => {
    expect(
      toDisplayWindowFields({
        displayFrom: "2026-09-01T01:00:00.000Z",
        displayUntil: "2026-09-30T10:30:00.000Z",
      }),
    ).toEqual({
      fromDate: "2026-09-01",
      fromTime: "08:00",
      untilDate: "2026-09-30",
      untilTime: "17:30",
    });
  });

  /** Nạp lên rồi lưu lại mà không sửa gì: instant phải KHÔNG đổi. */
  it("round-trip khít theo instant", () => {
    const stored = {
      displayFrom: "2026-09-01T01:00:00.000Z",
      displayUntil: "2026-12-31T17:00:00.000Z",
    };
    const result = validateDisplayWindowFields(toDisplayWindowFields(stored));
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(Date.parse(result.window.displayFrom!)).toBe(
      Date.parse(stored.displayFrom),
    );
    expect(Date.parse(result.window.displayUntil!)).toBe(
      Date.parse(stored.displayUntil),
    );
  });
});
