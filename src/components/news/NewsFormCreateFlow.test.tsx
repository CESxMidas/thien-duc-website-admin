/**
 * Đặt lịch đăng NGAY TRONG form viết bài mới.
 *
 * Điều được khoá ở đây là **ranh giới kiến trúc**, không phải giao diện: backend
 * cố tình không nhận `scheduledAt` trong DTO nội dung, nên một thao tác của
 * người dùng phải nở ra thành đúng hai lệnh, đúng thứ tự, với slug lấy từ
 * response của lệnh đầu. Ba thứ dễ hỏng nhất:
 *
 *  1. Bài bị tạo TRƯỚC khi người dùng xác nhận mốc giờ (mở hộp thoại là đã tạo).
 *  2. Lệnh đặt lịch dùng slug người dùng gõ thay vì slug backend trả về.
 *  3. Đặt lịch hỏng sau khi tạo xong → người dùng tưởng chưa tạo, bấm lại thành
 *     hai bài trùng nhau.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { Button } from "@/components/ui/button";
import { ApiRequestError } from "@/lib/api/client";
import type { NewsCategory, NewsPost, Role } from "@/types";

const { createNews, schedulePublication, updateStatus, role, calls } =
  vi.hoisted(() => ({
    createNews: vi.fn(),
    schedulePublication: vi.fn(),
    updateStatus: vi.fn(),
    role: { current: "ADMIN" as Role },
    /** Thứ tự lệnh thực tế — thứ mà bài test này tồn tại để kiểm. */
    calls: { current: [] as string[] },
  }));

const categories: NewsCategory[] = [
  {
    id: "c1",
    slug: "tin-du-an",
    name: { vi: "Tin dự án" },
    order: 0,
    publishedCount: 0,
  },
];

/** Bài do backend trả về — slug ĐÃ CHUẨN HOÁ, khác slug gõ trong form. */
const CREATED: NewsPost = {
  id: "n1",
  slug: "slug-backend-chuan-hoa",
  title: { vi: "Bài mới" },
  summary: { vi: "Tóm tắt bài mới." },
  content: null,
  categoryId: "c1",
  category: null,
  author: null,
  image: null,
  eventDate: null,
  publishedAt: null,
  scheduledAt: null,
  status: "DRAFT",
  createdAt: "2026-08-13T10:00:00.000Z",
  updatedAt: "2026-08-13T10:00:00.000Z",
};

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<unknown>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useNewsCategories: () => ({ data: categories, isLoading: false }),
    useCreateNews: mutation(createNews),
    useUpdateNews: mutation(async () => {}),
    useUpdateNewsStatus: mutation(updateStatus),
    useScheduleNewsPublication: mutation(schedulePublication),
    useMedia: () => ({ data: [], isLoading: false }),
    useUploadMedia: mutation(async () => {}),
  };
});

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u1", name: "A", email: "a@b.c", role: role.current } }),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (message: string) => toastSuccess(message),
    error: (message: string) => toastError(message),
  },
}));

/** "Bây giờ" cố định: 13/08/2026 17:00 giờ VN — mốc hẹn 20/08 là tương lai hợp lệ. */
const NOW = new Date("2026-08-13T10:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  calls.current = [];
  createNews.mockReset();
  createNews.mockImplementation(async () => {
    calls.current.push("create");
    return CREATED;
  });
  schedulePublication.mockReset();
  schedulePublication.mockImplementation(async () => {
    calls.current.push("schedule");
    return CREATED;
  });
  updateStatus.mockReset();
  updateStatus.mockImplementation(async () => {
    calls.current.push("status");
    return CREATED;
  });
  toastSuccess.mockClear();
  toastError.mockClear();
  role.current = "ADMIN";
});

afterEach(() => {
  vi.useRealTimers();
});

async function openForm() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <NewsFormDialog trigger={<Button>Viết tin</Button>} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Viết tin" }));
  return { user, dialog: await screen.findByRole("dialog") };
}

/** Điền đủ các trường bắt buộc của form nội dung. */
async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
) {
  const viFields = within(dialog).getAllByRole("textbox", {
    name: "Tiếng Việt",
  });
  await user.type(viFields[0], "Bài mới");
  await user.type(viFields[1], "Tóm tắt bài mới đủ dài.");
  await user.type(
    within(dialog).getByLabelText("Đường dẫn"),
    "slug-nguoi-dung-go",
  );
  await user.click(
    within(dialog).getByRole("combobox", { name: /Chuyên mục/i }),
  );
  await user.click(await screen.findByRole("option", { name: "Tin dự án" }));
}

/** Mở hộp thoại lịch, điền 20/08/2026 08:00 rồi bấm xác nhận. */
async function pickSchedule(
  user: ReturnType<typeof userEvent.setup>,
  confirm = true,
) {
  const scheduleDialog = await screen.findByRole("dialog", {
    name: "Lên lịch đăng bài",
  });
  await user.type(
    within(scheduleDialog).getByLabelText("Ngày đăng"),
    "2026-08-20",
  );
  await user.type(within(scheduleDialog).getByLabelText("Giờ đăng"), "08:00");
  if (confirm) {
    await user.click(
      within(scheduleDialog).getByRole("button", { name: "Lên lịch" }),
    );
  }
  return scheduleDialog;
}

describe("form tạo tin — thao tác theo vai trò", () => {
  it('ADMIN thấy "Đặt lịch" và "Đăng ngay" bên cạnh "Lưu nháp"', async () => {
    const { dialog } = await openForm();

    expect(
      within(dialog).getByRole("button", { name: "Đặt lịch" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "Đăng ngay" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Lưu nháp" }),
    ).toBeInTheDocument();
  });

  it("EDITOR chỉ có lưu nháp và gửi duyệt, KHÔNG có đặt lịch", async () => {
    role.current = "EDITOR";
    const { dialog } = await openForm();

    expect(
      within(dialog).queryByRole("button", { name: "Đặt lịch" }),
    ).toBeNull();
    expect(
      within(dialog).queryByRole("button", { name: "Đăng ngay" }),
    ).toBeNull();
    expect(
      within(dialog).getByRole("button", { name: "Gửi duyệt" }),
    ).toBeInTheDocument();
  });

  /**
   * SUPER_ADMIN có ĐÚNG bộ thao tác của ADMIN.
   *
   * Trước đây họ không có nút đặt lịch, vì backend tự đăng bài do SUPER_ADMIN
   * tạo — bài ra đời đã công khai thì không hẹn giờ lần đầu được nữa. Backend
   * nay tạo bài ở nháp sạch cho mọi vai trò, nên ngoại lệ đó biến mất: quyền
   * đăng không còn đồng nghĩa với đăng ngay lúc tạo.
   */
  it("SUPER_ADMIN có cùng bộ thao tác với ADMIN", async () => {
    role.current = "SUPER_ADMIN";
    const { dialog } = await openForm();

    expect(
      within(dialog).getByRole("button", { name: "Đặt lịch" }),
    ).toBeEnabled();
    expect(
      within(dialog).getByRole("button", { name: "Đăng ngay" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: "Lưu nháp" }),
    ).toBeInTheDocument();
    // Không vai trò nào tự đăng bài chỉ vì bấm nút lưu.
    expect(
      within(dialog).queryByRole("button", { name: "Tạo bài viết" }),
    ).toBeNull();
  });
});

describe("tạo + đặt lịch — đường hạnh phúc", () => {
  it("chạy đúng hai lệnh, đúng thứ tự, với instant giờ VN", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user);

    await waitFor(() => expect(schedulePublication).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create", "schedule"]);
    expect(schedulePublication).toHaveBeenCalledWith({
      slug: CREATED.slug,
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
    // Đích của lịch không được len vào payload nội dung.
    expect(createNews.mock.calls[0][0]).not.toHaveProperty("scheduledAt");
    expect(createNews.mock.calls[0][0]).not.toHaveProperty("status");
    // Thành công trọn vẹn: đóng cả hai hộp thoại.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(toastSuccess).toHaveBeenCalledWith(
      expect.stringContaining("20/08/2026"),
    );
  });

  /**
   * Slug là thứ backend có quyền chuẩn hoá / khử trùng. Lệnh thứ hai phải bám
   * vào response, không phải vào ô nhập.
   */
  it("dùng slug BACKEND trả về, không dùng slug gõ trong form", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user);

    await waitFor(() => expect(schedulePublication).toHaveBeenCalledTimes(1));
    const [args] = schedulePublication.mock.calls[0] as [{ slug: string }];
    expect(args.slug).toBe("slug-backend-chuan-hoa");
    expect(args.slug).not.toBe("slug-nguoi-dung-go");
    // Slug người dùng gõ vẫn là thứ được GỬI ĐI khi tạo — backend mới là bên đổi.
    expect(createNews.mock.calls[0][0]).toMatchObject({
      slug: "slug-nguoi-dung-go",
    });
  });
});

describe("tạo + đặt lịch — các lối hỏng", () => {
  it("nội dung chưa hợp lệ thì không mở được hộp thoại lịch", async () => {
    const { user, dialog } = await openForm();

    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));

    expect(
      await within(dialog).findByText("Hãy chọn chuyên mục cho bài viết."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("dialog", { name: "Lên lịch đăng bài" }),
    ).toBeNull();
    expect(createNews).not.toHaveBeenCalled();
  });

  it("mốc giờ không hợp lệ thì CHƯA tạo bài", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));

    const scheduleDialog = await screen.findByRole("dialog", {
      name: "Lên lịch đăng bài",
    });
    // Mốc trong quá khứ — backend từ chối, và form cũng không được tạo bài trước.
    await user.type(
      within(scheduleDialog).getByLabelText("Ngày đăng"),
      "2026-08-01",
    );
    await user.type(within(scheduleDialog).getByLabelText("Giờ đăng"), "08:00");
    await user.click(
      within(scheduleDialog).getByRole("button", { name: "Lên lịch" }),
    );

    expect(
      await within(scheduleDialog).findByRole("alert"),
    ).toBeInTheDocument();
    expect(createNews).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
  });

  it("huỷ hộp thoại lịch: không lệnh nào chạy, nội dung còn nguyên", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await pickSchedule(user, false);
    await user.click(within(scheduleDialog).getByRole("button", { name: "Hủy" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Lên lịch đăng bài" }),
      ).toBeNull(),
    );
    expect(createNews).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
    // Form tạo còn đó, dữ liệu đang gõ chưa mất.
    const createDialog = await screen.findByRole("dialog");
    const slugField = within(createDialog).getByDisplayValue(
      "slug-nguoi-dung-go",
    );
    // Và vẫn thao tác được: hai modal chồng nhau dễ để lại khoá con trỏ / bẫy
    // tiêu điểm của lớp vừa đóng, khiến form dưới nhìn thấy mà không gõ được.
    await user.type(slugField, "-2");
    expect(slugField).toHaveValue("slug-nguoi-dung-go-2");
  });

  it("ESC trong hộp thoại lịch cũng không tạo bài", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user, false);
    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Lên lịch đăng bài" }),
      ).toBeNull(),
    );
    expect(createNews).not.toHaveBeenCalled();
    expect(
      within(await screen.findByRole("dialog")).getByDisplayValue(
        "slug-nguoi-dung-go",
      ),
    ).toBeInTheDocument();
  });

  it("tạo hỏng: KHÔNG gọi lệnh lịch, form giữ nguyên dữ liệu để thử lại", async () => {
    createNews.mockRejectedValue(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message: "Slug bài viết đã tồn tại",
      }),
    );
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(schedulePublication).not.toHaveBeenCalled();
    expect(toastError.mock.calls[0][0]).toContain("Slug bài viết đã tồn tại");
    const stillOpen = await screen.findByRole("dialog");
    expect(within(stillOpen).getByDisplayValue("slug-nguoi-dung-go")).toBeInTheDocument();
  });

  /**
   * Bài ĐÃ tồn tại ở thời điểm này. Không xoá, không tạo lại, không giả vờ là
   * tạo hỏng — và tuyệt đối không để form tạo mở ra như thể bấm lại được.
   */
  it("đặt lịch hỏng sau khi tạo: báo rõ bài đã lưu, đóng form, đúng một POST", async () => {
    schedulePublication.mockRejectedValue(
      new ApiRequestError(409, {
        code: "CONFLICT",
        message:
          "Bài viết này đã từng được đăng nên không đặt lịch đăng lại được.",
      }),
    );
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user);

    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(createNews).toHaveBeenCalledTimes(1);
    expect(schedulePublication).toHaveBeenCalledTimes(1);
    const message = toastError.mock.calls[0][0] as string;
    expect(message).toContain("Đã lưu bài");
    expect(message).toContain("Lên lịch");
    expect(message).toContain("đã từng được đăng");
    // Đóng hẳn: mở tiếp thì cú bấm kế tiếp sẽ tạo ra bài thứ hai trùng nội dung.
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("bấm xác nhận hai lần liên tiếp chỉ tạo MỘT bài", async () => {
    let release: (() => void) | undefined;
    createNews.mockImplementation(async () => {
      calls.current.push("create");
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return CREATED;
    });

    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    const scheduleDialog = await pickSchedule(user);
    // Lần bấm thứ hai rơi vào giữa lúc lệnh tạo còn đang chạy.
    await user.click(
      within(scheduleDialog).getByRole("button", { name: "Lên lịch" }),
    );
    release?.();

    await waitFor(() => expect(schedulePublication).toHaveBeenCalledTimes(1));
    expect(createNews).toHaveBeenCalledTimes(1);
    expect(calls.current).toEqual(["create", "schedule"]);
  });
});

describe('tạo + "Đăng ngay" / "Gửi duyệt" — cùng khuôn hai lệnh', () => {
  it("ADMIN đăng ngay: POST rồi PATCH status với slug backend trả về", async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đăng ngay" }));

    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create", "status"]);
    expect(updateStatus).toHaveBeenCalledWith({
      slug: CREATED.slug,
      status: "PUBLISHED",
    });
  });

  it("EDITOR gửi duyệt: bài mới chuyển sang PENDING", async () => {
    role.current = "EDITOR";
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Gửi duyệt" }));

    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect(updateStatus).toHaveBeenCalledWith({
      slug: CREATED.slug,
      status: "PENDING",
    });
  });

  it("SUPER_ADMIN tạo + đặt lịch: đúng hai lệnh, slug từ response", async () => {
    role.current = "SUPER_ADMIN";
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đặt lịch" }));
    await pickSchedule(user);

    await waitFor(() => expect(schedulePublication).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create", "schedule"]);
    expect(schedulePublication).toHaveBeenCalledWith({
      slug: CREATED.slug,
      scheduledAt: "2026-08-20T08:00:00+07:00",
    });
  });

  it("SUPER_ADMIN tạo + đăng ngay: POST rồi PATCH status", async () => {
    role.current = "SUPER_ADMIN";
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Đăng ngay" }));

    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create", "status"]);
    expect(updateStatus).toHaveBeenCalledWith({
      slug: CREATED.slug,
      status: "PUBLISHED",
    });
  });

  it('SUPER_ADMIN "Lưu nháp": đúng một POST, không lệnh xuất bản nào', async () => {
    role.current = "SUPER_ADMIN";
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    await waitFor(() => expect(createNews).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create"]);
    expect(updateStatus).not.toHaveBeenCalled();
    expect(schedulePublication).not.toHaveBeenCalled();
  });

  it('"Lưu nháp" giữ nguyên hành vi cũ: đúng một lệnh tạo', async () => {
    const { user, dialog } = await openForm();
    await fillValidForm(user, dialog);
    await user.click(within(dialog).getByRole("button", { name: "Lưu nháp" }));

    await waitFor(() => expect(createNews).toHaveBeenCalledTimes(1));
    expect(calls.current).toEqual(["create"]);
    expect(schedulePublication).not.toHaveBeenCalled();
    expect(updateStatus).not.toHaveBeenCalled();
  });
});
