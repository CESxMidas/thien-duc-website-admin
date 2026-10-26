import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { usePublicationClock } from "./use-publication-clock";

const START = Date.parse("2026-10-26T00:00:00Z");
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => vi.useRealTimers());

it("đánh thức đúng mốc lịch gần nhất và dọn timer khi đóng màn hình", () => {
  const { result, unmount } = renderHook(() =>
    usePublicationClock([new Date(START + 1_000).toISOString()]),
  );
  act(() => vi.advanceTimersByTime(999));
  expect(result.current.getTime()).toBe(START);
  act(() => vi.advanceTimersByTime(1));
  expect(result.current.getTime()).toBe(START + 1_000);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

it("cập nhật ngay khi quay lại tab sau khi máy nghỉ", () => {
  const { result } = renderHook(() => usePublicationClock([]));
  vi.setSystemTime(START + 120_000);
  act(() => window.dispatchEvent(new Event("focus")));
  expect(result.current.getTime()).toBe(START + 120_000);
});

it("nhận lịch mới sau khi API tải xong và bỏ qua lịch lỗi", () => {
  const { result, rerender } = renderHook(
    ({ schedules }) => usePublicationClock(schedules),
    { initialProps: { schedules: [] as (string | null)[] } },
  );
  rerender({
    schedules: ["invalid", null, new Date(START + 2_000).toISOString()],
  });
  act(() => vi.advanceTimersByTime(2_000));
  expect(result.current.getTime()).toBe(START + 2_000);
});
