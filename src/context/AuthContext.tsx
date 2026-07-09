import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import * as authService from "@/lib/api/auth";
import type { AuthUser } from "@/types";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Đăng nhập email/password. Ném lỗi (kèm status) để caller map sang toast. */
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Khôi phục phiên đồng bộ ngay khi tải trang (decode access token đang lưu),
  // nên trường hợp phổ biến không có trạng thái "đang tải" gây nháy màn hình.
  const [user, setUser] = useState<AuthUser | null>(authService.restoreUser);
  // Chỉ "đang tải" khi access token hết hạn nhưng còn refresh token — cần một
  // lượt gọi /auth/refresh bất đồng bộ trước khi kết luận đã đăng nhập hay chưa.
  const [isLoading, setIsLoading] = useState<boolean>(
    authService.canRestoreSession,
  );

  useEffect(() => {
    if (!isLoading) return;
    let active = true;
    authService.restoreSession().then((restored) => {
      if (!active) return;
      setUser(restored);
      setIsLoading(false);
    });
    return () => {
      active = false;
    };
    // Chạy đúng một lần lúc mount (giá trị isLoading ban đầu quyết định).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const loggedIn = await authService.login(email, password, remember);
      setUser(loggedIn);
    },
    [],
  );

  const logout = useCallback(async () => {
    await authService.logout();
    setUser(null);
    toast.success("Đăng xuất thành công.");
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isLoading,
      login,
      logout,
    }),
    [user, isLoading, login, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth phải nằm trong <AuthProvider>");
  return ctx;
}
