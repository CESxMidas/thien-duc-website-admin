// Modal xem chi tiết một tài khoản: gọi GET /users/:id để lấy thêm thời điểm
// tạo/cập nhật và tình trạng khóa tạm. Dùng ở trang Tài khoản (bấm vào hàng)
// và ở menu góc phải Topbar ("Thông tin tài khoản" của chính mình).

import { Badge } from "@/components/ui/badge";
import { DetailList } from "@/components/ui/DetailDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUser } from "@/lib/api/queries";
import { formatDateTime, roleLabel } from "@/lib/labels";

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand font-display text-lg font-bold text-white">
              {user?.name.charAt(0) ?? "?"}
            </span>
            <div className="min-w-0">
              <DialogTitle className="truncate font-display">
                {user?.name ?? "Thông tin tài khoản"}
              </DialogTitle>
              <DialogDescription className="truncate">
                {user?.email ?? "Chi tiết tài khoản quản trị."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

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
                value: (
                  <Badge variant={user.isActive ? "green" : "gray"}>
                    {user.isActive ? "Hoạt động" : "Đã khóa"}
                  </Badge>
                ),
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
      </DialogContent>
    </Dialog>
  );
}
