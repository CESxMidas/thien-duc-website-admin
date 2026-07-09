import { useState } from "react";
import { StickyNote } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadDetailDialog } from "@/components/contact/LeadDetailDialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useLeads } from "@/lib/api/queries";
import {
  formatDateTime,
  leadStatusLabel,
  leadStatusTone,
} from "@/lib/labels";
import type { Lead, LeadStatus } from "@/types";

const filters: { value: LeadStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "NEW", label: "Mới" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "DONE", label: "Hoàn thành" },
];

const columns: Column<Lead>[] = [
  {
    key: "name",
    header: "Khách hàng",
    render: (l) => (
      <div>
        <p className="font-medium text-ink">{l.name}</p>
        <p className="text-xs text-slate">
          {l.phone}
          {l.email ? ` · ${l.email}` : ""}
        </p>
      </div>
    ),
  },
  {
    key: "message",
    header: "Nội dung",
    hideOnMobile: true,
    render: (l) => (
      <div className="max-w-xs">
        <span className="line-clamp-2 text-slate">{l.message}</span>
        {l.internalNote ? (
          <span className="mt-1 flex items-center gap-1 text-xs text-brand">
            <StickyNote className="size-3" aria-hidden="true" /> Có ghi chú nội bộ
          </span>
        ) : null}
      </div>
    ),
  },
  {
    key: "status",
    header: "Trạng thái",
    render: (l) => (
      <Badge variant={leadStatusTone[l.status]}>
        {leadStatusLabel[l.status]}
      </Badge>
    ),
  },
  {
    key: "createdAt",
    header: "Thời gian",
    hideOnMobile: true,
    render: (l) => (
      <span className="text-xs text-slate">{formatDateTime(l.createdAt)}</span>
    ),
  },
];

export function ContactPage() {
  const [filter, setFilter] = useState<LeadStatus | "ALL">("ALL");
  const [detail, setDetail] = useState<Lead | null>(null);
  const { data: leads = [], isLoading } = useLeads();
  const rows =
    filter === "ALL" ? leads : leads.filter((l) => l.status === filter);

  return (
    <div>
      <PageHeader
        title="Liên hệ (Lead)"
        description="Bấm vào một hàng để xem chi tiết, đổi trạng thái và ghi chú nội bộ (KB-08). Thời gian hiển thị theo giờ VN."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => {
          const count =
            f.value === "ALL"
              ? leads.length
              : leads.filter((l) => l.status === f.value).length;
          const active = filter === f.value;
          return (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-white text-slate hover:border-brand hover:text-brand"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyText="Không có liên hệ nào ở trạng thái này."
        onRowClick={setDetail}
      />

      <LeadDetailDialog lead={detail} onClose={() => setDetail(null)} />
    </div>
  );
}
