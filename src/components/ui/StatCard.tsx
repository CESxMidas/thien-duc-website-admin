import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  accent = "brand",
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon: LucideIcon;
  to: string;
  accent?: "brand" | "amber" | "blue" | "green";
}) {
  // Cùng token ngữ nghĩa với Badge (`--color-status-*`, xem `src/index.css`):
  // ô icon và huy hiệu trạng thái là một hệ màu, sửa một chỗ. Cặp cũ
  // `text-green-700` trên `bg-green-100` chỉ đạt 4.497:1 — dưới ngưỡng AA nếu
  // sau này ô này có chữ; cặp mới đạt ≥ 7:1.
  const accentBg: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    amber: "bg-status-warning-surface text-status-warning-fg",
    blue: "bg-status-info-surface text-status-info-fg",
    green: "bg-status-success-surface text-status-success-fg",
  };

  return (
    <Link
      to={to}
      className="group rounded-xl border border-line bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-brand-soft hover:shadow-md hover:shadow-brand/5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate">{label}</p>
          {/* Số liệu dùng font display + tabular-nums để cột số thẳng hàng. */}
          <p className="mt-2 font-display text-3xl font-bold tracking-tight text-ink tabular-nums">
            {value}
          </p>
        </div>
        <span
          className={`grid size-11 place-items-center rounded-lg transition-transform group-hover:scale-105 ${accentBg[accent]}`}
        >
          <Icon className="size-5" />
        </span>
      </div>
      {hint && <p className="mt-3 text-xs text-slate">{hint}</p>}
    </Link>
  );
}
