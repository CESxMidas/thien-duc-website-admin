import { useState } from "react";
import { toast } from "sonner";
import { LockOpen, Pencil, UserPlus } from "lucide-react";

import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { UserFormDialog } from "@/components/users/UserFormDialog";
import { DeactivateUserDialog } from "@/components/users/DeactivateUserDialog";
import { useAuth } from "@/context/AuthContext";
import { useReactivateUser, useUsers } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { roleLabel } from "@/lib/labels";
import type { AdminUser } from "@/types";

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers();
  const { user: currentUser } = useAuth();
  const reactivate = useReactivateUser();
  const [toDeactivate, setToDeactivate] = useState<AdminUser | null>(null);

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
      render: (u) => (
        <Badge variant={u.isActive ? "green" : "gray"}>
          {u.isActive ? "Hoạt động" : "Đã khóa"}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Thao tác",
      render: (u) => {
        if (!canManage) return null;
        const isSelf = u.id === currentUser?.id;
        return (
          <div className="flex justify-end gap-1">
            <UserFormDialog
              user={u}
              trigger={
                <Button variant="ghost" size="sm">
                  <Pencil className="size-4" />
                  Sửa
                </Button>
              }
            />
            {u.isActive ? (
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
      />

      <DeactivateUserDialog
        user={toDeactivate}
        open={toDeactivate !== null}
        onOpenChange={(open) => !open && setToDeactivate(null)}
      />
    </div>
  );
}
