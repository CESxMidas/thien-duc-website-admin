import type { ReactNode } from "react";

/**
 * Khung chung cho MỌI màn hình xác thực công khai (đăng nhập, thiết lập tài
 * khoản, quên/đặt lại mật khẩu) — một hệ thống nhất quán thay vì bốn trang rời.
 *
 * Bố cục:
 * - Desktop (lg+): chia đôi màn hình — cột nội dung/biểu mẫu bên trái, ảnh dự án
 *   thương hiệu bên phải.
 * - Mobile/tablet (< lg): một cột, ưu tiên biểu mẫu, ẩn hẳn cột ảnh để không
 *   tràn ngang và giữ thao tác gọn trong tầm tay.
 *
 * Khối logo + tên hệ thống nằm cố định đầu cột nội dung, dùng chung mọi trang.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-white lg:grid lg:grid-cols-2">
      {/* ---- Cột nội dung / biểu mẫu ---- */}
      <div className="flex min-h-dvh flex-col justify-center px-6 py-12 sm:px-12 lg:px-16 xl:px-24">
        <div className="mx-auto w-full max-w-md">
          {/* Logo + thương hiệu — nhận diện chung của hệ thống xác thực */}
          <div className="mb-8 flex items-center gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-lg border border-black/10 bg-white p-1.5 shadow-sm">
              <img
                src="/images/brand/logo-thien-duc.png"
                alt="Logo Thiên Đức"
                width={48}
                height={48}
                className="size-full object-contain"
              />
            </span>
            <div className="leading-tight">
              <p className="text-base font-semibold text-ink">Thiên Đức</p>
              <p className="text-xs text-slate">Hệ thống quản trị</p>
            </div>
          </div>

          {children}
        </div>
      </div>

      {/* ---- Cột ảnh dự án (ẩn dưới lg — ưu tiên biểu mẫu trên mobile/tablet) ---- */}
      <div className="relative hidden lg:block">
        <img
          src="/images/login-hero.jpg"
          alt="Phối cảnh tổng thể Khu đô thị Hưng Phú — Thiên Đức"
          className="absolute inset-0 h-full w-full object-cover"
        />
        {/* Lớp phủ màu thương hiệu để chữ trên ảnh đủ tương phản */}
        <div className="absolute inset-0 bg-linear-to-t from-ink/85 via-ink/25 to-transparent" />
        <div className="absolute inset-0 bg-brand/10 mix-blend-multiply" />

        {/* Nội dung giới thiệu (không phải tiêu đề tài liệu → dùng p, không h2) */}
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <span className="inline-block rounded-full bg-gold px-3 py-1 text-xs font-semibold text-ink">
            Dự án tiêu biểu
          </span>
          <p className="mt-4 max-w-md text-3xl font-bold leading-tight">
            Khu đô thị Hưng Phú
          </p>
          <p className="mt-2 max-w-md text-sm text-white/80">
            Kiến tạo không gian sống hiện đại, hạ tầng đồng bộ tại TP. Thủ Đức
          </p>
        </div>
      </div>
    </div>
  );
}
