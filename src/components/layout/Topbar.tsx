import { useState } from "react";
import { Menu, LogOut, ChevronDown } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { roleLabel } from "@/lib/labels";

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-6">
      <button
        className="rounded-md p-2 text-slate hover:bg-gray-100 lg:hidden"
        onClick={onMenu}
        aria-label="Mở menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="hidden text-sm text-slate lg:block">
        Xin chào, quản trị viên Thiên Đức 👋
      </div>

      <div className="relative ml-auto">
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-100"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={menuOpen}
        >
          <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-white">
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
            <div className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              <div className="border-b border-gray-100 px-4 py-2">
                <p className="truncate text-sm font-medium text-ink">
                  {user?.name}
                </p>
                <p className="truncate text-xs text-slate">{user?.email}</p>
              </div>
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
    </header>
  );
}
