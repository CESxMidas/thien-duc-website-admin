import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { ReactNode } from "react";
import type { Role } from "@/types";

interface ProtectedRouteProps {
  children: ReactNode;
  /** Nếu truyền, chỉ các vai trò này được vào; sai quyền → /403. Bỏ trống =
   * mọi tài khoản đã đăng nhập đều vào được. */
  roles?: Role[];
}

export function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) return null;

  // Chưa đăng nhập → về login, nhớ route đang muốn vào để quay lại sau khi login.
  if (!user) {
    return <Navigate to="/dang-nhap" replace state={{ from: location }} />;
  }

  // Đã đăng nhập nhưng không đủ quyền → 403.
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/403" replace />;
  }

  return <>{children}</>;
}
