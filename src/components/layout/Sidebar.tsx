import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import { X } from "lucide-react";
import { navItems } from "./nav";
import { useAuth } from "@/context/AuthContext";
import { usePresence } from "@/lib/use-presence";

export function Sidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const overlay = usePresence(open);
  const items = navItems.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  // Esc đóng drawer mobile — lối thoát bằng bàn phím cho lớp phủ toàn màn hình.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <>
      {/* Lớp phủ mobile — mờ dần vào rồi mờ dần ra cùng nhịp với drawer. Giữ
          trong DOM tới hết animation thoát (usePresence), nếu không nó biến mất
          tức thì trong khi drawer vẫn đang trượt. */}
      {overlay.mounted && (
        <div
          data-state={overlay.state}
          className="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in data-[state=closed]:fade-out fixed inset-0 z-30 bg-black/40 duration-200 ease-enter data-[state=closed]:duration-150 lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      {/* Khi đóng trên mobile phải `invisible`, không chỉ trượt ra ngoài màn
          hình: phần tử chỉ bị dịch chuyển vẫn nhận được tiêu điểm bàn phím,
          khiến người dùng tab vào menu vô hình. Trên lg luôn hiện.

          `visibility` nằm trong danh sách thuộc tính chuyển tiếp: nếu không,
          drawer bị ẩn ngay lập tức và cú trượt lúc đóng không bao giờ thấy
          được. visibility không nội suy — trình duyệt giữ `visible` tới hết
          transition rồi mới ẩn, đúng thứ ta cần. */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-espresso text-white transition-[transform,visibility] lg:visible lg:static lg:translate-x-0 lg:transition-none ${
          open
            ? "visible translate-x-0 duration-200 ease-enter"
            : "invisible -translate-x-full duration-150 ease-exit"
        }`}
      >
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-5">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-lg bg-gold font-display font-bold text-ink">
              TĐ
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-semibold tracking-wide">
                Thiên Đức
              </p>
              <p className="text-[11px] tracking-[0.14em] text-gold/80 uppercase">
                Trang quản trị
              </p>
            </div>
          </div>
          <button
            className="rounded-md p-1 text-white/70 hover:bg-white/10 lg:hidden"
            onClick={onClose}
            aria-label="Đóng menu"
          >
            <X className="size-5" />
          </button>
        </div>

        <nav className="scrollbar-on-dark flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              // Chữ ký thị giác: thanh vàng dọc bên trái mục đang chọn + nền
              // đồng trầm — thay vì khối màu đặc chung chung. Thanh vàng luôn
              // tồn tại trong DOM và chỉ đổi `scaleY`, nên nó *mọc* ra từ tâm
              // khi chuyển mục; nếu dựng/hủy phần tử thì nó bật ra tức thì.
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors duration-150 before:absolute before:inset-y-1.5 before:left-0 before:w-0.75 before:rounded-full before:bg-gold before:transition-transform before:duration-200 before:ease-enter ${
                  isActive
                    ? "bg-brand/25 font-medium text-white before:scale-y-100"
                    : "text-white/70 before:scale-y-0 hover:bg-white/8 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className={`size-4.5 shrink-0 transition-colors duration-150 ${
                      isActive ? "text-gold" : "text-white/60 group-hover:text-white"
                    }`}
                  />
                  {label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* white/40 chỉ đạt ~3.9:1 trên nền tối — giữ /60 cho đủ 4.5:1. */}
        <p className="border-t border-white/10 px-5 py-4 text-xs text-white/60">
          Thiên Đức Quản Trị Nội Dung 2024. <br />
        </p>
      </aside>
    </>
  );
}
