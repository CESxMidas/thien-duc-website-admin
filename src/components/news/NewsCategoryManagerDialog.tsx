// Quản lý chuyên mục tin — modal đơn giản để bổ sung tên tiếng Anh (song ngữ)
// cho từng chuyên mục. Dùng PATCH /news/categories/:slug có sẵn; không tạo/xóa
// chuyên mục ở đây (giữ phạm vi tối thiểu). Slug giữ nguyên để không hỏng liên kết.

import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { BilingualField } from "@/components/ui/BilingualField";
import { useNewsCategories, useUpdateNewsCategory } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import {
  toBilingualPayload,
  toBilingualValue,
  type BilingualValue,
} from "@/lib/bilingual";
import type { NewsCategory } from "@/types";

export function NewsCategoryManagerDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { data: categories = [], isLoading } = useNewsCategories();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Quản lý chuyên mục</DialogTitle>
          <DialogDescription>
            Bổ sung tên tiếng Anh cho từng chuyên mục. Chấm vàng trên nút EN báo
            hiệu chưa có bản dịch. Slug và tên tiếng Việt giữ nguyên.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="py-6 text-center text-sm text-slate">Đang tải…</p>
        ) : categories.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate">
            Chưa có chuyên mục nào.
          </p>
        ) : (
          <ul className="max-h-[60vh] space-y-4 overflow-y-auto pr-1">
            {categories.map((category) => (
              <CategoryRow key={category.id} category={category} />
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryRow({ category }: { category: NewsCategory }) {
  const updateCategory = useUpdateNewsCategory();
  const [name, setName] = useState<BilingualValue>(() =>
    toBilingualValue(category.name),
  );

  async function onSave() {
    try {
      await updateCategory.mutateAsync({
        slug: category.slug,
        // Gửi cả vi + en để giữ nguyên bản tiếng Việt; slug không đổi.
        data: { name: toBilingualPayload(name) },
      });
      toast.success(`Đã lưu chuyên mục "${name.vi}".`);
    } catch (error) {
      toast.error(
        resolveApiError(error, "Không lưu được chuyên mục. Vui lòng thử lại."),
      );
    }
  }

  return (
    <li className="space-y-2 rounded-xl border border-line p-3">
      <p className="text-xs font-medium text-slate">/{category.slug}</p>
      <BilingualField
        value={name}
        onChange={setName}
        placeholder={{ vi: "Tin dự án", en: "Project news" }}
      />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          onClick={() => void onSave()}
          disabled={updateCategory.isPending || !name.vi.trim()}
        >
          {updateCategory.isPending && <Loader2 className="size-4 animate-spin" />}
          Lưu
        </Button>
      </div>
    </li>
  );
}
