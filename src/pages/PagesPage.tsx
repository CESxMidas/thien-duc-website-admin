import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { usePages } from "@/lib/api/queries";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { StaticPage } from "@/types";

const columns: Column<StaticPage>[] = [
  {
    key: "title",
    header: "Trang",
    render: (p) => (
      <div>
        <p className="font-medium text-ink">{p.title}</p>
        <p className="text-xs text-slate">/{p.slug}</p>
      </div>
    ),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (p) => (
      <Badge variant={contentStatusTone[p.status]}>
        {contentStatusLabel[p.status]}
      </Badge>
    ),
  },
  {
    key: "updatedAt",
    header: "Cập nhật",
    hideOnMobile: true,
    render: (p) => (
      <span className="text-xs text-slate">{formatDateTime(p.updatedAt)}</span>
    ),
  },
];

export function PagesPage() {
  const { data: pages = [], isLoading } = usePages();

  return (
    <div>
      <PageHeader
        title="Trang nội dung"
        description="Nội dung trang tĩnh: giới thiệu, chính sách nhân sự, đào tạo (ED-07)."
        actions={
          <Button>
            <Plus className="size-4" /> Tạo trang
          </Button>
        }
      />
      <DataTable columns={columns} rows={pages} loading={isLoading} />
    </div>
  );
}
