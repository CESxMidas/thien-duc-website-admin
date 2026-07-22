import { useState } from "react";
import { Loader2, Pencil, Plus, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PageFormDialog } from "@/components/pages/PageFormDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailDialog } from "@/components/ui/DetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAuth } from "@/context/AuthContext";
import { usePages, useUpdatePageStatus } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { hasEnglish } from "@/lib/bilingual";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { ContentStatus, StaticPage } from "@/types";

export function PagesPage() {
  const { user } = useAuth();
  const { data: pages = [], isLoading } = usePages();
  const updateStatus = useUpdatePageStatus();
  const [detail, setDetail] = useState<StaticPage | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  // Thao tác trạng thái theo bậc thang DRAFT → PENDING → PUBLISHED, dùng chung
  // helper với Tin tức/Dự án. Nút hiển thị và trạng thái đích do vai trò quyết định.
  async function changeStatus(page: StaticPage, status: ContentStatus) {
    setBusySlug(page.slug);
    try {
      await updateStatus.mutateAsync({ slug: page.slug, status });
      toast.success(`Đã chuyển sang "${contentStatusLabel[status]}".`);
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusySlug(null);
    }
  }

  const columns: Column<StaticPage>[] = [
    {
      key: "title",
      header: "Trang",
      render: (page) => (
        <div>
          <p className="font-medium text-ink">{page.title.vi}</p>
          <p className="text-xs text-slate">/{page.slug}</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (page) => (
        <Badge variant={contentStatusTone[page.status]}>
          {contentStatusLabel[page.status]}
        </Badge>
      ),
    },
    {
      // Song ngữ là điều kiện go-live (câu 19) — trang thiếu bản dịch phải nhìn
      // thấy ngay ở danh sách, không phải mở từng trang ra mới biết.
      key: "translated",
      header: "Tiếng Anh",
      hideOnMobile: true,
      render: (page) => {
        const translated =
          hasEnglish(page.title) &&
          (page.content ?? []).every((item) => hasEnglish(item));
        return (
          <Badge variant={translated ? "green" : "gray"}>
            {translated ? "Đã dịch" : "Chưa dịch"}
          </Badge>
        );
      },
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (page) => (
        <span className="text-xs text-slate">
          {formatDateTime(page.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      render: (page) => (
        <div
          className="flex items-center gap-1"
          onClick={(event) => event.stopPropagation()}
        >
          <PageFormDialog
            page={page}
            trigger={
              <Button variant="ghost" size="sm" aria-label="Sửa trang">
                <Pencil className="size-4" />
              </Button>
            }
          />
          {busySlug === page.slug && (
            <Loader2 className="size-3.5 animate-spin text-slate" />
          )}
          {contentStatusActions(user?.role, page.status).map((action) => (
            <Button
              key={action.to}
              // Đăng/duyệt là nút đậm; gửi duyệt/trả nháp là ghost.
              variant={
                action.intent === "publish" || action.intent === "approve"
                  ? undefined
                  : "ghost"
              }
              size="sm"
              disabled={busySlug === page.slug}
              onClick={() => void changeStatus(page, action.to)}
            >
              {(action.intent === "submit" || action.intent === "publish") && (
                <Send className="size-4" />
              )}
              {action.intent === "revert" && <Undo2 className="size-4" />}
              {action.label}
            </Button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Trang nội dung"
        description="Nội dung trang tĩnh: giới thiệu, liên hệ. Website công khai chỉ đọc trang đã đăng."
        actions={
          <PageFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Tạo trang
              </Button>
            }
          />
        }
      />
      <DataTable
        columns={columns}
        rows={pages}
        loading={isLoading}
        onRowClick={setDetail}
      />

      <DetailDialog
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        title={detail?.title.vi}
        description="Chi tiết trang nội dung."
        fields={
          detail
            ? [
                { label: "Đường dẫn", value: `/${detail.slug}` },
                {
                  label: "Trạng thái",
                  value: (
                    <Badge variant={contentStatusTone[detail.status]}>
                      {contentStatusLabel[detail.status]}
                    </Badge>
                  ),
                },
                {
                  label: "Nội dung (tiếng Việt)",
                  block: true,
                  value: (detail.content ?? []).map((item) => item.vi).join("\n\n"),
                },
                {
                  label: "Nội dung (tiếng Anh)",
                  block: true,
                  value:
                    (detail.content ?? [])
                      .map((item) => item.en ?? "")
                      .join("\n\n")
                      .trim() || "Chưa có bản dịch.",
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
