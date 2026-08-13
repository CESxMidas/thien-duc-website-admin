/**
 * Lịch đăng là field DUY NHẤT trong CMS mà sai một phép quy đổi múi giờ là bài
 * lên sai giờ, không có thông báo lỗi nào. Bộ test này khoá ba thứ:
 *
 *  1. Chuỗi gửi backend luôn kèm offset `+07:00` (backend từ chối chuỗi trần).
 *  2. UTC → hai ô nhập cho ra đúng giờ Việt Nam, và round-trip giữ NGUYÊN instant.
 *  3. Không hàm nào ở đây đọc múi giờ của máy — kiểm bằng cách theo dõi các
 *     getter local của `Date`, thay vì tin vào biến môi trường `TZ` (đặt lại TZ
 *     sau khi tiến trình Node đã khởi động là không đáng tin).
 */
import { describe, it, expect, vi, afterEach } from "vitest";

import {
  VIETNAM_TIMEZONE_LABEL,
  VIETNAM_UTC_OFFSET,
  composeVietnamInstant,
  formatVietnamDateTime,
  formatVietnamSentence,
  isRealCalendarDate,
  isValidClockTime,
  toVietnamFields,
} from "@/lib/vietnam-time";

/** Các getter/formatter phụ thuộc múi giờ máy — không hàm nào được chạm vào. */
const LOCAL_TIME_APIS = [
  "getFullYear",
  "getMonth",
  "getDate",
  "getHours",
  "getMinutes",
  "getTimezoneOffset",
  "toLocaleString",
  "toLocaleDateString",
  "toLocaleTimeString",
] as const;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("composeVietnamInstant — ghép ngày + giờ thành instant", () => {
  it("gắn offset +07:00 tường minh (hình dạng backend bắt buộc)", () => {
    expect(composeVietnamInstant("2026-08-20", "08:00")).toBe(
      "2026-08-20T08:00:00+07:00",
    );
    expect(VIETNAM_UTC_OFFSET).toBe("+07:00");
  });

  it("giữ nguyên nửa đêm và cuối ngày", () => {
    expect(composeVietnamInstant("2026-01-01", "00:00")).toBe(
      "2026-01-01T00:00:00+07:00",
    );
    expect(composeVietnamInstant("2026-12-31", "23:59")).toBe(
      "2026-12-31T23:59:00+07:00",
    );
  });

  it("chấp nhận giờ có giây từ trình duyệt nhưng luôn ghi giây = 00", () => {
    expect(composeVietnamInstant("2026-08-20", "08:00:45")).toBe(
      "2026-08-20T08:00:00+07:00",
    );
  });

  it("ngày 29/02 năm nhuận hợp lệ, năm thường thì không", () => {
    expect(composeVietnamInstant("2028-02-29", "08:00")).toBe(
      "2028-02-29T08:00:00+07:00",
    );
    expect(composeVietnamInstant("2026-02-29", "08:00")).toBeNull();
  });

  it("ngày cuối tháng: 30/31 đúng theo từng tháng", () => {
    expect(composeVietnamInstant("2026-04-30", "08:00")).not.toBeNull();
    expect(composeVietnamInstant("2026-04-31", "08:00")).toBeNull();
    expect(composeVietnamInstant("2026-08-31", "08:00")).not.toBeNull();
  });

  it("ngày bị V8 cuộn (31/02) trả null thay vì lặng lẽ thành 03/03", () => {
    expect(isRealCalendarDate("2026-02-31")).toBe(false);
    expect(composeVietnamInstant("2026-02-31", "08:00")).toBeNull();
  });

  it.each([
    ["chuỗi rỗng", "", "08:00"],
    ["thiếu số 0 đầu", "2026-8-20", "08:00"],
    ["định dạng ngày kiểu VN", "20/08/2026", "08:00"],
    ["tháng 13", "2026-13-01", "08:00"],
  ])("ngày sai — %s → null", (_label, date, time) => {
    expect(composeVietnamInstant(date, time)).toBeNull();
  });

  it.each([
    ["chuỗi rỗng", ""],
    ["giờ 25", "25:00"],
    ["phút 60", "08:60"],
    ["thiếu phút", "08"],
  ])("giờ sai — %s → null", (_label, time) => {
    expect(isValidClockTime(time)).toBe(false);
    expect(composeVietnamInstant("2026-08-20", time)).toBeNull();
  });
});

describe("toVietnamFields — UTC về hai ô nhập theo giờ Việt Nam", () => {
  it("01:00Z là 08:00 giờ Việt Nam cùng ngày", () => {
    expect(toVietnamFields("2026-08-20T01:00:00.000Z")).toEqual({
      date: "2026-08-20",
      time: "08:00",
    });
  });

  it("mốc sát nửa đêm UTC nhảy sang NGÀY HÔM SAU ở Việt Nam", () => {
    expect(toVietnamFields("2026-08-19T17:00:00.000Z")).toEqual({
      date: "2026-08-20",
      time: "00:00",
    });
    expect(toVietnamFields("2026-08-19T16:59:00.000Z")).toEqual({
      date: "2026-08-19",
      time: "23:59",
    });
  });

  it("qua ranh giới năm và ngày nhuận", () => {
    expect(toVietnamFields("2025-12-31T17:00:00.000Z")).toEqual({
      date: "2026-01-01",
      time: "00:00",
    });
    expect(toVietnamFields("2028-02-28T17:30:00.000Z")).toEqual({
      date: "2028-02-29",
      time: "00:30",
    });
  });

  it("chuỗi hỏng trả null", () => {
    expect(toVietnamFields("không-phải-ngày")).toBeNull();
    expect(toVietnamFields("")).toBeNull();
  });

  it("round-trip giữ NGUYÊN instant tuyệt đối", () => {
    const source = "2026-08-20T01:00:00.000Z";
    const fields = toVietnamFields(source)!;
    const composed = composeVietnamInstant(fields.date, fields.time)!;

    expect(composed).toBe("2026-08-20T08:00:00+07:00");
    expect(Date.parse(composed)).toBe(Date.parse(source));
  });

  it("round-trip đúng ở nhiều mốc rải rác", () => {
    for (const iso of [
      "2026-01-01T00:00:00.000Z",
      "2026-06-15T12:34:00.000Z",
      "2027-11-30T16:59:00.000Z",
      "2028-02-28T17:00:00.000Z",
    ]) {
      const fields = toVietnamFields(iso)!;
      const composed = composeVietnamInstant(fields.date, fields.time)!;
      expect(Date.parse(composed)).toBe(Date.parse(iso));
    }
  });
});

describe("định dạng hiển thị", () => {
  it("dòng phụ dưới huy hiệu: 20/08/2026 · 08:00", () => {
    expect(formatVietnamDateTime("2026-08-20T01:00:00.000Z")).toBe(
      "20/08/2026 · 08:00",
    );
  });

  it("câu tóm tắt trong hộp thoại: 08:00, 20/08/2026", () => {
    expect(formatVietnamSentence("2026-08-20T01:00:00.000Z")).toBe(
      "08:00, 20/08/2026",
    );
  });

  it("chuỗi hỏng trả null để nơi gọi tự bỏ dòng phụ", () => {
    expect(formatVietnamDateTime("rác")).toBeNull();
    expect(formatVietnamSentence("rác")).toBeNull();
  });

  it("nhãn múi giờ là chữ hiển thị được, không phải mã vùng", () => {
    expect(VIETNAM_TIMEZONE_LABEL).toBe("GMT+7 — Việt Nam");
  });
});

describe("độc lập với múi giờ máy", () => {
  it("không hàm nào đọc giờ local của Date", () => {
    const spies = LOCAL_TIME_APIS.map((name) =>
      vi.spyOn(Date.prototype, name),
    );

    const fields = toVietnamFields("2026-08-20T01:00:00.000Z")!;
    composeVietnamInstant(fields.date, fields.time);
    formatVietnamDateTime("2026-08-20T01:00:00.000Z");
    formatVietnamSentence("2026-08-20T01:00:00.000Z");
    isRealCalendarDate("2026-08-20");

    for (const [index, spy] of spies.entries()) {
      expect(
        spy,
        `${LOCAL_TIME_APIS[index]} phụ thuộc múi giờ máy — không được dùng`,
      ).not.toHaveBeenCalled();
    }
  });

  it("kết quả không đổi khi instant được viết bằng offset khác", () => {
    // Cùng một instant, ba cách viết. Cả ba phải cho cùng hai ô nhập.
    const expected = { date: "2026-08-20", time: "08:00" };
    expect(toVietnamFields("2026-08-20T01:00:00.000Z")).toEqual(expected);
    expect(toVietnamFields("2026-08-20T08:00:00+07:00")).toEqual(expected);
    expect(toVietnamFields("2026-08-19T21:00:00-04:00")).toEqual(expected);
  });
});
