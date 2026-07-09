import { Link } from "react-router-dom";
import { Inbox, ClipboardCheck, Building2, Newspaper, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeads, useNews, useProjects } from "@/lib/api/queries";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
  leadStatusLabel,
  leadStatusTone,
} from "@/lib/labels";

export function DashboardPage() {
  const { data: leads = [] } = useLeads();
  const { data: news = [] } = useNews();
  const { data: projects = [] } = useProjects();

  const newLeads = leads.filter((l) => l.status === "NEW").length;
  const pendingContent =
    news.filter((n) => n.status === "PENDING").length +
    projects.filter((p) => p.contentStatus === "PENDING").length;

  const recentLeads = leads.slice(0, 4);
  const pendingList = [
    ...news
      .filter((n) => n.status === "PENDING")
      .map((n) => ({ id: n.id, title: n.title, kind: "Tin tức" })),
    ...projects
      .filter((p) => p.contentStatus === "PENDING")
      .map((p) => ({ id: p.id, title: p.title, kind: "Dự án" })),
  ];

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Số liệu nhanh và lối tắt thao tác. Dữ liệu đang là mẫu (chưa nối API)."
      />

      {/* Số liệu nhanh (ED-02) */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Form liên hệ mới"
          value={newLeads}
          hint="Chưa xử lý"
          icon={Inbox}
          to="/lien-he"
          accent="blue"
        />
        <StatCard
          label="Nội dung chờ duyệt"
          value={pendingContent}
          hint="Tin tức + dự án"
          icon={ClipboardCheck}
          to="/tin-tuc"
          accent="amber"
        />
        <StatCard
          label="Dự án"
          value={projects.length}
          hint="Tổng số dự án"
          icon={Building2}
          to="/du-an"
          accent="brand"
        />
        <StatCard
          label="Bài viết"
          value={news.length}
          hint="Tổng số bài"
          icon={Newspaper}
          to="/tin-tuc"
          accent="green"
        />
      </div>

      {/* Lối tắt tạo mới (ED-02) */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link to="/du-an">
            <Plus className="size-4" /> Tạo dự án
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/tin-tuc">
            <Plus className="size-4" /> Viết tin
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {/* Form liên hệ mới nhất */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="text-base">Liên hệ mới nhất</CardTitle>
            <Link to="/lien-he" className="text-sm text-brand hover:underline">
              Xem tất cả
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-line/70">
              {recentLeads.map((lead) => (
                <li key={lead.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {lead.name}{" "}
                      <span className="font-normal text-slate">
                        · {lead.phone}
                      </span>
                    </p>
                    <p className="truncate text-xs text-slate">
                      {lead.message}
                    </p>
                  </div>
                  <Badge variant={leadStatusTone[lead.status]}>
                    {leadStatusLabel[lead.status]}
                  </Badge>
                  <span className="hidden text-xs text-slate sm:block">
                    {formatDateTime(lead.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Nội dung chờ duyệt */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="text-base">Chờ duyệt</CardTitle>
            <span className="text-sm text-slate">{pendingList.length} mục</span>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-line/70">
              {pendingList.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-slate">
                  Không có nội dung chờ duyệt.
                </li>
              ) : (
                pendingList.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <span className="rounded bg-cream px-2 py-0.5 text-xs text-slate">
                      {item.kind}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm text-ink">
                      {item.title}
                    </p>
                    <Badge variant={contentStatusTone.PENDING}>
                      {contentStatusLabel.PENDING}
                    </Badge>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
