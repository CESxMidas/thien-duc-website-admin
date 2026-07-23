// Modal xem chi tiết một tài khoản: gọi GET /users/:id để lấy thêm thời điểm
// tạo/cập nhật và tình trạng khóa tạm. Dùng ở trang Tài khoản (bấm vào hàng)
// và ở menu góc phải Topbar ("Thông tin tài khoản" của chính mình).

import { Badge } from "@/components/ui/badge";
import { DetailList } from "@/components/ui/DetailDialog";
import { SplitModal } from "@/components/ui/SplitModal";
import { useUser } from "@/lib/api/queries";
import { formatDateTime, roleLabel } from "@/lib/labels";
import { getUserStatus } from "@/lib/user-status";

export function UserDetailDialog({
  userId,
  open,
  onOpenChange,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: user, isLoading, isError } = useUser(open ? userId : null);

  const tempLocked =
    user?.lockedUntil !== null &&
    user !== undefined &&
    new Date(user.lockedUntil!) > new Date();

  return (
    <SplitModal
      open={open}
      onOpenChange={onOpenChange}
      size="default"
      title={
        <span className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand font-display text-lg font-bold text-white">
            {user?.name.charAt(0) ?? "?"}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-display text-lg text-ink">
              {user?.name ?? "Thông tin tài khoản"}
            </span>
            <span className="truncate text-sm font-normal text-slate">
              {user?.email ?? "Chi tiết tài khoản quản trị."}
            </span>
          </span>
        </span>
      }
    >
      {isLoading ? (
          <div className="space-y-3 py-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-cream" />
            ))}
          </div>
        ) : isError || !user ? (
          <p className="py-4 text-sm text-slate">
            Không tải được thông tin tài khoản. Đóng và thử lại.
          </p>
        ) : (
          <DetailList
            fields={[
              { label: "Vai trò", value: roleLabel[user.role] },
              {
                label: "Trạng thái",
                value: (() => {
                  const status = getUserStatus(user);
                  return <Badge variant={status.tone}>{status.label}</Badge>;
                })(),
              },
              ...(tempLocked
                ? [
                    {
                      label: "Khóa tạm đến",
                      value: (
                        <span className="text-red-700">
                          {formatDateTime(user.lockedUntil!)}
                        </span>
                      ),
                    },
                  ]
                : []),
              { label: "Ngày tạo", value: formatDateTime(user.createdAt) },
              {
                label: "Cập nhật gần nhất",
                value: formatDateTime(user.updatedAt),
              },
              {
                label: "Mã tài khoản",
                value: (
                  <span className="font-mono text-xs text-slate">
                    {user.id}
                  </span>
                ),
              },
            ]}
          />
        )}
    </SplitModal>
  );
}
