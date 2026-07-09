import { useState } from "react";
import { Menu, LogOut, ChevronDown, CircleUserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserDetailDialog } from "@/components/users/UserDetailDialog";
import { roleLabel } from "@/lib/labels";
import { usePresence } from "@/lib/use-presence";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menu = usePresence(menuOpen);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-line bg-white/90 px-4 backdrop-blur lg:px-6">
      <button
        className="rounded-md p-2 text-slate hover:bg-cream lg:hidden"
        onClick={onMenu}
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden text-sm text-slate lg:block">
        Xin chào, <span className="font-medium text-ink">{user?.name}</span>
      </div>

      <div className="relative ml-auto">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors duration-150 hover:bg-cream"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand font-display text-sm font-semibold text-white">
            {user?.name.charAt(0) ?? "?"}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block text-sm font-medium text-ink">
              {user?.name}
            </span>
            <span className="block text-xs text-slate">
              {user ? roleLabel[user.role] : ""}
            </span>
          </span>
          {/* Mũi tên xoay theo trạng thái mở — báo trước điều gì sắp xảy ra. */}
          <ChevronDown
            className={`size-4 text-slate transition-transform duration-200 ease-enter ${
              menuOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {menu.mounted && (
          <>
            {/* Lớp bắt click ra ngoài chỉ tồn tại khi menu thực sự mở — nếu để
                nó nán lại suốt animation đóng, người dùng mất 150ms không bấm
                được gì. */}
            {menuOpen && (
              <div
                className="fixed inset-0 z-10"
                onClick={() => setMenuOpen(false)}
                aria-hidden
              />
            )}
            {/* Menu bung ra từ chính nút bấm (origin góc phải trên) chứ không
                hiện giữa không trung — giữ liên tục về không gian. Đóng thì thu
                về đúng chỗ cũ thay vì tắt phụt. */}
            <div
              data-state={menu.state}
              className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 slide-in-from-top-1 absolute right-0 z-20 mt-2 w-56 origin-top-right rounded-lg border border-line bg-white py-1 shadow-lg duration-150 ease-enter data-[state=closed]:pointer-events-none data-[state=closed]:ease-exit"
            >
              <div className="border-b border-line px-4 py-2">
                <p className="truncate text-sm font-medium text-ink">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate">{user?.email}</p>
              </div>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink transition-colors duration-150 hover:bg-cream"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
              >
                <CircleUserRound className="size-4 text-slate" />
                Thông tin tài khoản
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 transition-colors duration-150 hover:bg-red-50"
                onClick={logout}
              >
                <LogOut className="size-4" />
                Đăng xuất
              </button>
            </div>
          </>
        )}
      </div>

      <UserDetailDialog
        userId={user?.id ?? null}
        open={profileOpen}
        onOpenChange={setProfileOpen}
      />
    </header>
  );
}
