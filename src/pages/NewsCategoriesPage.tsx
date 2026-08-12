import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { NewsCategoryFormDialog } from "@/components/news/NewsCategoryFormDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAuth } from "@/context/AuthContext";
import {
  useDeleteNewsCategory,
  useNewsCategoriesForAdmin,
  useUpdateNewsCategory,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import type { NewsCategory } from "@/types";

/**
 * Quản lý chuyên mục tin.
 *
 * Là TRANG riêng chứ không phải modal trong trang Tin tức: màn này cần một hộp
 * thoại xác nhận xóa, và đặt nó bên trong một modal khác là hai lớp `Dialog`
 * lồng nhau — focus và phím ESC trở nên nhập nhằng. Trang riêng cũng đủ chỗ cho
 * bảng bảy cột.
 *
 * Cố ý KHÔNG thêm mục vào sidebar: 4 chuyên mục không đáng một mục điều hướng
 * cấp một. Vào từ trang Tin tức.
 */
export function NewsCategoriesPage() {
  const { user } = useAuth();
  const { data: categories = [], isLoading } = useNewsCategoriesForAdmin();
  const updateCategory = useUpdateNewsCategory();
  const deleteCategory = useDeleteNewsCategory();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<NewsCategory | null>(null);

  // Xóa chuyên mục theo đúng phân quyền backend (`@Roles(ADMIN, SUPER_ADMIN)`).
  const canDelete = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  /**
   * Đổi chỗ hai chuyên mục liền kề.
   *
   * Backend không có route reorder hàng loạt cho chuyên mục — và không cần: đổi
   * chỗ hai mục là hai lần PATCH `order`. Nếu lần thứ hai hỏng, hai chuyên mục
   * tạm thời cùng `order`, nhưng danh sách vẫn sắp `[order asc, slug asc]` nên
   * thứ tự vẫn xác định, không loạn. Ta refetch để giao diện phản ánh đúng thứ
   * server đã lưu, thay vì giữ một thứ tự lạc quan mà server không có.
   */
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= categories.length) return;

    const current = categories[index];
    const neighbour = categories[target];
    setBusyId(current.id);
    try {
      // Chuẩn hoá về chỉ số hàng: sau mỗi lần đổi chỗ, `order` luôn là 0,1,2…
      // nên không tích luỹ khoảng trống vô nghĩa qua thời gian.
      await updateCategory.mutateAsync({
        slug: current.slug,
        data: { order: target },
      });
      await updateCategory.mutateAsync({
        slug: neighbour.slug,
        data: { order: index },
      });
    } catch (error) {
      toast.error(resolveApiError(error, "Không đổi được thứ tự chuyên mục."));
    } finally {
      setBusyId(null);
    }
  }

  async function onConfirmDelete() {
    if (!toDelete) return;
    try {
      await deleteCategory.mutateAsync(toDelete.slug);
      toast.success(`Đã xóa chuyên mục "${toDelete.name.vi}".`);
      setToDelete(null);
    } catch (error) {
      // Nút xóa đã bị khoá khi chuyên mục còn bài, nhưng dữ liệu trên màn có
      // thể cũ (người khác vừa gán bài vào chuyên mục này). Backend là chốt
      // chặn cuối và thông báo 409 của nó đã viết cho người dùng cuối.
      toast.error(
        resolveApiError(error, "Không xóa được chuyên mục. Vui lòng thử lại."),
      );
      setToDelete(null);
    }
  }

  const columns: Column<NewsCategory>[] = [
    {
      key: "order",
      header: "#",
      render: (category) => {
        const index = categories.findIndex((item) => item.id === category.id);
        const busy = busyId === category.id;
        return (
          <div className="flex items-center gap-1">
            <span className="w-5 text-slate">{index + 1}</span>
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Đưa chuyên mục ${category.name.vi} lên trên`}
                disabled={index === 0 || busy}
                onClick={() => void move(index, -1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowUp className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label={`Đưa chuyên mục ${category.name.vi} xuống dưới`}
                disabled={index === categories.length - 1 || busy}
                onClick={() => void move(index, 1)}
                className="text-slate transition hover:text-brand disabled:opacity-30"
              >
                <ArrowDown className="size-3.5" />
              </button>
            </div>
            {busy && <Loader2 className="size-3.5 animate-spin text-slate" />}
          </div>
        );
      },
    },
    {
      key: "name",
      header: "Tên chuyên mục",
      cellClassName: "whitespace-normal",
      render: (category) => (
        <div>
          <p className="font-medium text-ink">{category.name.vi}</p>
          {category.name.en ? (
            <p className="text-xs text-slate">{category.name.en}</p>
          ) : (
            <p className="text-xs text-warning">Chưa có tên tiếng Anh</p>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      header: "Đường dẫn",
      hideOnMobile: true,
      render: (category) => (
        <code className="text-xs text-slate">/{category.slug}</code>
      ),
    },
    {
      key: "publishedCount",
      header: "Đã đăng",
      render: (category) =>
        category.publishedCount > 0 ? (
          <Badge variant="green">{category.publishedCount}</Badge>
        ) : (
          // Chuyên mục chưa có bài đã đăng không hiện trên website — nói rõ để
          // không ai tưởng là lỗi hiển thị.
          <span
            className="text-xs text-slate"
            title="Chưa hiện trên website cho tới khi có bài được đăng"
          >
            0 · chưa hiện
          </span>
        ),
    },
    {
      key: "totalCount",
      header: "Tổng bài",
      hideOnMobile: true,
      render: (category) => (
        <span className="text-sm text-slate">{category.totalCount ?? 0}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      headerClassName: "text-right",
      cellClassName: "text-right",
      render: (category) => {
        const inUse = (category.totalCount ?? 0) > 0;
        return (
          <div className="flex justify-end gap-1">
            <NewsCategoryFormDialog
              category={category}
              trigger={
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Sửa chuyên mục ${category.name.vi}`}
                >
                  <Pencil className="size-4" />
                </Button>
              }
            />
            {canDelete && (
              <Button
                variant="ghost"
                size="sm"
                disabled={inUse}
                aria-label={`Xóa chuyên mục ${category.name.vi}`}
                title={
                  inUse
                    ? `Chuyên mục đang được ${category.totalCount} bài viết sử dụng. Hãy chuyển hoặc gỡ các bài đó trước khi xóa.`
                    : undefined
                }
                onClick={() => setToDelete(category)}
                className="text-danger hover:text-danger"
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Chuyên mục tin tức"
        description="Chuyên mục quyết định bộ lọc trên trang tin của website. Chuyên mục chưa có bài đăng sẽ không hiện công khai."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/tin-tuc">
                <ArrowLeft className="size-4" /> Về danh sách tin
              </Link>
            </Button>
            <NewsCategoryFormDialog
              nextOrder={categories.length}
              trigger={
                <Button>
                  <Plus className="size-4" /> Thêm chuyên mục
                </Button>
              }
            />
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={categories}
        loading={isLoading}
        emptyText="Chưa có chuyên mục nào. Thêm chuyên mục đầu tiên để phân loại bài viết."
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Xóa chuyên mục "${toDelete?.name.vi ?? ""}"?`}
        description={
          <>
            <p>
              Đường dẫn công khai <code>/tin-tuc/danh-muc/{toDelete?.slug}</code>{" "}
              sẽ không còn truy cập được.
            </p>
            <p className="mt-2">
              Chuyên mục này hiện <b>không có bài viết nào</b> (
              {toDelete?.totalCount ?? 0} bài), nên không bài nào bị mất phân
              loại. Thao tác không hoàn tác được.
            </p>
          </>
        }
        confirmLabel="Xóa chuyên mục"
        submitting={deleteCategory.isPending}
        onConfirm={() => void onConfirmDelete()}
      />
    </div>
  );
}
