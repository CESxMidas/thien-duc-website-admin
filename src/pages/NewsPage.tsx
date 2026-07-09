import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useNews } from "@/lib/api/queries";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { NewsPost } from "@/types";

const columns: Column<NewsPost>[] = [
  {
    key: "title",
    header: "Tiêu đề",
    render: (n) => (
      <div>
        <p className="font-medium text-ink">{n.title}</p>
        <p className="text-xs text-slate">/{n.slug}</p>
      </div>
    ),
  },
  {
    key: "category",
    header: "Chuyên mục",
    hideOnMobile: true,
    render: (n) => <span className="text-slate">{n.category}</span>,
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (n) => (
      <Badge variant={contentStatusTone[n.status]}>
        {contentStatusLabel[n.status]}
      </Badge>
    ),
  },
  {
    key: "updatedAt",
    header: "Cập nhật",
    hideOnMobile: true,
    render: (n) => (
      <span className="text-xs text-slate">{formatDateTime(n.updatedAt)}</span>
    ),
  },
];

export function NewsPage() {
  const { data: news = [], isLoading } = useNews();

  return (
    <div>
      <PageHeader
        title="Tin tức"
        description="Chuyên mục và bài viết, luồng nháp → gửi duyệt → xuất bản (ED-04)."
        actions={
          <Button>
            <Plus className="size-4" /> Viết tin
          </Button>
        }
      />
      <DataTable columns={columns} rows={news} loading={isLoading} />
    </div>
  );
}
