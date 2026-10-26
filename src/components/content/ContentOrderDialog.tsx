import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  ListOrdered,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SplitModal } from "@/components/ui/SplitModal";
import { useAuth } from "@/context/AuthContext";
import { apiFetch } from "@/lib/api/client";
import { resolveApiError } from "@/lib/api-error-message";

type Collection =
  "projects" | "news" | "recruitment-positions" | `projects/${string}/items`;
export type OrderItem = { id: string; title: string };
type Props = { collection: Collection; items: OrderItem[]; disabled?: boolean };

export function ContentOrderDialog(props: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (user?.role !== "ADMIN" && user?.role !== "SUPER_ADMIN") return null;
  return (
    <>
      <Button
        variant="outline"
        disabled={props.disabled || props.items.length < 2}
        onClick={() => setOpen(true)}
      >
        <ListOrdered className="size-4" />
        Sắp xếp hiển thị
      </Button>
      {open && <OrderEditor {...props} onClose={() => setOpen(false)} />}
    </>
  );
}

function OrderEditor({
  collection,
  items,
  onClose,
}: Props & { onClose: () => void }) {
  const [ordered, setOrdered] = useState(items);
  const client = useQueryClient();
  const [domain, ...scope] = collection.split("/");
  const endpoint = `/${[domain, "admin", ...scope, "reorder"].join("/")}`;
  const mutation = useMutation({
    mutationFn: (ids: string[]) =>
      apiFetch(endpoint, {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      }),
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: [
          collection.startsWith("projects/") ? "projects" : collection,
        ],
      }),
  });
  const changed = ordered.some((item, index) => item.id !== items[index]?.id);
  const stale =
    ordered.length !== items.length ||
    ordered.some((item) => !items.some((current) => current.id === item.id));

  function move(from: number, to: number) {
    setOrdered((current) => {
      const next = [...current];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  }

  async function save() {
    try {
      await mutation.mutateAsync(ordered.map((item) => item.id));
      toast.success("Đã lưu thứ tự hiển thị.");
      onClose();
    } catch (error) {
      toast.error(
        resolveApiError(
          error,
          "Không lưu được thứ tự. Vui lòng tải lại danh sách và thử lại.",
        ),
      );
    }
  }

  return (
    <SplitModal
      open
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose();
      }}
      title="Sắp xếp hiển thị"
      description="Mục ở trên hiển thị trước trên website. Nội dung chỉ xuất hiện khi đã được đăng."
      footer={
        <>
          <Button
            variant="outline"
            disabled={mutation.isPending}
            onClick={onClose}
          >
            Hủy
          </Button>
          <Button
            disabled={!changed || stale || mutation.isPending}
            onClick={() => void save()}
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu thứ tự
          </Button>
        </>
      }
    >
      {stale && (
        <p role="alert" className="mb-4 text-sm text-status-warning-fg">
          Danh sách đã thay đổi. Đóng hộp thoại và mở lại để sắp xếp.
        </p>
      )}
      <ol className="space-y-2">
        {ordered.map((item, index) => (
          <li
            key={item.id}
            className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-lg border border-line bg-white p-3 sm:grid-cols-[1.5rem_minmax(0,1fr)_auto]"
          >
            <span className="w-6 text-sm text-slate tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">
              {item.title}
            </span>
            <div
              className="col-start-2 flex gap-1 sm:col-start-3"
              role="group"
              aria-label={`Thứ tự ${item.title}`}
            >
              {[
                { label: "Đưa lên đầu", to: 0, Icon: ArrowUpToLine },
                { label: "Đưa lên trên", to: index - 1, Icon: ArrowUp },
                { label: "Đưa xuống dưới", to: index + 1, Icon: ArrowDown },
                {
                  label: "Đưa xuống cuối",
                  to: ordered.length - 1,
                  Icon: ArrowDownToLine,
                },
              ].map(({ label, to, Icon }) => (
                <Button
                  key={label}
                  variant="ghost"
                  size="icon"
                  className="size-11"
                  type="button"
                  aria-label={label}
                  disabled={
                    mutation.isPending ||
                    stale ||
                    to < 0 ||
                    to >= ordered.length ||
                    to === index
                  }
                  onClick={() => move(index, to)}
                >
                  <Icon className="size-4" aria-hidden="true" />
                </Button>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </SplitModal>
  );
}
