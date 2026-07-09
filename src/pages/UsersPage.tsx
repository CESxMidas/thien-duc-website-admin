import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { useUsers } from "@/lib/api/queries";
import { roleLabel } from "@/lib/labels";
import type { AdminUser } from "@/types";

const columns: Column<AdminUser>[] = [
  {
    key: "name",
    header: "Họ tên",
    render: (u) => <span className="font-medium text-ink">{u.name}</span>,
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
];

export function UsersPage() {
  const { data: users = [], isLoading } = useUsers();

  return (
    <div>
      <PageHeader
        title="Tài khoản"
        description="Quản lý tài khoản và vai trò Editor / Admin / Super Admin (KB-10)."
        actions={
          <Button>
            <UserPlus className="size-4" /> Thêm tài khoản
          </Button>
        }
      />
      <DataTable columns={columns} rows={users} loading={isLoading} />
    </div>
  );
}
