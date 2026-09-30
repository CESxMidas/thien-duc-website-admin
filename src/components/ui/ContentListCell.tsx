import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { resolveAssetUrl } from "@/lib/asset-url";

interface ContentListCellProps {
  title: string;
  image?: string | null;
  imageAlt?: string;
  fallbackIcon: LucideIcon;
  fallbackTitle: string;
  metadata?: ReactNode;
  detail?: ReactNode;
}

export function ContentListCell({
  title,
  image,
  imageAlt,
  fallbackIcon: FallbackIcon,
  fallbackTitle,
  metadata,
  detail,
}: ContentListCellProps) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div
        className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg border border-line bg-cream"
        title={image ? undefined : fallbackTitle}
      >
        {image ? (
          <img
            src={resolveAssetUrl(image)}
            alt={imageAlt ?? title}
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <FallbackIcon
            className="size-6 text-slate/45"
            aria-hidden="true"
          />
        )}
      </div>
      <div className="min-w-0">
        <p className="line-clamp-2 font-medium leading-snug text-ink">{title}</p>
        {metadata ? (
          <p className="mt-1 line-clamp-1 text-xs text-slate">{metadata}</p>
        ) : null}
        {detail ? (
          <p className="mt-1 line-clamp-1 text-xs text-slate/75">{detail}</p>
        ) : null}
      </div>
    </div>
  );
}
