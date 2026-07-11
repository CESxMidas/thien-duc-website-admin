import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SplitModal } from "@/components/ui/SplitModal";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateLead } from "@/lib/api/queries";
import { resolveApiError } from "@/lib/api-error-message";
import { formatDateTime, leadStatusLabel, leadStatusTone } from "@/lib/labels";
import type { Lead, LeadStatus } from "@/types";

const statusOptions = Object.keys(leadStatusLabel) as LeadStatus[];

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-brand">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function LeadDetailDialog({
  lead,
  onClose,
}: {
  lead: Lead | null;
  onClose: () => void;
}) {
  const updateLead = useUpdateLead();
  const [status, setStatus] = useState<LeadStatus>("NEW");
  const [note, setNote] = useState("");

  // Mỗi lần mở một lead khác phải nạp lại đúng dữ liệu của lead đó, nếu không
  // ghi chú của lead trước sẽ còn nguyên trong ô và bị lưu nhầm sang lead này.
  useEffect(() => {
    if (lead) {
      setStatus(lead.status);
      setNote(lead.internalNote ?? "");
    }
  }, [lead]);

  if (!lead) return null;

  const dirty = status !== lead.status || note !== (lead.internalNote ?? "");

  async function handleSave() {
    if (!lead) return;
    try {
      await updateLead.mutateAsync({
        id: lead.id,
        data: { status, internalNote: note },
      });
      toast.success("Đã lưu thay đổi.");
      onClose();
    } catch (error) {
      toast.error(resolveApiError(error, "Không lưu được thay đổi."));
    }
  }

  return (
    <SplitModal
      open
      onOpenChange={(open) => !open && onClose()}
      title={lead.name}
      description="Liên hệ gửi từ form website. Thời gian theo giờ Việt Nam."
      media={
        <dl className="grid gap-4">
          <Field
            label="Điện thoại"
            value={
              <a href={`tel:${lead.phone}`} className="text-brand underline">
                {lead.phone}
              </a>
            }
          />
          <Field
            label="Email"
            value={
              lead.email ? (
                <a href={`mailto:${lead.email}`} className="text-brand underline">
                  {lead.email}
                </a>
              ) : (
                <span className="text-slate">Không cung cấp</span>
              )
            }
          />
          <Field
            label="Nhu cầu"
            value={lead.inquiryType ?? <span className="text-slate">—</span>}
          />
          <Field label="Thời gian gửi" value={formatDateTime(lead.createdAt)} />
          <Field
            label="Trạng thái hiện tại"
            value={
              <Badge variant={leadStatusTone[lead.status]}>
                {leadStatusLabel[lead.status]}
              </Badge>
            }
          />
          <Field
            label="Nội dung"
            value={
              <p className="whitespace-pre-wrap rounded-lg bg-white p-3 leading-6">
                {lead.message}
              </p>
            }
          />
        </dl>
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={updateLead.isPending}
          >
            Đóng
          </Button>
          <Button
            onClick={() => void handleSave()}
            disabled={!dirty || updateLead.isPending}
          >
            {updateLead.isPending && <Loader2 className="size-4 animate-spin" />}
            Lưu thay đổi
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="lead-status">Chuyển trạng thái</Label>
          <Select
            value={status}
            onValueChange={(value) => setStatus(value as LeadStatus)}
          >
            <SelectTrigger id="lead-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {leadStatusLabel[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="lead-note">Ghi chú nội bộ</Label>
          <Textarea
            id="lead-note"
            rows={6}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Đã gọi lúc 14h, khách hẹn xem nhà mẫu cuối tuần."
          />
          <p className="text-xs text-slate">
            Chỉ hiển thị trong CMS, không xuất hiện trên website.
          </p>
        </div>
      </div>
    </SplitModal>
  );
}
