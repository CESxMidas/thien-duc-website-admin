/**
 * BANNER — CỬA SỔ HIỂN THỊ (Batch 12) trong Admin CMS.
 *
 * Ba nhóm câu hỏi:
 *  1. Bảng: huy hiệu trạng thái suy ra đúng chưa, và nó có TÁCH BẠCH với công
 *     tắc bật/tắt không.
 *  2. Form: nạp cửa sổ đang lưu lên đúng giờ Việt Nam, và payload gửi đi mang
 *     đúng instant (kể cả `null` tường minh khi xoá biên).
 *  3. Kiểm tại chỗ: cửa sổ đảo ngược không được gửi đi.
 *
 * Đồng hồ bị ĐÓNG BĂNG bằng `vi.setSystemTime` — trạng thái suy ra phụ thuộc
 * "bây giờ", nên không đóng băng thì test sẽ đỏ ngẫu nhiên khi lịch trôi qua.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BannersPage } from "@/pages/BannersPage";
import type { Banner } from "@/types";

const { updateBanner, createBanner, reorderBanners, banners, media } =
  vi.hoisted(() => ({
    // Tham số được KHAI BÁO KIỂU có chủ ý: nhờ vậy `mock.calls[0][0]` đọc lên
    // vẫn còn kiểu, không phải ép qua `unknown` ở mỗi assertion.
    updateBanner: vi.fn(
      async (_args: { id: string; data: Record<string, unknown> }) => {},
    ),
    createBanner: vi.fn(async (_input: Record<string, unknown>) => {}),
    reorderBanners: vi.fn(async (_ids: string[]) => {}),
    banners: { current: [] as unknown[] },
    // Một ảnh sẵn trong thư viện để luồng TẠO MỚI chọn được ảnh mà không phải
    // giả lập upload file.
    media: [
      {
        id: "m1",
        url: "/images/banners/home/new.jpg",
        publicId: "banners/home/new",
        width: 1200,
        height: 800,
        format: "jpg",
        bytes: 1000,
        folder: "banners",
        uploadedById: null,
        createdAt: "2026-07-28T02:00:00.000Z",
      },
    ],
  }));

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: (...args: never[]) => Promise<void>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useBanners: () => ({ data: banners.current, isLoading: false }),
    useUpdateBanner: mutation(updateBanner),
    useCreateBanner: mutation(createBanner),
    useReorderBanners: mutation(reorderBanners),
    useMedia: () => ({ data: media, isLoading: false }),
    useUploadMedia: mutation(async () => {}),
  };
});

/** Mốc "bây giờ" cố định cho cả file: 12:00 ngày 15/09/2026 giờ VN. */
const NOW = new Date("2026-09-15T05:00:00.000Z");

const base: Omit<Banner, "id" | "title" | "isActive" | "displayFrom" | "displayUntil" | "order"> = {
  image: "/images/banners/home/a.jpg",
  eyebrow: null,
  subtitle: null,
  href: "/du-an",
  ctaLabel: null,
  objectPosition: null,
  createdAt: "2026-07-28T02:00:00.000Z",
  updatedAt: "2026-07-28T02:00:00.000Z",
};

function banner(patch: Partial<Banner> & { id: string; vi: string }): Banner {
  const { vi: title, ...rest } = patch;
  return {
    ...base,
    order: 0,
    isActive: true,
    displayFrom: null,
    displayUntil: null,
    title: { vi: title },
    ...rest,
  } as Banner;
}

function renderPage(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Hàng của bảng mang tiêu đề đã cho. */
function rowOf(title: string) {
  return screen.getByText(title).closest("tr") as HTMLElement;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(NOW);
  updateBanner.mockClear();
  createBanner.mockClear();
  reorderBanners.mockClear();
  banners.current = [];
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Bảng banner — huy hiệu trạng thái cửa sổ", () => {
  beforeEach(() => {
    banners.current = [
      banner({ id: "always", vi: "Không đặt cửa sổ", order: 0 }),
      banner({
        id: "upcoming",
        vi: "Bắt đầu tuần sau",
        order: 1,
        displayFrom: "2026-09-22T01:00:00.000Z",
      }),
      banner({
        id: "active",
        vi: "Đang trong khoảng",
        order: 2,
        displayFrom: "2026-09-10T01:00:00.000Z",
        displayUntil: "2026-09-20T01:00:00.000Z",
      }),
      banner({
        id: "expired",
        vi: "Đã qua hạn",
        order: 3,
        displayUntil: "2026-09-01T01:00:00.000Z",
      }),
    ];
  });

  it.each([
    ["Không đặt cửa sổ", "Luôn hiển thị"],
    ["Bắt đầu tuần sau", "Sắp hiển thị"],
    ["Đang trong khoảng", "Trong thời gian hiển thị"],
    ["Đã qua hạn", "Đã hết thời gian"],
  ])("“%s” → huy hiệu “%s”", (title, label) => {
    renderPage(<BannersPage />);
    expect(within(rowOf(title)).getByText(label)).toBeInTheDocument();
  });

  it("hiện hai mốc theo giờ Việt Nam, nhãn rõ nghĩa cho biên bỏ trống", () => {
    renderPage(<BannersPage />);
    // 01:00Z = 08:00 giờ VN.
    expect(
      within(rowOf("Đang trong khoảng")).getByText(
        "10/09/2026 · 08:00 → 20/09/2026 · 08:00",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Bắt đầu tuần sau")).getByText(
        "22/09/2026 · 08:00 → Không giới hạn",
      ),
    ).toBeInTheDocument();
    expect(
      within(rowOf("Đã qua hạn")).getByText(
        "Ngay lập tức → 01/09/2026 · 08:00",
      ),
    ).toBeInTheDocument();
  });

  /**
   * §32 — hai khái niệm KHÔNG được gộp. Banner đang bật + cửa sổ tương lai vẫn
   * chưa lên trang chủ; banner đang tắt + cửa sổ hợp lệ cũng vậy. Bảng phải nói
   * ra được cả hai vế để biên tập viên biết cái nào đang chặn.
   */
  it("công tắc và cửa sổ là hai huy hiệu riêng, đọc được độc lập", () => {
    banners.current = [
      banner({
        id: "on-upcoming",
        vi: "Bật nhưng chưa tới giờ",
        isActive: true,
        displayFrom: "2026-09-22T01:00:00.000Z",
      }),
      banner({
        id: "off-active",
        vi: "Tắt nhưng đang trong giờ",
        isActive: false,
        displayFrom: "2026-09-10T01:00:00.000Z",
        displayUntil: "2026-09-20T01:00:00.000Z",
      }),
    ];
    renderPage(<BannersPage />);

    const onUpcoming = within(rowOf("Bật nhưng chưa tới giờ"));
    expect(onUpcoming.getByText("Đang bật")).toBeInTheDocument();
    expect(onUpcoming.getByText("Sắp hiển thị")).toBeInTheDocument();

    const offActive = within(rowOf("Tắt nhưng đang trong giờ"));
    expect(offActive.getByText("Đang tắt")).toBeInTheDocument();
    expect(offActive.getByText("Trong thời gian hiển thị")).toBeInTheDocument();
  });

  it("bật/tắt vẫn chỉ gửi isActive — không kéo theo cửa sổ", async () => {
    const user = userEvent.setup();
    banners.current = [
      banner({
        id: "off-active",
        vi: "Tắt nhưng đang trong giờ",
        isActive: false,
        displayFrom: "2026-09-10T01:00:00.000Z",
        displayUntil: "2026-09-20T01:00:00.000Z",
      }),
    ];
    renderPage(<BannersPage />);

    await user.click(screen.getByRole("button", { name: "Bật banner" }));
    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    expect(updateBanner).toHaveBeenCalledWith({
      id: "off-active",
      data: { isActive: true },
    });
  });
});

describe("Form banner — phần “Thời gian hiển thị”", () => {
  /** Mở hộp thoại sửa của banner đầu tiên. */
  async function openEdit(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getAllByRole("button", { name: "Sửa banner" })[0]);
    return screen.findByRole("dialog");
  }

  it("dùng từ vựng hiển thị, KHÔNG dùng từ vựng xuất bản", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    expect(within(dialog).getByText("Thời gian hiển thị")).toBeInTheDocument();
    expect(within(dialog).queryByText(/Lên lịch xuất bản/i)).toBeNull();
    expect(within(dialog).queryByText(/Đăng ngay/i)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: /Đăng/i })).toBeNull();
  });

  /** §47 — mỗi ô có tên truy cập riêng qua <label for>, không aria-label đè lên. */
  it("bốn ô nhập có nhãn truy cập đúng, và mặc định rỗng khi chưa đặt cửa sổ", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    for (const label of [
      "Hiển thị từ — ngày",
      "Hiển thị từ — giờ",
      "Hiển thị đến — ngày",
      "Hiển thị đến — giờ",
    ]) {
      expect(within(dialog).getByLabelText(label)).toHaveValue("");
    }

    expect(
      within(dialog).getByText("Bỏ trống: banner có hiệu lực ngay."),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByText(/Bỏ trống: không giới hạn ngày kết thúc/),
    ).toBeInTheDocument();
  });

  it("nạp cửa sổ đang lưu lên ô nhập theo GIỜ VIỆT NAM", async () => {
    const user = userEvent.setup();
    banners.current = [
      banner({
        id: "b1",
        vi: "Banner",
        displayFrom: "2026-09-01T01:00:00.000Z",
        displayUntil: "2026-09-30T10:30:00.000Z",
      }),
    ];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    expect(within(dialog).getByLabelText("Hiển thị từ — ngày")).toHaveValue(
      "2026-09-01",
    );
    expect(within(dialog).getByLabelText("Hiển thị từ — giờ")).toHaveValue(
      "08:00",
    );
    expect(within(dialog).getByLabelText("Hiển thị đến — ngày")).toHaveValue(
      "2026-09-30",
    );
    expect(within(dialog).getByLabelText("Hiển thị đến — giờ")).toHaveValue(
      "17:30",
    );
  });

  /** §43 — người dùng gõ giờ VN, backend nhận đúng INSTANT tương ứng. */
  it("nhập 01/09/2026 08:00 giờ VN → gửi đúng instant 2026-09-01T01:00Z", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    await user.type(
      within(dialog).getByLabelText("Hiển thị từ — ngày"),
      "2026-09-01",
    );
    await user.type(
      within(dialog).getByLabelText("Hiển thị từ — giờ"),
      "08:00",
    );
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    const { data } = updateBanner.mock.calls[0][0];

    // So theo INSTANT, không theo hình dạng chuỗi.
    expect(Date.parse(data.displayFrom as string)).toBe(
      Date.parse("2026-09-01T01:00:00.000Z"),
    );
    expect(data.displayUntil).toBeNull();
  });

  it("chỉ đặt biên trên: biên dưới gửi null", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    await user.type(
      within(dialog).getByLabelText("Hiển thị đến — ngày"),
      "2026-12-31",
    );
    await user.type(
      within(dialog).getByLabelText("Hiển thị đến — giờ"),
      "23:59",
    );
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    const { data } = updateBanner.mock.calls[0][0];
    expect(data.displayFrom).toBeNull();
    expect(Date.parse(data.displayUntil as string)).toBe(
      Date.parse("2026-12-31T16:59:00.000Z"),
    );
  });

  /** §19 — xoá biên phải gửi `null` TƯỜNG MINH, không phải bỏ field đi. */
  it.each([
    ["xoá biên dưới", ["Hiển thị từ — ngày", "Hiển thị từ — giờ"], "displayFrom", "displayUntil"],
    ["xoá biên trên", ["Hiển thị đến — ngày", "Hiển thị đến — giờ"], "displayUntil", "displayFrom"],
  ])("%s: gửi null tường minh, biên kia giữ nguyên", async (_label, labels, cleared, kept) => {
    const user = userEvent.setup();
    banners.current = [
      banner({
        id: "b1",
        vi: "Banner",
        displayFrom: "2026-09-01T01:00:00.000Z",
        displayUntil: "2026-09-30T01:00:00.000Z",
      }),
    ];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    for (const label of labels) {
      await user.clear(within(dialog).getByLabelText(label));
    }
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    const { data } = updateBanner.mock.calls[0][0];
    expect(data).toHaveProperty(cleared, null);
    expect(data[kept]).not.toBeNull();
  });

  it("xoá cả hai biên: quay lại “luôn hiển thị”", async () => {
    const user = userEvent.setup();
    banners.current = [
      banner({
        id: "b1",
        vi: "Banner",
        displayFrom: "2026-09-01T01:00:00.000Z",
        displayUntil: "2026-09-30T01:00:00.000Z",
      }),
    ];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    for (const label of [
      "Hiển thị từ — ngày",
      "Hiển thị từ — giờ",
      "Hiển thị đến — ngày",
      "Hiển thị đến — giờ",
    ]) {
      await user.clear(within(dialog).getByLabelText(label));
    }
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    const { data } = updateBanner.mock.calls[0][0];
    expect(data.displayFrom).toBeNull();
    expect(data.displayUntil).toBeNull();
  });

  it("payload KHÔNG chứa scheduledAt/publishedAt", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);
    const dialog = await openEdit(user);

    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));

    const { data } = updateBanner.mock.calls[0][0];
    expect(data).not.toHaveProperty("scheduledAt");
    expect(data).not.toHaveProperty("publishedAt");
    expect(data).not.toHaveProperty("status");
  });

  describe("kiểm tại chỗ trước khi gọi API", () => {
    async function fillWindow(
      user: ReturnType<typeof userEvent.setup>,
      dialog: HTMLElement,
      values: [string, string, string, string],
    ) {
      const labels = [
        "Hiển thị từ — ngày",
        "Hiển thị từ — giờ",
        "Hiển thị đến — ngày",
        "Hiển thị đến — giờ",
      ] as const;
      for (const [index, label] of labels.entries()) {
        await user.type(within(dialog).getByLabelText(label), values[index]);
      }
    }

    it.each([
      ["từ == đến", ["2026-09-01", "08:00", "2026-09-01", "08:00"]],
      ["từ > đến", ["2026-09-30", "08:00", "2026-09-01", "08:00"]],
    ])("%s: hiện lỗi và KHÔNG gửi", async (_label, values) => {
      const user = userEvent.setup();
      banners.current = [banner({ id: "b1", vi: "Banner" })];
      renderPage(<BannersPage />);
      const dialog = await openEdit(user);

      await fillWindow(user, dialog, values as [string, string, string, string]);
      await user.click(
        within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
      );

      expect(
        await within(dialog).findByText("“Hiển thị đến” phải sau “Hiển thị từ”."),
      ).toBeInTheDocument();
      expect(updateBanner).not.toHaveBeenCalled();
    });

    it("chọn ngày mà quên giờ: báo lỗi, không tự đoán 00:00", async () => {
      const user = userEvent.setup();
      banners.current = [banner({ id: "b1", vi: "Banner" })];
      renderPage(<BannersPage />);
      const dialog = await openEdit(user);

      await user.type(
        within(dialog).getByLabelText("Hiển thị từ — ngày"),
        "2026-09-01",
      );
      await user.click(
        within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
      );

      expect(
        await within(dialog).findByText("Hãy chọn giờ bắt đầu hiển thị."),
      ).toBeInTheDocument();
      expect(updateBanner).not.toHaveBeenCalled();
    });

    /** §12/§13 — ba luật của lịch xuất bản KHÔNG áp ở đây. */
    it("cửa sổ ở quá khứ và rất ngắn: vẫn lưu được", async () => {
      const user = userEvent.setup();
      banners.current = [banner({ id: "b1", vi: "Banner" })];
      renderPage(<BannersPage />);
      const dialog = await openEdit(user);

      await fillWindow(user, dialog, [
        "2020-01-01",
        "08:00",
        "2020-01-01",
        "08:01",
      ]);
      await user.click(
        within(dialog).getByRole("button", { name: "Lưu thay đổi" }),
      );

      await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    });
  });
});

describe("Tạo banner mới — cấu hình cửa sổ trong MỘT lượt gửi", () => {
  it("một request duy nhất mang cả nội dung lẫn cửa sổ", async () => {
    const user = userEvent.setup();
    banners.current = [banner({ id: "b1", vi: "Banner" })];
    renderPage(<BannersPage />);

    await user.click(screen.getByRole("button", { name: /Thêm banner/ }));
    const dialog = await screen.findByRole("dialog");

    // Ảnh: chọn từ thư viện (đã mock sẵn một ảnh) thay vì giả lập upload.
    await user.click(
      within(dialog).getByRole("button", { name: /Chọn từ thư viện/ }),
    );
    // Nhãn của nút là tên tệp suy từ `publicId` (xem `fileNameOf`).
    await user.click(await screen.findByRole("button", { name: "new" }));

    await user.type(
      within(dialog).getByPlaceholderText("Khu đô thị Hưng Phú"),
      "Banner sự kiện tháng 9",
    );
    await user.type(
      within(dialog).getByLabelText("Hiển thị từ — ngày"),
      "2026-09-20",
    );
    await user.type(within(dialog).getByLabelText("Hiển thị từ — giờ"), "08:00");

    await user.click(
      within(dialog).getByRole("button", { name: "Thêm banner" }),
    );

    await waitFor(() => expect(createBanner).toHaveBeenCalledTimes(1));
    // Đúng MỘT lượt gọi — không có bước "tạo rồi mới đặt lịch" như luồng nội dung.
    expect(updateBanner).not.toHaveBeenCalled();

    const payload = createBanner.mock.calls[0][0];
    expect(payload.image).toBe("/images/banners/home/new.jpg");
    expect(Date.parse(payload.displayFrom as string)).toBe(
      Date.parse("2026-09-20T01:00:00.000Z"),
    );
    expect(payload.displayUntil).toBeNull();
  });
});
