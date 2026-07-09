import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { NewsPage } from "@/pages/NewsPage";
import { PagesPage } from "@/pages/PagesPage";
import { BannersPage } from "@/pages/BannersPage";
import { ContactPage } from "@/pages/ContactPage";
import { MediaPage } from "@/pages/MediaPage";
import { UsersPage } from "@/pages/UsersPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="du-an" element={<ProjectsPage />} />
            <Route path="tin-tuc" element={<NewsPage />} />
            <Route path="trang" element={<PagesPage />} />
            <Route path="banner" element={<BannersPage />} />
            <Route path="lien-he" element={<ContactPage />} />
            <Route path="thu-vien" element={<MediaPage />} />
            {/* Quản lý tài khoản chỉ dành cho Admin/Super Admin. */}
            <Route
              path="tai-khoan"
              element={
                <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
