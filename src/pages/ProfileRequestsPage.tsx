import { useState } from "react";
import { toast } from "sonner";
import { Check, Clock, Inbox, Loader2, X } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SplitModal } from "@/components/ui/SplitModal";
import { Textarea } from "@/components/ui/textarea";
import { useProfileRequests, useReviewProfileRequest } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { resolveAssetUrl } from "@/lib/asset-url";
import {
  formatDateTime,
  profileFieldLabel,
  profileStatusLabel,
  profileStatusTone,
  roleLabel,
} from "@/lib/labels";
import type { ProfileChangeRequestRow } from "@/types";

/** Hiển thị giá trị đề xuất; ảnh đại diện chỉ báo "(ảnh mới)". */
function renderValue(key: string, value: unknown): string {
  if (key === "avatarUrl") return "(ảnh mới)";
  const text = String(value ?? "").trim();
  return text || "(để trống)";
}

export function ProfileRequestsPage() {
  const { data: requests = [], isLoading } = useProfileRequests();
  const review = useReviewProfileRequest();
  const [rejecting, setRejecting] = useState<ProfileChangeRequestRow | null>(
    null,
  );
  const [note, setNote] = useState("");

  const pending = requests.filter((r) => r.status === "PENDING");
  const history = requests.filter((r) => r.status !== "PENDING");

  async function onApprove(row: ProfileChangeRequestRow) {
    try {
      await review.mutateAsync({ id: row.id, input: { action: "APPROVE" } });
      toast.success(`Đã duyệt cập nhật của ${row.user.name}.`);
    } catch (error) {
      toast.error(resolveApiError(error, "Không duyệt được yêu cầu."));
    }
  }

  async function onConfirmReject() {
    if (!rejecting) return;
    try {
      await review.mutateAsync({
        id: rejecting.id,
        input: { action: "REJECT", note: note.trim() || undefined },
      });
      toast.success(`Đã từ chối yêu cầu của ${rejecting.user.name}.`);
      setRejecting(null);
      setNote("");
    } catch (error) {
      toast.error(resolveApiError(error, "Không từ chối được yêu cầu."));
    }
  }

  return (
    <div>
      <PageHeader
        title="Duyệt cập nhật hồ sơ"
        description="Xem và phê duyệt các thay đổi thông tin do nhân viên gửi lên."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-xl bg-cream" />
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
              <Clock className="size-4 text-amber-600" />
              Đang chờ duyệt
              <span className="rounded-full bg-amber-100 px-2 text-xs text-amber-800">
                {pending.length}
              </span>
            </h2>

            {pending.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate">
                  <Inbox className="size-8 text-slate/40" />
                  Không có yêu cầu nào đang chờ duyệt.
                </CardContent>
              </Card>
            ) : (
              <ul className="space-y-3">
                {pending.map((row) => (
                  <li key={row.id}>
                    <Card>
                      <CardContent className="flex flex-col gap-4 py-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <RequesterAvatar row={row} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {row.user.name}{" "}
                              <Badge variant="gray" className="ml-1">
                                {roleLabel[row.user.role]}
                              </Badge>
                            </p>
                            <p className="text-xs text-slate">
                              {row.user.email} · gửi{" "}
                              {formatDateTime(row.createdAt)}
                            </p>
                            <ul className="mt-2 space-y-0.5 text-sm text-ink">
                              {Object.entries(row.payload).map(
                                ([key, value]) => (
                                  <li key={key}>
                                    <span className="text-slate">
                                      {profileFieldLabel[key] ?? key}:
                                    </span>{" "}
                                    {renderValue(key, value)}
                                  </li>
                                ),
                              )}
                            </ul>
                          </div>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button
                            size="sm"
                            disabled={review.isPending}
                            onClick={() => void onApprove(row)}
                          >
                            <Check className="size-4" /> Duyệt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            disabled={review.isPending}
                            onClick={() => {
                              setRejecting(row);
                              setNote("");
                            }}
                          >
                            <X className="size-4" /> Từ chối
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {history.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                Đã xử lý gần đây
              </h2>
              <ul className="space-y-2">
                {history.slice(0, 20).map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-xl border border-line px-4 py-2.5 text-sm"
                  >
                    <Badge variant={profileStatusTone[row.status]}>
                      {profileStatusLabel[row.status]}
                    </Badge>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {row.user.name}
                      <span className="text-slate">
                        {" "}
                        · {Object.keys(row.payload).length} thay đổi
                      </span>
                    </span>
                    {row.reviewedBy && (
                      <span className="hidden text-xs text-slate sm:block">
                        bởi {row.reviewedBy.name}
                        {row.reviewedAt
                          ? ` · ${formatDateTime(row.reviewedAt)}`
                          : ""}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      {/* Dialog từ chối kèm lý do */}
      <SplitModal
        open={rejecting !== null}
        onOpenChange={(open) => !open && setRejecting(null)}
        size="default"
        title="Từ chối yêu cầu"
        description="Nêu lý do để nhân viên hiểu vì sao thay đổi không được duyệt (không bắt buộc)."
        footer={
          <>
            <Button variant="outline" onClick={() => setRejecting(null)}>
              Hủy
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={review.isPending}
              onClick={() => void onConfirmReject()}
            >
              {review.isPending && <Loader2 className="size-4 animate-spin" />}
              Từ chối
            </Button>
          </>
        }
      >
        <Textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ví dụ: Số điện thoại chưa đúng định dạng."
        />
      </SplitModal>
    </div>
  );
}

function RequesterAvatar({ row }: { row: ProfileChangeRequestRow }) {
  if (row.user.avatarUrl) {
    return (
      <img
        src={resolveAssetUrl(row.user.avatarUrl)}
        alt=""
        className="size-10 shrink-0 rounded-full border border-line object-cover"
      />
    );
  }
  const initial = row.user.name.trim()[0]?.toUpperCase() ?? "?";
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-full bg-espresso text-sm font-semibold text-cream">
      {initial}
    </div>
  );
}
