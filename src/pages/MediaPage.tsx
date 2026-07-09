import { Upload, ImageIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/button";
import { useMedia } from "@/lib/api/queries";

export function MediaPage() {
  const { data: media = [], isLoading } = useMedia();

  return (
    <div>
      <PageHeader
        title="Thư viện ảnh"
        description="Ảnh tải lên Cloudinary, tối ưu WebP/AVIF ≤ 2MB (ED-05)."
        actions={
          <Button>
            <Upload className="size-4" /> Tải ảnh lên
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="aspect-3/2 animate-pulse rounded-xl bg-gray-200"
              />
            ))
          : media.map((asset) => (
              <figure
                key={asset.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <div className="grid aspect-3/2 place-items-center bg-gray-100 text-gray-400">
                  <ImageIcon className="size-8" />
                </div>
                <figcaption className="px-3 py-2">
                  <p className="truncate text-xs font-medium text-ink">
                    {asset.filename}
                  </p>
                  <p className="text-xs text-slate">{asset.sizeKb} KB</p>
                </figcaption>
              </figure>
            ))}
      </div>
    </div>
  );
}
