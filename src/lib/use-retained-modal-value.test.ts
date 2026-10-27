import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useRetainedModalValue } from "./use-retained-modal-value";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
it("giữ bản ghi lúc đóng, không làm rỗng nội dung giữa animation", () => {
  const record = { id: "a", title: "Hồ sơ A" };
  const { result, rerender } = renderHook(
    ({ value }) => useRetainedModalValue(value),
    { initialProps: { value: record as typeof record | null } },
  );
  rerender({ value: null });
  expect(result.current).toEqual({ value: record, open: false });
  act(() => vi.advanceTimersByTime(180));
  expect(result.current.value).toBeNull();
});
it("mở lại nhanh phải hiện bản ghi mới và hủy nhịp gỡ cũ", () => {
  const a = { id: "a" };
  const b = { id: "b" };
  const { result, rerender } = renderHook(
    ({ value }) => useRetainedModalValue(value),
    { initialProps: { value: a as typeof a | null } },
  );
  rerender({ value: null });
  act(() => vi.advanceTimersByTime(100));
  rerender({ value: b });
  act(() => vi.advanceTimersByTime(180));
  expect(result.current).toEqual({ value: b, open: true });
});
