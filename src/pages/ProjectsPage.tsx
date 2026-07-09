import { useState } from "react";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailDialog } from "@/components/ui/DetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { ProjectFormDialog } from "@/components/projects/ProjectFormDialog";
import { useProjects } from "@/lib/api/queries";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
  projectStatusLabel,
} from "@/lib/labels";
import type { Project } from "@/types";

const columns: Column<Project>[] = [
  {
    key: "title",
    header: "Dự án",
    render: (p) => (
      <div>
        <p className="font-medium text-ink">{p.title}</p>
        <p className="text-xs text-slate">/{p.slug}</p>
      </div>
    ),
  },
  {
    key: "location",
    header: "Vị trí",
    hideOnMobile: true,
    render: (p) => <span className="text-slate">{p.location}</span>,
  },
  {
    key: "status",
    header: "Tình trạng",
    render: (p) => (
      <span className="text-sm">{projectStatusLabel[p.status]}</span>
    ),
  },
  {
    key: "contentStatus",
    header: "Trạng thái",
    render: (p) => (
      <Badge variant={contentStatusTone[p.contentStatus]}>
        {contentStatusLabel[p.contentStatus]}
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

export function ProjectsPage() {
  const { data: projects = [], isLoading } = useProjects();
  const [detail, setDetail] = useState<Project | null>(null);

  return (
    <div>
      <PageHeader
        title="Dự án"
        description="Quản lý dự án, hạng mục con và thư viện ảnh (ED-03). Bấm vào một hàng để xem chi tiết."
        actions={
          <ProjectFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Tạo dự án
              </Button>
            }
          />
        }
      />
      <DataTable
        columns={columns}
        rows={projects}
        loading={isLoading}
        onRowClick={setDetail}
      />

      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.title}
        description="Chi tiết dự án."
        fields={
          detail
            ? [
                { label: "Đường dẫn", value: `/${detail.slug}` },
                { label: "Vị trí", value: detail.location },
                {
                  label: "Tình trạng",
                  value: projectStatusLabel[detail.status],
                },
                {
                  label: "Trạng thái nội dung",
                  value: (
                    <Badge variant={contentStatusTone[detail.contentStatus]}>
                      {contentStatusLabel[detail.contentStatus]}
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
