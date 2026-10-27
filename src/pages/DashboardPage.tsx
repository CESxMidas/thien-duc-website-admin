import { usePublicationClock } from "@/lib/use-publication-clock";
import { derivePublicationState } from "@/lib/news-schedule";
import { deriveProjectPublicationState } from "@/lib/project-schedule";
import type { ComponentProps } from "react";
import { Link } from "react-router-dom";
import {
  Inbox,
  ClipboardCheck,
  Building2,
  Newspaper,
  Plus,
} from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLeads, useNews, useProjects } from "@/lib/api/queries";
import { useAuth } from "@/context/AuthContext";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
  leadStatusLabel,
  leadStatusTone,
} from "@/lib/labels";

export function DashboardPage() {
  const { user } = useAuth();
  // `/contact` chỉ cho ADMIN/SUPER_ADMIN — EDITOR không xem lead (khớp nav.ts).
  const canViewLeads = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const { data: leads = [] } = useLeads(canViewLeads);
  const { data: news = [] } = useNews();
  const { data: projects = [] } = useProjects();

  const now = usePublicationClock(
    [...news, ...projects].map((item) => item.scheduledAt),
  );
  const newLeads = leads.filter((l) => l.status === "NEW").length;
  const pendingContent =
    news.filter((n) => derivePublicationState(n, now) === "PENDING").length +
    projects.filter((p) => deriveProjectPublicationState(p, now) === "PENDING")
      .length;

  const recentLeads = leads.slice(0, 4);
  // Tiêu đề tin và dự án đều là field song ngữ — lấy bản tiếng Việt để render.
  const pendingList = [
    ...news
      .filter((n) => derivePublicationState(n, now) === "PENDING")
      .map((n) => ({ id: n.id, title: n.title.vi, kind: "Tin tức" })),
    ...projects
      .filter((p) => deriveProjectPublicationState(p, now) === "PENDING")
      .map((p) => ({ id: p.id, title: p.title.vi, kind: "Dự án" })),
  ];

  // Grid thích ứng số card để không hụt ô: ADMIN 4 card (4 cột), EDITOR 3 card
  // (3 cột). Khối nội dung dưới: ADMIN 2 cột, EDITOR để "Chờ duyệt" chiếm trọn.
  const statGridClass = canViewLeads
    ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
  const panelGridClass = canViewLeads
    ? "mt-8 grid gap-6 lg:grid-cols-2"
    : "mt-8 grid gap-6";

  // Ưu tiên mục có dữ liệu; giữ thứ tự cũ trong từng nhóm để tránh đảo lộn.
  const stats: (ComponentProps<typeof StatCard> & { value: number })[] = [
    ...(canViewLeads
      ? [
          {
            label: "Form liên hệ mới",
            value: newLeads,
            hint: "Chưa xử lý",
            icon: Inbox,
            to: "/lien-he",
            accent: "blue" as const,
          },
        ]
      : []),
    {
      label: "Nội dung chờ duyệt",
      value: pendingContent,
      hint: "Tin tức + dự án",
      icon: ClipboardCheck,
      to: "/tin-tuc",
      accent: "amber",
    },
    {
      label: "Dự án",
      value: projects.length,
      hint: "Tổng số dự án",
      icon: Building2,
      to: "/du-an",
      accent: "brand",
    },
    {
      label: "Bài viết",
      value: news.length,
      hint: "Tổng số bài",
      icon: Newspaper,
      to: "/tin-tuc",
      accent: "green",
    },
  ];
  stats.sort((a, b) => Number(b.value > 0) - Number(a.value > 0));

  const panels = [
    {
      visible: canViewLeads,
      hasData: recentLeads.length > 0,
      content: (
        <Card key="leads" className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="text-base">Liên hệ mới nhất</CardTitle>
            <Link to="/lien-he" className="text-sm text-brand hover:underline">
              Xem tất cả
            </Link>
          </CardHeader>
          <CardContent className="px-0">
            <ul className="divide-y divide-line/70">
              {recentLeads.length === 0 ? (
                <li className="px-5 py-6 text-center text-sm text-slate">
                  Chưa có form liên hệ nào.
                </li>
              ) : (
                recentLeads.map((lead) => (
                  <li
                    key={lead.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">
                        {lead.name}{" "}
                        <span className="font-normal text-slate">
                          | {lead.phone}
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
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      ),
    },
    {
      visible: true,
      hasData: pendingList.length > 0,
      content: (
        <Card key="pending" className="gap-0 py-0">
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
      ),
    },
  ]
    .filter((panel) => panel.visible)
    .sort((a, b) => Number(b.hasData) - Number(a.hasData));

  return (
    <div>
      <PageHeader
        title="Tổng quan"
        description="Số liệu nhanh và lối tắt thao tác."
      />

      {/* Số liệu nhanh (ED-02) */}
      <div className={statGridClass}>
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
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

      <div className={panelGridClass}>
        {panels.map((panel) => panel.content)}
      </div>
    </div>
  );
}
