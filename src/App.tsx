import { BrowserRouter, Routes, Route } from "react-router-dom";
import { toRouterBasename } from "@/lib/base-path";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { AccountSetupPage } from "@/pages/AccountSetupPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { NewsPage } from "@/pages/NewsPage";
import { NewsCategoriesPage } from "@/pages/NewsCategoriesPage";
import { PagesPage } from "@/pages/PagesPage";
import { BannersPage } from "@/pages/BannersPage";
import { CooperationPage } from "@/pages/CooperationPage";
import { ContactPage } from "@/pages/ContactPage";
import { MediaPage } from "@/pages/MediaPage";
import { BrandingSettingsPage } from "@/pages/BrandingSettingsPage";
import { UsersPage } from "@/pages/UsersPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { ProfileRequestsPage } from "@/pages/ProfileRequestsPage";
import { ForbiddenPage } from "@/pages/ForbiddenPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter basename={toRouterBasename()}>
        <Routes>
          <Route path="/dang-nhap" element={<LoginPage />} />
          <Route path="/thiet-lap-tai-khoan" element={<AccountSetupPage />} />
          <Route path="/quen-mat-khau" element={<ForgotPasswordPage />} />
          <Route path="/dat-lai-mat-khau" element={<ResetPasswordPage />} />
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
            <Route path="tin-tuc/chuyen-muc" element={<NewsCategoriesPage />} />
            <Route path="trang" element={<PagesPage />} />
            <Route
              path="banner"
              element={
                <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                  <BannersPage />
                </ProtectedRoute>
              }
            />
            <Route path="du-an-hop-tac" element={<CooperationPage />} />
            <Route
              path="lien-he"
              element={
                <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                  <ContactPage />
                </ProtectedRoute>
              }
            />
            <Route path="thu-vien" element={<MediaPage />} />
            <Route
              path="thuong-hieu"
              element={
                <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                  <BrandingSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route path="ho-so" element={<ProfilePage />} />
            <Route
              path="duyet-ho-so"
              element={
                <ProtectedRoute roles={["ADMIN", "SUPER_ADMIN"]}>
                  <ProfileRequestsPage />
                </ProtectedRoute>
              }
            />
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
