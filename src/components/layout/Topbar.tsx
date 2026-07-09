import { useState } from "react";
import { Menu, LogOut, ChevronDown, CircleUserRound } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { UserDetailDialog } from "@/components/users/UserDetailDialog";
import { roleLabel } from "@/lib/labels";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream"
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
          <ChevronDown className="size-4 text-slate" />
        </button>

        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg border border-line bg-white py-1 shadow-lg">
              <div className="border-b border-line px-4 py-2">
                <p className="truncate text-sm font-medium text-ink">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate">{user?.email}</p>
              </div>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-ink hover:bg-cream"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
              >
                <CircleUserRound className="size-4 text-slate" />
                Thông tin tài khoản
              </button>
              <button
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
