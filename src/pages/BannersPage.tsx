import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailDialog } from "@/components/ui/DetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useBanners } from "@/lib/api/queries";
import { formatDateTime } from "@/lib/labels";
import type { Banner } from "@/types";

const columns: Column<Banner>[] = [
  {
    key: "order",
    header: "#",
    render: (b) => <span className="text-slate">{b.order}</span>,
  },
  {
    key: "title",
    header: "Banner",
    render: (b) => <span className="font-medium text-ink">{b.title}</span>,
  },
  {
    key: "isActive",
    header: "Hiển thị",
    render: (b) => (
      <Badge variant={b.isActive ? "green" : "gray"}>
        {b.isActive ? "Đang bật" : "Đang tắt"}
      </Badge>
    ),
  },
  {
    key: "updatedAt",
    header: "Cập nhật",
    hideOnMobile: true,
    render: (b) => (
      <span className="text-xs text-slate">{formatDateTime(b.updatedAt)}</span>
    ),
  },
];

export function BannersPage() {
  const { data: banners = [], isLoading } = useBanners();
  const [detail, setDetail] = useState<Banner | null>(null);

  return (
    <div>
      <PageHeader
        title="Banner trang chủ"
        description="Quản lý banner và thứ tự hiển thị (ED-06)."
        actions={
          <Button>
            <Plus className="size-4" /> Thêm banner
          </Button>
        }
      />
      <DataTable
        columns={columns}
        rows={banners}
        loading={isLoading}
        onRowClick={setDetail}
      />

      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.title}
        description="Chi tiết banner trang chủ."
        fields={
          detail
            ? [
                { label: "Thứ tự hiển thị", value: detail.order },
                {
                  label: "Hiển thị",
                  value: (
                    <Badge variant={detail.isActive ? "green" : "gray"}>
                      {detail.isActive ? "Đang bật" : "Đang tắt"}
                    </Badge>
                  ),
                },
                {
                  label: "Cập nhật gần nhất",
                  value: formatDateTime(detail.updatedAt),
                },
              ]
            : []
        }
      />
    </div>
  );
}
