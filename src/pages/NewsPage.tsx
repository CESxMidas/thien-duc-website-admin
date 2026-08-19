import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarClock,
  CalendarX2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Tags,
  Trash2,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { NewsFormDialog } from "@/components/news/NewsFormDialog";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { useAuth } from "@/context/AuthContext";
import {
  useCancelNewsPublication,
  useDeleteNews,
  useNews,
  useNewsCategoriesForAdmin,
  useScheduleNewsPublication,
  useUpdateNewsStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { canEditNews } from "@/lib/content-editing";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  bySoonestSchedule,
  derivePublicationState,
  isActiveFutureSchedule,
  newsScheduleActions,
  type PublicationState,
} from "@/lib/news-schedule";
import {
  formatDateTime,
  publicationStateLabel,
  publicationStateTone,
} from "@/lib/labels";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import type { ContentStatus, NewsPost } from "@/types";

/**
 * Bộ lọc theo trạng thái SUY RA, không phải theo cột `status`.
 *
 * "Đã lên lịch" gộp cả `SCHEDULED` lẫn `DUE` vì cả hai đều sinh ra từ một lịch
 * đăng — người dùng đi tìm "những bài tôi đã hẹn giờ" chứ không phân biệt bài
 * nào vừa qua mốc. Huy hiệu trên từng hàng vẫn tách bạch hai trạng thái đó.
 * Ngược lại, "Chờ duyệt" CỐ Ý không gộp `DUE`: một bài đã tới hạn đang hiển thị
 * công khai, xếp chung với hàng chờ duyệt là nói sai sự thật.
 */
type NewsFilter = "ALL" | "DRAFT" | "PENDING" | "SCHEDULED" | "PUBLISHED";

const filters: { value: NewsFilter; label: string }[] = [
  { value: "ALL", label: "Tất cả" },
  { value: "DRAFT", label: "Nháp" },
  { value: "PENDING", label: "Chờ duyệt" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "PUBLISHED", label: "Đã đăng" },
];

function matchesFilter(state: PublicationState, filter: NewsFilter): boolean {
  if (filter === "ALL") return true;
  if (filter === "SCHEDULED") return state === "SCHEDULED" || state === "DUE";
  return state === filter;
}

export function NewsPage() {
  const { user } = useAuth();
  const canApprove = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

  const { data: news = [], isLoading } = useNews();
  const { data: categories = [] } = useNewsCategoriesForAdmin();
  const updateStatus = useUpdateNewsStatus();
  const removeNews = useDeleteNews();
  const schedulePublication = useScheduleNewsPublication();
  const cancelPublication = useCancelNewsPublication();

  const [pendingDelete, setPendingDelete] = useState<NewsPost | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [filter, setFilter] = useState<NewsFilter>("ALL");
  const [scheduleTarget, setScheduleTarget] = useState<NewsPost | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Đồng hồ MÁY, chỉ để chọn nhãn và ẩn nút chắc chắn bị từ chối — backend mới
  // là nơi quyết định bài có công khai hay không (xem `news-schedule.ts`).
  // Không dùng state có bộ đếm: một hàng vừa qua mốc sẽ đổi nhãn ở lần render
  // kế tiếp (thao tác bất kỳ hoặc lần refetch của React Query), và mọi thao tác
  // sai thời điểm đều được backend chặn lại.
  const now = new Date();

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

  async function handleSchedule(scheduledAt: string) {
    if (!scheduleTarget) return;
    const isReschedule = isActiveFutureSchedule(scheduleTarget, now);
    setScheduleError(null);
    try {
      await schedulePublication.mutateAsync({
        slug: scheduleTarget.slug,
        scheduledAt,
      });
      toast.success(isReschedule ? "Đã đổi lịch đăng." : "Đã lên lịch đăng.");
      setScheduleTarget(null);
    } catch (error) {
      // Lỗi nghiệp vụ (400 quá gần/quá xa, 409 bài đã từng đăng) hiện NGAY
      // trong hộp thoại: người dùng còn nguyên giá trị vừa nhập để sửa lại.
      setScheduleError(resolveApiError(error, "Không đặt được lịch đăng."));
    }
  }

  /**
   * Huỷ lịch — KHÔNG hỏi lại. Quy ước hiện có của CMS: hộp thoại xác nhận chỉ
   * dành cho thao tác không hoàn tác được (xóa bài, xóa ảnh); các thao tác đổi
   * trạng thái ("Trả về nháp") thực hiện thẳng. Huỷ lịch cùng loại với chúng —
   * bài về nháp và đặt lại lịch được ngay.
   */
  async function handleCancelSchedule(post: NewsPost) {
    setBusySlug(post.slug);
    try {
      await cancelPublication.mutateAsync(post.slug);
      toast.success("Đã huỷ lịch đăng. Bài trở về nháp.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không huỷ được lịch đăng."));
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
      // Dòng phụ (mốc hẹn / ghi chú đồng bộ) cần xuống dòng được.
      cellClassName: "whitespace-normal",
      render: (post) => {
        const state = derivePublicationState(post, now);
        const scheduledLabel = post.scheduledAt
          ? formatVietnamDateTime(post.scheduledAt)
          : null;
        return (
          <div className="space-y-1">
            {/* Nhãn CHỮ là thứ mang thông tin; màu chỉ hỗ trợ. */}
            <Badge variant={publicationStateTone[state]}>
              {publicationStateLabel[state]}
            </Badge>
            {state === "SCHEDULED" && scheduledLabel ? (
              <p className="text-xs text-slate">{scheduledLabel}</p>
            ) : null}
            {state === "DUE" ? (
              // Không nói "chờ duyệt": theo vị từ hiển thị của backend, bài này
              // ĐÃ ra công khai rồi, chỉ còn chờ reconciler ghi lại trạng thái.
              <p className="text-xs text-slate">
                Đã hiển thị công khai, đang chờ đồng bộ
              </p>
            ) : null}
          </div>
        );
      },
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
        const state = derivePublicationState(post, now);
        const schedule = newsScheduleActions(user?.role, post, now);
        const statusActions = contentStatusActions(user?.role, post.status)
          // Ở trạng thái "Đã lên lịch", "Trả về nháp" và "Huỷ lịch" cho ra CÙNG
          // một kết quả (DRAFT, xoá cả hai mốc). Giữ lại nút nói đúng việc đang
          // làm; ở mọi trạng thái khác "Trả về nháp" vẫn nguyên như trước.
          .filter(
            (action) => !(state === "SCHEDULED" && action.intent === "revert"),
          );
        return (
          <div
            // Hàng "Đã lên lịch" có tới năm nút. Màn hẹp: cho xuống dòng để
            // mọi nút đều chạm tới được, không đẩy bảng sinh cuộn ngang. Màn
            // rộng (xl trở lên): giữ một dòng — cột tiêu đề còn dư chỗ nên bảng
            // tự nhường bề rộng, thay vì bỏ lại nút xóa lẻ loi ở dòng dưới.
            className="flex flex-wrap items-center justify-end gap-1 xl:flex-nowrap"
            // Bảng có onRowClick ở nơi khác; chặn nổi bọt để bấm nút không mở hàng.
            onClick={(event) => event.stopPropagation()}
          >
            {busy && <Loader2 className="size-4 animate-spin text-slate" />}

            {statusActions.map((action) => (
              <Button
                key={action.to}
                // Thao tác chính (đăng/duyệt) là nút đậm; gửi duyệt/trả nháp là ghost.
                variant={
                  action.intent === "publish" || action.intent === "approve"
                    ? undefined
                    : "ghost"
                }
                size="sm"
                disabled={busy}
                onClick={() => void changeStatus(post, action.to)}
              >
                {action.intent === "submit" && <Send className="size-4" />}
                {action.intent === "publish" && <Send className="size-4" />}
                {action.intent === "revert" && <Undo2 className="size-4" />}
                {/* Bài đang hẹn giờ: "Duyệt & đăng" thành "Đăng ngay" — vẫn đi
                    qua route `status` như cũ, backend chuyển mốc công khai về
                    hiện tại và xoá lịch. */}
                {state === "SCHEDULED" && action.intent === "approve"
                  ? "Đăng ngay"
                  : action.label}
              </Button>
            ))}

            {(schedule.schedule || schedule.reschedule) && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setScheduleError(null);
                  setScheduleTarget(post);
                }}
              >
                <CalendarClock className="size-4" />
                {schedule.reschedule ? "Đổi lịch" : "Lên lịch"}
              </Button>
            )}

            {schedule.cancel && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => void handleCancelSchedule(post)}
              >
                <CalendarX2 className="size-4" />
                Huỷ lịch
              </Button>
            )}

            {/* Nút "Sửa" chỉ hiện khi backend sẽ thật sự cho lưu: EDITOR mất
                quyền sửa từ lúc bài được hẹn giờ hoặc đã từng công khai. Suy ra
                từ trạng thái CHÍNH TẮC của bản ghi (ba cột persisted), không
                phải từ nhãn hiển thị. */}
            {canEditNews(user?.role, post) && (
              <NewsFormDialog
                post={post}
                trigger={
                  <Button variant="ghost" size="sm" aria-label="Sửa bài viết">
                    <Pencil className="size-4" />
                  </Button>
                }
              />
            )}

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

  const filtered = news.filter((post) =>
    matchesFilter(derivePublicationState(post, now), filter),
  );
  // Chỉ đổi thứ tự khi đang lọc theo lịch: câu hỏi lúc đó là "bài nào sắp lên?".
  // Mọi bộ lọc khác giữ nguyên thứ tự mặc định của API.
  const rows =
    filter === "SCHEDULED" ? [...filtered].sort(bySoonestSchedule) : filtered;

  // Đếm theo trạng thái suy ra: bài đã hẹn giờ tuy lưu là PENDING nhưng KHÔNG
  // nằm trong hàng chờ duyệt — không ai cần làm gì với nó cả.
  const pendingCount = news.filter(
    (post) => derivePublicationState(post, now) === "PENDING",
  ).length;

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
          <div className="flex gap-2">
            {/* Quản lý chuyên mục là một TRANG riêng (`/tin-tuc/chuyen-muc`),
                không phải modal: màn đó cần hộp thoại xác nhận xóa, mà đặt
                Dialog trong Dialog làm focus và phím ESC nhập nhằng. */}
            <Button variant="outline" asChild>
              <Link to="/tin-tuc/chuyen-muc">
                <Tags className="size-4" /> Chuyên mục
              </Link>
            </Button>
            <NewsFormDialog
              trigger={
                <Button>
                  <Plus className="size-4" /> Viết tin
                </Button>
              }
            />
          </div>
        }
      />

      {/* Chip lọc theo cùng khuôn với màn Liên hệ. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((option) => {
          const count = news.filter((post) =>
            matchesFilter(derivePublicationState(post, now), option.value),
          ).length;
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                active
                  ? "border-brand bg-brand text-white"
                  : "border-line-strong bg-white text-slate hover:border-brand hover:text-brand"
              }`}
            >
              {option.label} ({count})
            </button>
          );
        })}
      </div>

      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category.id}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-slate"
            >
              {category.name.vi}
              {/* Tổng số bài (gồm cả nháp) — chỉ có ở route admin. Route công
                  khai cố ý không trả con số này. */}
              <span className="ml-1.5 text-slate/60">
                {category.totalCount ?? 0}
              </span>
            </span>
          ))}
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        loading={isLoading}
        emptyText="Không có bài viết nào ở trạng thái này."
      />

      <SchedulePublishDialog
        open={scheduleTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setScheduleTarget(null);
            setScheduleError(null);
          }
        }}
        contentTitle={scheduleTarget?.title.vi ?? ""}
        currentScheduledAt={
          scheduleTarget && isActiveFutureSchedule(scheduleTarget, now)
            ? scheduleTarget.scheduledAt
            : null
        }
        submitting={schedulePublication.isPending}
        errorMessage={scheduleError}
        onSubmit={(scheduledAt) => void handleSchedule(scheduledAt)}
      />

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
