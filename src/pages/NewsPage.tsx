import { useState } from "react";
import { Loader2, Pencil, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { useAuth } from "@/context/AuthContext";
import {
  useDeleteNews,
  useNews,
  useNewsCategories,
  useUpdateNewsStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  contentStatusLabel,
  contentStatusTone,
  formatDateTime,
} from "@/lib/labels";
import type { ContentStatus, NewsPost } from "@/types";

export function NewsPage() {
  const { user } = useAuth();
  const canApprove = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const { data: news = [], isLoading } = useNews();
  const { data: categories = [] } = useNewsCategories();
  const updateStatus = useUpdateNewsStatus();
  const removeNews = useDeleteNews();

  const [pendingDelete, setPendingDelete] = useState<NewsPost | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);

  async function changeStatus(post: NewsPost, status: ContentStatus) {
    setBusySlug(post.slug);
    try {
      await updateStatus.mutateAsync({ slug: post.slug, status });
      toast.success(
        status === "PUBLISHED"
          ? "Đã đăng bài viết."
          : status === "PENDING"
            ? "Đã gửi duyệt."
            : "Đã trả về nháp.",
      );
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được trạng thái."));
    } finally {
      setBusySlug(null);
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    try {
      await removeNews.mutateAsync(pendingDelete.slug);
      toast.success("Đã xóa bài viết.");
      setPendingDelete(null);
    } catch (error) {
      toast.error(resolveApiError(error, "Không xóa được bài viết."));
    }
  }

  const columns: Column<NewsPost>[] = [
    {
      key: "title",
      header: "Tiêu đề",
      render: (post) => (
        <div>
          <p className="font-medium text-ink">{post.title.vi}</p>
          <p className="text-xs text-slate">/{post.slug}</p>
        </div>
      ),
    },
    {
      key: "category",
      header: "Chuyên mục",
      hideOnMobile: true,
      render: (post) => (
        <span className="text-slate">
          {post.category?.name.vi ?? "Chưa phân loại"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Trạng thái",
      render: (post) => (
        <Badge variant={contentStatusTone[post.status]}>
          {contentStatusLabel[post.status]}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Cập nhật",
      hideOnMobile: true,
      render: (post) => (
        <span className="text-xs text-slate">
          {formatDateTime(post.updatedAt)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (post) => {
        const busy = busySlug === post.slug;
        return (
          <div
            className="flex items-center justify-end gap-1"
            // Bảng có onRowClick ở nơi khác; chặn nổi bọt để bấm nút không mở hàng.
            onClick={(event) => event.stopPropagation()}
          >
            {busy && <Loader2 className="size-4 animate-spin text-slate" />}

            {post.status === "DRAFT" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(post, "PENDING")}
              >
                <Send className="size-4" /> Gửi duyệt
              </Button>
            )}

            {canApprove && post.status === "PENDING" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(post, "PUBLISHED")}
              >
                Duyệt &amp; đăng
              </Button>
            )}

            {canApprove && post.status !== "DRAFT" && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(post, "DRAFT")}
              >
                <Undo2 className="size-4" /> Trả về nháp
              </Button>
            )}

            <NewsFormDialog
              post={post}
              trigger={
                <Button variant="ghost" size="sm" aria-label="Sửa bài viết">
                  <Pencil className="size-4" />
                </Button>
              }
            />

            {canApprove && (
              <Button
                variant="ghost"
                size="sm"
                aria-label="Xóa bài viết"
                onClick={() => setPendingDelete(post)}
              >
                <Trash2 className="size-4 text-red-600" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const pendingCount = news.filter((post) => post.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Tin tức"
        description={
          pendingCount > 0
            ? `${pendingCount} bài đang chờ duyệt. Luồng: nháp → gửi duyệt → đã đăng.`
            : "Chuyên mục và bài viết."
        }
        actions={
          <NewsFormDialog
            trigger={
              <Button>
                <Plus className="size-4" /> Viết tin
              </Button>
            }
          />
        }
      />

      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate"
            >
              {category.name.vi}
              <span className="ml-1.5 text-slate/60">
                {category._count?.posts ?? 0}
              </span>
            </span>
          ))}
        </div>
      )}

      <DataTable columns={columns} rows={news} loading={isLoading} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Xóa bài viết?"
        description={
          pendingDelete ? (
            <>
              Bài <strong>{pendingDelete.title.vi}</strong> sẽ bị xóa vĩnh viễn.
              Link <code>/tin-tuc/{pendingDelete.slug}</code> sẽ trả về trang
              không tìm thấy.
            </>
          ) : null
        }
        submitting={removeNews.isPending}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
