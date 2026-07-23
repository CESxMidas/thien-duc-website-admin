import { useState } from "react";
import { toast } from "sonner";
import { LockOpen, MailX, Pencil, Send, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { UserDetailDialog } from "@/components/users/UserDetailDialog";
import { DeactivateUserDialog } from "@/components/users/DeactivateUserDialog";
import { RevokeInvitationDialog } from "@/components/users/RevokeInvitationDialog";
import { useAuth } from "@/context/AuthContext";
import {
  useReactivateUser,
  useResendUserInvitation,
  useUsers,
} from "@/lib/api/queries";
import { ApiRequestError } from "@/lib/api/client";
import { resolveApiError } from "@/lib/api-error-message";
import { roleLabel } from "@/lib/labels";
import { getUserStatus } from "@/lib/user-status";
import type { AdminUser } from "@/types";

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const { user: currentUser } = useAuth();
  const reactivate = useReactivateUser();
  const resendInvitation = useResendUserInvitation();
  const [toDeactivate, setToDeactivate] = useState<AdminUser | null>(null);
  const [toRevoke, setToRevoke] = useState<AdminUser | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Chỉ Super Admin mới được thêm/sửa/khóa (backend cũng chặn). Admin thường
  // vẫn xem được danh sách.
  const canManage = currentUser?.role === "SUPER_ADMIN";

  async function onReactivate(user: AdminUser) {
    try {
      await reactivate.mutateAsync(user.id);
      toast.success(`Đã mở khóa tài khoản ${user.email}.`);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không mở khóa được. Vui lòng thử lại."),
      );
    }
  }

  async function onResendInvitation(user: AdminUser) {
    setResendingId(user.id);
    try {
      await resendInvitation.mutateAsync(user.id);
      toast.success("Đã gửi lại lời mời thiết lập mật khẩu.");
    } catch (error) {
      // Backend trả 429 khi còn trong thời gian chờ (cooldown 60s).
      if (error instanceof ApiRequestError && error.status === 429) {
        toast.error("Vui lòng chờ trước khi gửi lại lời mời.");
      } else {
        toast.error(
          resolveApiError(error, "Không gửi lại được lời mời. Vui lòng thử lại."),
        );
      }
    } finally {
      setResendingId(null);
    }
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Họ tên",
      render: (u) => (
        <span className="font-medium text-ink">
          {u.name}
          {u.id === currentUser?.id && (
            <span className="ml-2 text-xs font-normal text-slate">(bạn)</span>
          )}
        </span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (u) => <span className="text-slate">{u.email}</span>,
    },
    {
      key: "role",
      header: "Vai trò",
      render: (u) => <span className="text-sm">{roleLabel[u.role]}</span>,
    },
    {
      key: "isActive",
      header: "Trạng thái",
      render: (u) => {
        const status = getUserStatus(u);
        return <Badge variant={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (u) => {
        if (!canManage) return null;
        const isSelf = u.id === currentUser?.id;
        const status = getUserStatus(u);
        return (
          // stopPropagation: hàng đã bấm được để mở chi tiết — các nút thao
          // tác không được kích hoạt luôn cả modal.
          <div
            className="flex justify-end gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <UserFormDialog
              user={u}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil className="size-4" />
                  Sửa
                </Button>
              }
            />
            {status.isPending ? (
              // Tài khoản chờ thiết lập: gửi lại / thu hồi lời mời thay cho khóa.
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onResendInvitation(u)}
                  disabled={resendingId === u.id}
                >
                  <Send className="size-4" />
                  Gửi lại lời mời
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setToRevoke(u)}
                >
                  <MailX className="size-4" />
                  Thu hồi
                </Button>
              </>
            ) : u.isActive ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={isSelf}
                // Không thể tự khóa mình — backend chặn, ẩn luôn khả năng bấm.
                title={isSelf ? "Không thể tự khóa tài khoản của mình" : undefined}
                onClick={() => setToDeactivate(u)}
              >
                Khóa
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void onReactivate(u)}
                disabled={reactivate.isPending}
              >
                <LockOpen className="size-4" />
                Mở khóa
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
        title="Tài khoản"
        description="Quản lý người dùng và vai trò truy cập trang quản trị."
        actions={
          canManage ? (
            <UserFormDialog
              trigger={
                <Button>
                  <UserPlus className="size-4" /> Thêm tài khoản
                </Button>
              }
            />
          ) : null
        }
      />
      <DataTable
        columns={columns}
        rows={users}
        loading={isLoading}
        emptyText="Chưa có tài khoản nào."
        onRowClick={(u) => setDetailId(u.id)}
      />

      <UserDetailDialog
        userId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => !open && setDetailId(null)}
      />

      <DeactivateUserDialog
        user={toDeactivate}
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
      />

      <RevokeInvitationDialog
        user={toRevoke}
        open={toRevoke !== null}
        onOpenChange={(open) => !open && setToRevoke(null)}
      />
    </div>
  );
}
