import { useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { StaticPage } from "@/types";

export function PagesPage() {
  const { user } = useAuth();
  const { data: pages = [], isLoading } = usePages();
  const updateStatus = useUpdatePageStatus();
  const [detail, setDetail] = useState<StaticPage | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  // Backend chỉ cho ADMIN trở lên đổi trạng thái đăng — ẩn nút với EDITOR.
  const canPublish = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  async function togglePublished(page: StaticPage) {
    const next = page.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
    setBusySlug(page.slug);
    try {
      await updateStatus.mutateAsync({ slug: page.slug, status: next });
      toast.success(next === "PUBLISHED" ? "Đã đăng trang." : "Đã về nháp.");
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
          {canPublish && (
            <Button
              variant="ghost"
              size="sm"
              disabled={busySlug === page.slug}
              onClick={() => void togglePublished(page)}
            >
              {busySlug === page.slug && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              {page.status === "PUBLISHED" ? "Về nháp" : "Đăng"}
            </Button>
          )}
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
