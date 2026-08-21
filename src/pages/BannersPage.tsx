import { useState } from "react";
import { ArrowDown, ArrowUp, ImageOff, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { BannerFormDialog } from "@/components/banners/BannerFormDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
  useBanners,
  useReorderBanners,
  useUpdateBanner,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  DISPLAY_STATE_LABEL,
  DISPLAY_STATE_TONE,
  NO_END_LABEL,
  NO_START_LABEL,
  deriveDisplayState,
  formatBound,
} from "@/lib/banner-display-window";
import { formatDateTime } from "@/lib/labels";
import type { Banner } from "@/types";

/** Đổi chỗ hai phần tử, trả mảng mới — không sửa mảng gốc của React Query. */
function swap(banners: Banner[], from: number, to: number): Banner[] {
  const next = [...banners];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function BannersPage() {
  const { data: banners = [], isLoading } = useBanners();
  // MỘT mốc "bây giờ" cho cả lượt render: nếu mỗi hàng tự gọi `new Date()` thì
  // hai banner đổi trạng thái tại cùng một giây có thể hiện lệch nhau. Đồng hồ
  // máy client ở đây chỉ dùng để CHỌN NHÃN — backend mới là bên quyết định
  // banner nào thật sự ra trang chủ.
  const now = new Date();
  const reorder = useReorderBanners();
  const updateBanner = useUpdateBanner();
  const [busyId, setBusyId] = useState<string | null>(null);

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= banners.length) return;

    // Backend bắt gửi đủ id của mọi banner, kể cả banner đang tắt.
    const ids = swap(banners, index, target).map((banner) => banner.id);
    setBusyId(banners[index].id);
    try {
      await reorder.mutateAsync(ids);
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được thứ tự."));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(banner: Banner) {
    setBusyId(banner.id);
    try {
      await updateBanner.mutateAsync({
        id: banner.id,
        data: { isActive: !banner.isActive },
      });
      toast.success(banner.isActive ? "Đã tắt banner." : "Đã bật banner.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusyId(null);
    }
  }

  const columns: Column<Banner>[] = [
    {
      key: "order",
      header: "#",
      render: (banner) => {
        const index = banners.findIndex((item) => item.id === banner.id);
        const busy = busyId === banner.id;
        return (
          <div
            className="flex items-center gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <span className="w-5 text-slate">{index + 1}</span>
            <div className="flex flex-col">
              <button
                type="button"
                aria-label="Đưa lên trên"
                disabled={index === 0 || busy}
                onClick={() => void move(index, -1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Đưa xuống dưới"
                disabled={index === banners.length - 1 || busy}
                onClick={() => void move(index, 1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            {busy && <Loader2 className="size-3.5 animate-spin text-slate" />}
          </div>
        );
      },
    },
    {
      key: "title",
      header: "Banner",
      render: (banner) => (
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 overflow-hidden rounded-md bg-cream">
            {banner.image ? (
              <img
                src={resolveAssetUrl(banner.image)}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
            ) : (
              <ImageOff className="m-3 size-6 text-slate/40" />
            )}
          </div>
          <div>
            <p className="font-medium text-ink">{banner.title.vi}</p>
            <p className="text-xs text-slate">{banner.href}</p>
          </div>
        </div>
      ),
    },
    // HAI CỘT TÁCH BẠCH, có chủ ý. "Công tắc" là thứ biên tập viên bật/tắt
    // bằng tay; "Thời gian hiển thị" là điều kiện thời gian. Gộp lại thành một
    // huy hiệu duy nhất sẽ che mất lý do một banner không lên trang chủ — người
    // dùng bấm bật lại mà vẫn không thấy gì, hoặc ngược lại đi sửa mốc thời gian
    // trong khi thứ đang chặn là cái công tắc.
    {
      key: "isActive",
      header: "Công tắc",
      render: (banner) => (
        <button
          type="button"
          disabled={busyId === banner.id}
          onClick={(event) => {
            event.stopPropagation();
            void toggleActive(banner);
          }}
          aria-label={banner.isActive ? "Tắt banner" : "Bật banner"}
        >
          <Badge variant={banner.isActive ? "green" : "gray"}>
            {banner.isActive ? "Đang bật" : "Đang tắt"}
          </Badge>
        </button>
      ),
    },
    {
      key: "displayWindow",
      header: "Thời gian hiển thị",
      // Ô mặc định `whitespace-nowrap`; hai mốc ngày-giờ là chuỗi dài nên phải
      // tự mở cho xuống dòng, nếu không bảng bị đẩy rộng và sinh cuộn ngang.
      cellClassName: "whitespace-normal",
      render: (banner) => {
        const state = deriveDisplayState(banner, now);
        return (
          <div className="grid gap-1">
            <Badge variant={DISPLAY_STATE_TONE[state]}>
              {DISPLAY_STATE_LABEL[state]}
            </Badge>
            {/*
              Chi tiết hai mốc chỉ hiện từ md trở lên: huy hiệu đã trả lời câu
              hỏi chính ("banner này đang ở giai đoạn nào"), còn ngày giờ cụ thể
              thì trên màn hình hẹp phải mở form ra xem — đổi lại bảng không
              tràn ngang ở 320px.
            */}
            {state !== "ALWAYS" && (
              <span className="hidden text-xs text-slate md:inline">
                {formatBound(banner.displayFrom, NO_START_LABEL)}
                {" → "}
                {formatBound(banner.displayUntil, NO_END_LABEL)}
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (banner) => (
        <span className="text-xs text-slate">
          {formatDateTime(banner.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (banner) => (
        <div onClick={(event) => event.stopPropagation()}>
          <BannerFormDialog
            banner={banner}
            trigger={
              <Button variant="ghost" size="sm" aria-label="Sửa banner">
                <Pencil className="size-4" />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Banner trang chủ"
        description="Banner hiển thị trên trang chủ."
        actions={
          <BannerFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Thêm banner
              </Button>
            }
          />
        }
      />

      {!isLoading && banners.length === 0 ? (
        <div className="grid place-items-center rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
          <ImageOff className="size-10 text-slate/40" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold text-ink">
            Chưa có banner nào
          </h2>
          <p className="mt-2 max-w-md text-sm text-slate">
            Khối banner trên trang chủ đang bị ẩn. Thêm ít nhất một banner để nó
            hiển thị trở lại.
          </p>
        </div>
      ) : (
        <DataTable columns={columns} rows={banners} loading={isLoading} />
      )}
    </div>
  );
}
