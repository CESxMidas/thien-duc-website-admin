/**
 * **Batch 10 — tạo dự án hợp tác kèm lệnh xuất bản.**
 *
 * Backend cố tình KHÔNG nhận `contentStatus` / `scheduledAt` / `publishedAt`
 * trong DTO nội dung, nên "tạo rồi hẹn giờ" là **hai lệnh**. Người dùng chỉ thấy
 * một thao tác, nhưng thứ tự và cách xử lý hỏng giữa chừng là hợp đồng phải khoá:
 *
 *  1. `POST /cooperation` — luôn ra bản nháp sạch (Batch 7).
 *  2. `PATCH /cooperation/<id BACKEND TRẢ VỀ>/schedule` (hoặc `.../status`).
 *
 * Định danh ở bước hai phải lấy từ response: model này dùng `id` (uuid) do
 * backend sinh, client không có cách nào biết trước.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { CooperationFormDialog } from "@/components/cooperation/CooperationFormDialog";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api/client";
import type { Role } from "@/types";

const { createProject, schedulePublication, updateStatus, role } = vi.hoisted(
  () => ({
    // `id` do backend sinh — client không dựng lại được. Lệnh thứ hai phải dùng
    // đúng chuỗi này.
    createProject: vi.fn(async (_payload: unknown) => ({
      id: "c-uuid-backend",
    })),
    schedulePublication: vi.fn(async (_args: unknown) => ({})),
    updateStatus: vi.fn(async (_args: unknown) => ({})),
    role: { current: "ADMIN" as Role },
  }),
);

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  const empty = () => ({ data: [], isLoading: false, isError: false });
  return {
    queryKeys: {},
    useCreateCooperationProject: mutation(createProject),
    useUpdateCooperationProject: mutation(async () => ({})),
    useUpdateCooperationStatus: mutation(updateStatus),
    useScheduleCooperationPublication: mutation(schedulePublication),
    useMedia: empty,
    useUploadMedia: mutation(async () => ({})),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "u1", name: "A", email: "a@b.c", role: role.current },
  }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

const NOW = new Date("2026-08-13T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  createProject.mockClear();
  createProject.mockResolvedValue({ id: "c-uuid-backend" });
  schedulePublication.mockClear();
  schedulePublication.mockResolvedValue({});
  updateStatus.mockClear();
  updateStatus.mockResolvedValue({});
  toastSuccess.mockClear();
  toastError.mockClear();
  role.current = "ADMIN";
});

afterEach(() => {
  vi.useRealTimers();
});

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(
    <QueryClientProvider client={client}>
      <CooperationFormDialog trigger={<Button>Thêm dự án hợp tác</Button>} />
    </QueryClientProvider>,
  );
  return user;
}

/** Mở form và điền các trường bắt buộc tối thiểu. */
async function openAndFill(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Thêm dự án hợp tác" }));
  const dialog = await screen.findByRole("dialog");

  const fill = async (label: RegExp | string, value: string) => {
    const field = within(dialog).getByLabelText(label);
    await user.clear(field);
    await user.type(field, value);
  };

  // BilingualField hiện ô tiếng Việt với nhãn của chính trường đó.
  await fill("Tên dự án", "Vista Verde");
  await fill("Địa điểm", "Quận 2, TP.HCM");
  await fill("Đối tác", "CapitaLand");
  await fill("Vai trò của Thiên Đức", "Đồng chủ đầu tư");
  await fill("Quy mô", "4 tòa tháp");
  await fill("Trạng thái dự án", "Đã bàn giao");
  return dialog;
}

describe("payload tạo — §43, §51", () => {
  it("KHÔNG mang contentStatus / scheduledAt / publishedAt", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    expect(createProject).toHaveBeenCalledTimes(1);
    const [payload] = createProject.mock.calls[0] as [Record<string, unknown>];
    expect(payload).not.toHaveProperty("contentStatus");
    expect(payload).not.toHaveProperty("scheduledAt");
    expect(payload).not.toHaveProperty("publishedAt");
  });

  /** `status` ở đây là TIẾN ĐỘ dự án — vẫn phải gửi lên như nội dung bình thường. */
  it("vẫn mang `status` (tiến độ dự án bằng chữ)", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    const [payload] = createProject.mock.calls[0] as [
      { status?: { vi: string } },
    ];
    expect(payload.status?.vi).toBe("Đã bàn giao");
  });

  it("chỉ một lệnh khi bấm Lưu nháp — không kèm lệnh xuất bản nào", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});

describe("tạo + đặt lịch — §43, §55", () => {
  it("chạy hai lệnh, lệnh hai dùng id BACKEND TRẢ VỀ", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.type(
      within(scheduleDialog).getByLabelText("Ngày đăng"),
      "2026-08-20",
    );
    await user.type(
      within(scheduleDialog).getByLabelText("Giờ đăng"),
      "08:00",
    );
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Lên lịch/ }),
    );

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledWith({
      id: "c-uuid-backend",
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  /** §62 — đóng hộp thoại lịch trước khi xác nhận thì KHÔNG được tạo gì. */
  it("huỷ hộp thoại lịch trước khi xác nhận → không POST, không đặt lịch", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Hủy|Huỷ/ }),
    );

    expect(createProject).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
    // Form vẫn còn dữ liệu đang gõ.
    expect(within(dialog).getByLabelText("Tên dự án")).toHaveValue(
      "Vista Verde",
    );
  });
});

describe("tạo + Đăng ngay / Gửi duyệt — §44", () => {
  it("ADMIN: tạo rồi gọi lệnh trạng thái PUBLISHED", async () => {
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(updateStatus).toHaveBeenCalledWith({
      id: "c-uuid-backend",
      status: "PUBLISHED",
    });
  });

  it("EDITOR: chỉ có Lưu nháp và Gửi duyệt — không có Đặt lịch", async () => {
    role.current = "EDITOR";
    const user = renderDialog();
    const dialog = await openAndFill(user);

    expect(
      within(dialog).getByRole("button", { name: "Lưu nháp" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /Gửi duyệt/ }),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Đặt lịch" })).toBeNull();
  });

  it("EDITOR: Gửi duyệt gọi lệnh trạng thái PENDING", async () => {
    role.current = "EDITOR";
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Gửi duyệt/ }));

    expect(updateStatus).toHaveBeenCalledWith({
      id: "c-uuid-backend",
      status: "PENDING",
    });
  });
});

describe("hỏng giữa chừng — §45, §60", () => {
  /**
   * Ca quan trọng nhất. Bản ghi ĐÃ được tạo; lệnh hai hỏng. Tạo lại sẽ sinh bản
   * trùng, tự xoá sẽ mất công biên tập. Đúng việc phải làm: giữ bản ghi, nói
   * thật, chỉ chỗ làm lại.
   */
  it("tạo xong nhưng đặt lịch hỏng → giữ bản ghi, KHÔNG tạo lại, báo thành công một phần", async () => {
    schedulePublication.mockRejectedValueOnce(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Dự án hợp tác này đã từng được đăng.",
      }),
    );
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await screen.findByRole("dialog", {
      name: /lịch đăng bài/i,
    });
    await user.type(
      within(scheduleDialog).getByLabelText("Ngày đăng"),
      "2026-08-20",
    );
    await user.type(
      within(scheduleDialog).getByLabelText("Giờ đăng"),
      "08:00",
    );
    await user.click(
      within(scheduleDialog).getByRole("button", { name: /Lên lịch/ }),
    );

    // Đúng MỘT lệnh tạo và MỘT lệnh lịch — không thử lại vòng nào.
    expect(createProject).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);

    const message = String(toastError.mock.calls.at(-1)?.[0] ?? "");
    expect(message).toContain("Đã lưu");
    expect(message).toContain("nháp");
    expect(message).toContain("Lên lịch");
  });

  it("tạo hỏng → KHÔNG chạy lệnh thứ hai", async () => {
    createProject.mockRejectedValueOnce(
      new ApiRequestError(400, {
        code: "BAD_REQUEST",
        message: "Tên dự án không hợp lệ.",
      }),
    );
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createProject).toHaveBeenCalledTimes(1);
    expect(updateStatus).not.toHaveBeenCalled();
  });

  it("tạo xong nhưng đổi trạng thái hỏng → giữ bản nháp, báo rõ", async () => {
    updateStatus.mockRejectedValueOnce(new ApiRequestError(403, { code: "FORBIDDEN", message: "Không có quyền." }));
    const user = renderDialog();
    const dialog = await openAndFill(user);

    await user.click(within(dialog).getByRole("button", { name: /Đăng ngay/ }));

    expect(createProject).toHaveBeenCalledTimes(1);
    const message = String(toastError.mock.calls.at(-1)?.[0] ?? "");
    expect(message).toContain("Đã lưu");
    expect(message).toContain("nháp");
  });
});

describe("chống bấm hai lần — §61", () => {
  it("hai cú click liên tiếp chỉ tạo một bản ghi", async () => {
    let release!: (value: { id: string }) => void;
    createProject.mockImplementationOnce(
      () =>
        new Promise<{ id: string }>((resolve) => {
          release = resolve;
        }),
    );

    const user = renderDialog();
    const dialog = await openAndFill(user);
    const save = within(dialog).getByRole("button", { name: "Lưu nháp" });

    await user.click(save);
    await user.click(save);

    expect(createProject).toHaveBeenCalledTimes(1);
    release({ id: "c-uuid-backend" });
  });
});
