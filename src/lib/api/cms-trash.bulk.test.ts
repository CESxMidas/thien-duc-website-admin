import { beforeEach, describe, expect, it, vi } from "vitest";
import { bulkDeleteRecords } from "./cms-trash";
const state = vi.hoisted(() => ({ api: vi.fn() }));
vi.mock("./client", async (original) => ({
  ...(await original<typeof import("./client")>()),
  apiFetch: (...args: unknown[]) => state.api(...args),
}));

beforeEach(() => {
  vi.clearAllMocks();
});
describe("API xóa theo lô", () => {
  it("chia hơn 100 ID thành nhiều lô, giữ thứ tự và xác nhận vĩnh viễn", async () => {
    const ids = Array.from({ length: 251 }, (_, index) => String(index));
    state.api.mockImplementation((_url: string, options: { body: string }) =>
      Promise.resolve({
        succeededIds: JSON.parse(options.body).ids,
        failed: [],
        remainingIds: [],
      }),
    );
    expect(await bulkDeleteRecords("news", ids, true)).toEqual({
      succeededIds: ids,
      failed: [],
      remainingIds: [],
    });
    expect(
      state.api.mock.calls.map((call) => JSON.parse(call[1].body).ids.length),
    ).toEqual([100, 100, 51]);
    for (const call of state.api.mock.calls)
      expect(JSON.parse(call[1].body)).toMatchObject({
        mode: "permanent",
        confirm: true,
      });
  });
  it("mất quyền ở cuối một lô vẫn dừng, không gửi lô tiếp theo", async () => {
    const ids = Array.from({ length: 150 }, (_, index) => String(index));
    state.api.mockResolvedValue({
      succeededIds: ids.slice(0, 99),
      failed: [{ id: "99", status: 403, message: "Đã thu hồi quyền." }],
      remainingIds: [],
    });
    const result = await bulkDeleteRecords("news", ids, false);
    expect(result.succeededIds).toHaveLength(99);
    expect(result.remainingIds).toEqual(ids.slice(100));
    expect(state.api).toHaveBeenCalledTimes(1);
  });
  it("lỗi mạng sau lô đầu giữ kết quả cũ và toàn bộ mục chưa xác định", async () => {
    const ids = Array.from({ length: 151 }, (_, index) => String(index));
    state.api
      .mockResolvedValueOnce({
        succeededIds: ids.slice(0, 100),
        failed: [],
        remainingIds: [],
      })
      .mockRejectedValueOnce(new Error("Mất kết nối."));
    const result = await bulkDeleteRecords("media", ids, false);
    expect(result.succeededIds).toEqual(ids.slice(0, 100));
    expect(result.failed[0].id).toBe("100");
    expect(result.remainingIds).toEqual(ids.slice(101));
    expect(state.api).toHaveBeenCalledTimes(2);
  });
});
