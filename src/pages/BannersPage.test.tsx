/**
 * THIEN-DUC-BANNER-CONTENT-IMPLEMENTATION-M1 — Admin hiển thị và sửa được nội
 * dung banner đã seed: danh sách đúng thứ tự, ảnh dùng lại đúng file có sẵn,
 * form nạp đủ VI/EN và payload gửi đi khớp `CreateBannerDto` của backend.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";

import { BannersPage } from "@/pages/BannersPage";
import type { Banner } from "@/types";

// `vi.mock` được hoist lên đầu file nên factory không đọc được biến khai báo
// thường — spy phải tạo qua `vi.hoisted` để tồn tại trước khi mock chạy.
const { updateBanner, createBanner, reorderBanners } = vi.hoisted(() => ({
  updateBanner: vi.fn(async () => {}),
  createBanner: vi.fn(async () => {}),
  reorderBanners: vi.fn(async () => {}),
}));

/** Bốn banner khớp `backend/prisma/banner-content.json` (rút gọn phần mô tả). */
const seededBanners: Banner[] = [
  {
    id: "b1",
    image: "/images/banners/home/home-banner-hung-phu-master-plan-02.jpg",
    eyebrow: { vi: "Dự án tiêu biểu", en: "Featured project" },
    title: {
      vi: "Khu đô thị Hưng Phú, TP. Bến Tre",
      en: "Hung Phu Urban Area, Ben Tre City",
    },
    subtitle: {
      vi: "Mặt tiền Nguyễn Thị Định, phường Phú Tân.",
      en: "On Nguyen Thi Dinh Street in Phu Tan ward.",
    },
    href: "/du-an/khu-do-thi-hung-phu",
    ctaLabel: { vi: "Xem chi tiết dự án", en: "Explore the project" },
    objectPosition: "35% center",
    order: 0,
    isActive: true,
    createdAt: "2026-07-28T02:00:00.000Z",
    updatedAt: "2026-07-28T02:00:00.000Z",
  },
  {
    id: "b2",
    image: "/images/banners/home/home-banner-hung-phu-aerial-01.jpg",
    eyebrow: { vi: "Hạng mục nổi bật", en: "Signature building" },
    title: {
      vi: "Fancy Tower — 196 căn hộ tại Hưng Phú",
      en: "Fancy Tower — 196 homes at Hung Phu",
    },
    subtitle: { vi: "19 tầng nổi và 1 tầng hầm, 196 căn hộ.", en: "Nineteen storeys, 196 apartments." },
    href: "/du-an/khu-do-thi-hung-phu/fancy-tower",
    ctaLabel: { vi: "Xem hạng mục căn hộ", en: "View the apartments" },
    objectPosition: "45% center",
    order: 1,
    isActive: true,
    createdAt: "2026-07-28T02:00:00.000Z",
    updatedAt: "2026-07-28T02:00:00.000Z",
  },
  {
    id: "b3",
    image: "/images/banners/home/home-banner-hung-phu-fancy-tower-01.jpg",
    eyebrow: { vi: "Danh mục dự án", en: "Project portfolio" },
    title: {
      vi: "Dự án Thiên Đức tại các tỉnh phía Nam",
      en: "Thien Duc projects across the south",
    },
    subtitle: { vi: "Từ TP.HCM và Vũng Tàu đến Bến Tre.", en: "From Ho Chi Minh City to Ben Tre." },
    href: "/du-an",
    ctaLabel: { vi: "Xem toàn bộ dự án", en: "Browse all projects" },
    objectPosition: "center center",
    order: 2,
    isActive: true,
    createdAt: "2026-07-28T02:00:00.000Z",
    updatedAt: "2026-07-28T02:00:00.000Z",
  },
  {
    id: "b4",
    image: "/images/banners/home/home-banner-hung-phu-master-plan-top-01.jpg",
    eyebrow: { vi: "Giới thiệu công ty", en: "About Thien Duc" },
    title: {
      vi: "Thiên Đức — xây dựng từ năm 2010",
      en: "Thien Duc — building since 2010",
    },
    subtitle: { vi: "Từ hợp tác CapitaLand đến chủ đầu tư phía Nam.", en: "From CapitaLand to leading southern projects." },
    href: "/gioi-thieu",
    ctaLabel: { vi: "Tìm hiểu về Thiên Đức", en: "Learn about Thien Duc" },
    objectPosition: "center center",
    order: 3,
    isActive: false,
    createdAt: "2026-07-28T02:00:00.000Z",
    updatedAt: "2026-07-28T02:00:00.000Z",
  },
];

vi.mock("@/lib/api/queries", () => {
  const mutation = (fn: () => Promise<void>) => () => ({
    mutate: vi.fn(),
    mutateAsync: fn,
    isPending: false,
  });
  return {
    queryKeys: {},
    useBanners: () => ({ data: seededBanners, isLoading: false }),
    useUpdateBanner: mutation(updateBanner),
    useCreateBanner: mutation(createBanner),
    useReorderBanners: mutation(reorderBanners),
    // `ImagePickerField` trong form đọc thư viện ảnh + upload.
    useMedia: () => ({ data: [], isLoading: false }),
    useUploadMedia: mutation(async () => {}),
  };
});

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

beforeEach(() => {
  updateBanner.mockClear();
  createBanner.mockClear();
  reorderBanners.mockClear();
});

describe("BannersPage — nội dung banner đã seed", () => {
  it("liệt kê đủ 4 banner theo đúng thứ tự, không trùng lặp", () => {
    renderPage(<BannersPage />);
    const rows = screen.getAllByRole("row").slice(1); // bỏ hàng tiêu đề
    expect(rows).toHaveLength(4);

    const titles = seededBanners.map((b) => b.title.vi);
    titles.forEach((title, index) => {
      expect(within(rows[index]).getByText(title)).toBeInTheDocument();
      // Mỗi tiêu đề xuất hiện đúng một lần trên bảng → không có slide nhân đôi.
      expect(screen.getAllByText(title)).toHaveLength(1);
    });
  });

  it("ảnh xem trước dùng lại đúng file banner có sẵn, mỗi ảnh một lần", () => {
    const { container } = renderPage(<BannersPage />);
    const sources = [...container.querySelectorAll("img")].map((img) =>
      img.getAttribute("src"),
    );
    expect(sources).toEqual(seededBanners.map((b) => b.image));
    expect(new Set(sources).size).toBe(sources.length);
    for (const src of sources) {
      expect(src).toMatch(/^\/images\/banners\/home\/.+\.jpg$/);
    }
  });

  it("hiển thị đúng trạng thái bật/tắt và href của từng banner", () => {
    renderPage(<BannersPage />);
    expect(screen.getAllByText("Đang bật")).toHaveLength(3);
    expect(screen.getAllByText("Đang tắt")).toHaveLength(1);
    for (const banner of seededBanners) {
      expect(screen.getByText(banner.href)).toBeInTheDocument();
    }
  });

  it("bật/tắt gọi update chỉ với isActive, không đụng ảnh", async () => {
    const user = userEvent.setup();
    renderPage(<BannersPage />);
    await user.click(screen.getByRole("button", { name: "Bật banner" }));
    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));
    expect(updateBanner).toHaveBeenCalledWith({
      id: "b4",
      data: { isActive: true },
    });
  });

  it("form sửa nạp đủ VI/EN và gửi payload khớp DTO backend", async () => {
    const user = userEvent.setup();
    renderPage(<BannersPage />);

    await user.click(screen.getAllByRole("button", { name: "Sửa banner" })[0]);
    const dialog = await screen.findByRole("dialog");

    const banner = seededBanners[0];
    for (const text of [
      banner.title.vi,
      banner.eyebrow!.vi,
      banner.subtitle!.vi,
      banner.ctaLabel!.vi,
      banner.href,
      banner.objectPosition!,
    ]) {
      expect(within(dialog).getAllByDisplayValue(text).length).toBeGreaterThan(0);
    }

    // Không field nào bị đánh dấu thiếu bản dịch → cả 4 field đều có tiếng Anh.
    expect(
      within(dialog).queryAllByLabelText("Chưa có bản dịch tiếng Anh"),
    ).toHaveLength(0);

    // `BilingualField` chỉ render một ô tại một thời điểm; gạt cả 4 field sang
    // EN rồi mới đọc được nội dung tiếng Anh đã nạp.
    for (const button of within(dialog).getAllByRole("button", { name: "en" })) {
      await user.click(button);
    }
    for (const text of [
      banner.title.en!,
      banner.eyebrow!.en!,
      banner.subtitle!.en!,
      banner.ctaLabel!.en!,
    ]) {
      expect(within(dialog).getAllByDisplayValue(text).length).toBeGreaterThan(0);
    }

    // Ảnh hiện qua `ImagePickerField` (xem trước), không phải ô nhập — form nạp
    // lại đúng ảnh cũ nên mở/lưu không kéo theo lượt upload mới.
    expect(
      [...dialog.querySelectorAll("img")].map((img) => img.getAttribute("src")),
    ).toContain(banner.image);

    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(updateBanner).toHaveBeenCalledTimes(1));

    // Payload giữ nguyên ảnh cũ (không upload lại) và đúng shape {vi, en}.
    expect(updateBanner).toHaveBeenCalledWith({
      id: banner.id,
      data: {
        image: banner.image,
        href: banner.href,
        title: banner.title,
        eyebrow: banner.eyebrow,
        subtitle: banner.subtitle,
        ctaLabel: banner.ctaLabel,
        objectPosition: banner.objectPosition,
      },
    });
  });

  it("validate vẫn chặn: href không bắt đầu bằng '/' thì không gửi", async () => {
    const user = userEvent.setup();
    renderPage(<BannersPage />);

    await user.click(screen.getAllByRole("button", { name: "Sửa banner" })[0]);
    const dialog = await screen.findByRole("dialog");

    const href = within(dialog).getByDisplayValue("/du-an/khu-do-thi-hung-phu");
    await user.clear(href);
    await user.type(href, "du-an");
    await user.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));

    expect(
      await within(dialog).findByText(
        // Thông điệp mở rộng cùng lúc `href` chuyển sang dùng hàng rào
        // `isSafeInternalPath` (khớp `@IsSafeInternalPath` của backend): ngoài
        // "phải bắt đầu bằng /" nay còn chặn `//host` và mọi scheme.
        "Đường dẫn nội bộ, bắt đầu bằng “/” (không nhận scheme hay “//host”).",
      ),
    ).toBeInTheDocument();
    expect(updateBanner).not.toHaveBeenCalled();
  });
});
