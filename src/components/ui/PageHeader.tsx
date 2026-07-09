import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        {/* Vạch vàng + tiêu đề font display: nhịp nhận diện lặp lại trên mọi
            trang, ăn khớp với thanh vàng đánh dấu mục đang chọn ở sidebar. */}
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-5.5 w-1 rounded-full bg-gold" />
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">
            {title}
          </h1>
        </div>
        {description && (
          <p className="mt-1.5 text-sm text-slate">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
