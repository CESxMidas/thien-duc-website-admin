import { useState } from "react";
import {
  CalendarClock,
  CalendarX2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Undo2,
} from "lucide-react";
import { toast } from "sonner";

import { PageFormDialog } from "@/components/pages/PageFormDialog";
import { SchedulePublishDialog } from "@/components/content/SchedulePublishDialog";
import { PageHeader } from "@/components/ui/PageHeader";
import { DetailDialog } from "@/components/ui/DetailDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useAuth } from "@/context/AuthContext";
import {
  useCancelPagePublication,
  usePages,
  useSchedulePagePublication,
  useUpdatePageStatus,
} from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { hasEnglish } from "@/lib/bilingual";
import { canEditPage } from "@/lib/content-editing";
import { contentStatusActions } from "@/lib/content-status-actions";
import {
  derivePagePublicationState,
  isActiveFuturePageSchedule,
  pageScheduleActions,
} from "@/lib/page-schedule";
import {
  contentStatusLabel,
  formatDateTime,
  publicationStateLabel,
  publicationStateTone,
} from "@/lib/labels";
import { formatVietnamDateTime } from "@/lib/vietnam-time";
import type { ContentStatus, StaticPage } from "@/types";

export function PagesPage() {
  const { user } = useAuth();
  const { data: pages = [], isLoading } = usePages();
  const updateStatus = useUpdatePageStatus();
  const schedulePublication = useSchedulePagePublication();
  const cancelPublication = useCancelPagePublication();
  const [detail, setDetail] = useState<StaticPage | null>(null);
  const [busySlug, setBusySlug] = useState<string | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<StaticPage | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Đồng hồ MÁY, chỉ để chọn nhãn và ẩn nút chắc chắn bị từ chối — backend mới
  // là nơi quyết định trang có công khai hay không (xem `page-schedule.ts`).
  const now = new Date();

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

  async function handleSchedule(scheduledAt: string) {
    if (!scheduleTarget) return;
    const isReschedule = isActiveFuturePageSchedule(scheduleTarget, now);
    setScheduleError(null);
    try {
      await schedulePublication.mutateAsync({
        slug: scheduleTarget.slug,
        scheduledAt,
      });
      toast.success(isReschedule ? "Đã đổi lịch đăng." : "Đã lên lịch đăng.");
      setScheduleTarget(null);
    } catch (error) {
      // Lỗi nghiệp vụ (400 quá gần/quá xa, 409 trang đã từng đăng) hiện NGAY
      // trong hộp thoại: người dùng còn nguyên giá trị vừa nhập để sửa lại.
      setScheduleError(resolveApiError(error, "Không đặt được lịch đăng."));
    }
  }

  /**
   * Huỷ lịch — KHÔNG hỏi lại. Quy ước hiện có của CMS: hộp thoại xác nhận chỉ
   * dành cho thao tác không hoàn tác được; các thao tác đổi trạng thái thực hiện
   * thẳng. Huỷ lịch cùng loại với chúng — trang về nháp và đặt lại lịch được ngay.
   */
  async function handleCancelSchedule(page: StaticPage) {
    setBusySlug(page.slug);
    try {
      await cancelPublication.mutateAsync(page.slug);
      toast.success("Đã huỷ lịch đăng. Trang trở về nháp.");
    } catch (error) {
      toast.error(resolveApiError(error, "Không huỷ được lịch đăng."));
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
      render: (page) => {
        const state = derivePagePublicationState(page, now);
        const scheduledLabel = page.scheduledAt
          ? formatVietnamDateTime(page.scheduledAt)
          : null;
        return (
          <div className="grid gap-0.5">
            <Badge variant={publicationStateTone[state]}>
              {publicationStateLabel[state]}
            </Badge>
            {state === "SCHEDULED" && scheduledLabel ? (
              <p className="text-xs text-slate">{scheduledLabel}</p>
            ) : null}
          </div>
        );
      },
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
          {/* EDITOR không sửa được trang ĐANG hiển thị công khai — backend trả
              403, nên không hiện nút. ADMIN trở lên giữ nguyên quyền sửa. */}
          {/* EDITOR mất quyền sửa từ lúc trang được hẹn giờ hoặc đã từng công
              khai — backend trả 403, nên không hiện nút. ADMIN trở lên giữ
              nguyên quyền sửa. */}
          {canEditPage(user?.role, page) && (
            <PageFormDialog
              page={page}
              trigger={
                <Button variant="ghost" size="sm" aria-label="Sửa trang">
                  <Pencil className="size-4" />
                </Button>
              }
            />
          )}
          {busySlug === page.slug && (
            <Loader2 className="size-3.5 animate-spin text-slate" />
          )}
          {contentStatusActions(user?.role, page.status)
            // Ở trạng thái "Đã lên lịch", "Trả về nháp" và "Huỷ lịch" cho ra
            // CÙNG một kết quả (DRAFT, xoá cả hai mốc). Giữ lại nút nói đúng
            // việc đang làm; ở mọi trạng thái khác "Trả về nháp" vẫn như trước.
            .filter(
              (action) =>
                !(
                  derivePagePublicationState(page, now) === "SCHEDULED" &&
                  action.intent === "revert"
                ),
            )
            .map((action) => (
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
                {(action.intent === "submit" ||
                  action.intent === "publish") && <Send className="size-4" />}
                {action.intent === "revert" && <Undo2 className="size-4" />}
                {/* Trang đang hẹn giờ: "Duyệt & đăng" thành "Đăng ngay" — vẫn đi
                    qua route `status` như cũ, backend chuyển mốc công khai về
                    hiện tại và xoá lịch. */}
                {derivePagePublicationState(page, now) === "SCHEDULED" &&
                action.intent === "approve"
                  ? "Đăng ngay"
                  : action.label}
              </Button>
            ))}

          {(() => {
            const schedule = pageScheduleActions(user?.role, page, now);
            return (
              <>
                {(schedule.schedule || schedule.reschedule) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busySlug === page.slug}
                    onClick={() => {
                      setScheduleError(null);
                      setScheduleTarget(page);
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
                    disabled={busySlug === page.slug}
                    onClick={() => void handleCancelSchedule(page)}
                  >
                    <CalendarX2 className="size-4" />
                    Huỷ lịch
                  </Button>
                )}
              </>
            );
          })()}
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Trang nội dung"
        description="Nội dung trang tĩnh (giới thiệu, liên hệ, chính sách, v.v.)"
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

      {/* Dùng lại đúng hộp thoại của Tin tức/Dự án/Hợp tác — cùng ràng buộc giờ
          Việt Nam, cùng hai ngưỡng 1 phút / 2 năm. Không dựng UI ngày giờ thứ hai. */}
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
          scheduleTarget && isActiveFuturePageSchedule(scheduleTarget, now)
            ? scheduleTarget.scheduledAt
            : null
        }
        submitting={schedulePublication.isPending}
        errorMessage={scheduleError}
        onSubmit={(scheduledAt) => void handleSchedule(scheduledAt)}
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
                    <Badge
                      variant={
                        publicationStateTone[
                          derivePagePublicationState(detail, now)
                        ]
                      }
                    >
                      {
                        publicationStateLabel[
                          derivePagePublicationState(detail, now)
                        ]
                      }
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
