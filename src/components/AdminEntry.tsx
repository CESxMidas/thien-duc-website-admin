import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { LOGIN_PATH } from "@/lib/api/client";

// /admin là điểm vào chung: chỉ dựng bố cục quản trị sau khi đã có phiên.
export function AdminEntry() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  return user ? <AdminLayout /> : <LoginPage />;
}

export function LegacyLoginRedirect() {
  const location = useLocation();
  return <Navigate to={LOGIN_PATH} replace state={location.state} />;
}
