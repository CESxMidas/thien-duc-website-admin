import { useState } from "react";
import { DeleteContentButton } from "@/components/content/DeleteContentButton";
import { StickyNote } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { LeadDetailDialog } from "@/components/contact/LeadDetailDialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useLeads } from "@/lib/api/queries";
import { formatDateTime, leadStatusLabel, leadStatusTone } from "@/lib/labels";
import type { Lead, LeadStatus } from "@/types";

const filters: { value: LeadStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "NEW", label: "Mới" },
  { value: "IN_PROGRESS", label: "Đang xử lý" },
  { value: "DONE", label: "Hoàn thành" },
];

const columns: Column<Lead>[] = [
  {
    key: "actions",
    header: "Thao tác",
    render: (lead) => (
      <DeleteContentButton kind="contact" id={lead.id} title={lead.name} />
    ),
  },
  {
    key: "name",
    header: "Khách hàng",
    render: (l) => (
      <div>
        <p className="font-medium text-ink">{l.name}</p>
        {l.applicationPositionTitle && (
          <p className="mt-1 text-xs font-medium text-brand">
            Ứng tuyển: {l.applicationPositionTitle}
          </p>
        )}
        <p className="text-xs text-slate">
          {l.phone}
          {l.email ? ` | ${l.email}` : ""}
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
            <StickyNote className="size-3" aria-hidden="true" /> Có ghi chú nội
            bộ
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
  const [applicationsOnly, setApplicationsOnly] = useState(false);
  const [detail, setDetail] = useState<Lead | null>(null);
  const { data: leads = [], isLoading } = useLeads();
  const scopedLeads = applicationsOnly
    ? leads.filter((lead) => lead.inquiryType === "tuyen-dung")
    : leads;
  const rows = scopedLeads.filter(
    (lead) => filter === "ALL" || lead.status === filter,
  );

  return (
    <div>
      <PageHeader
        title="Liên hệ"
        description="Tiếp nhận liên hệ và hồ sơ ứng tuyển từ website. Bấm vào từng dòng để xem và xử lý."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={applicationsOnly}
          onClick={() => setApplicationsOnly((value) => !value)}
          className={`min-h-9 rounded-full border px-3 py-1 text-sm ${applicationsOnly ? "border-brand bg-brand text-white" : "border-line-strong bg-white text-slate"}`}
        >
          Hồ sơ ứng tuyển (
          {leads.filter((lead) => lead.inquiryType === "tuyen-dung").length})
        </button>
        {filters.map((f) => {
          const count =
            f.value === "ALL"
              ? scopedLeads.length
              : scopedLeads.filter((l) => l.status === f.value).length;
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
