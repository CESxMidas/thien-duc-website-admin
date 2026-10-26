import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AdminLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        {/* `key` theo đường dẫn: đổi route thì <main> được dựng lại nên
            animation `rise-in` chạy lại. Không có key, React tái sử dụng phần
            tử cũ và trang mới hiện ra không kèm chuyển động nào. */}
        {/* Nội dung cuộn riêng trong viewport, không kéo sidebar/topbar theo. */}
        <main key={location.pathname} className="rise-in min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
