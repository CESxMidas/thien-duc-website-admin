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
  const accentBg: Record<string, string> = {
    brand: "bg-brand/10 text-brand",
    amber: "bg-amber-100 text-amber-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
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
