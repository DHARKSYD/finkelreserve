import { useState } from "react";
import { sizeWithUnit } from "@/lib/box";
import { toast } from "sonner";
import { Paperclip, Video, X as XIcon, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { formatNGN } from "@/lib/currency";
import { useRequestReturn, formatReturnWindow } from "@/lib/queries/returns";
import {
  useUploadReturnEvidence,
  validateEvidenceFile,
  MAX_FILES,
} from "@/lib/queries/return-evidence";
import { useAuth } from "@/hooks/use-auth";
import type { Order } from "@/lib/queries/orders";

const REASONS = ["Broken bottle(s)", "Damaged box/packaging", "Wrong item received", "Other"];

type PendingFile = { file: File; previewUrl: string };

export function RequestReturnDialog({
  open,
  onOpenChange,
  order,
  alreadyReturnedByItem,
  returnWindowDays,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: Order;
  /** orderItemId -> quantity already covered by a non-rejected return, so this dialog can't let someone request more than what's actually left. */
  alreadyReturnedByItem: Record<string, number>;
  returnWindowDays: number;
}) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const requestReturn = useRequestReturn();
  const uploadEvidence = useUploadReturnEvidence();

  const setQty = (itemId: string, qty: number, max: number) =>
    setQuantities((q) => ({ ...q, [itemId]: Math.max(0, Math.min(max, qty)) }));

  const selectedItems = order.items
    .map((item) => ({ item, qty: quantities[item.id] ?? 0 }))
    .filter((x) => x.qty > 0);

  const refundEstimate = selectedItems.reduce((sum, { item, qty }) => sum + item.price * qty, 0);

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const room = MAX_FILES - pendingFiles.length;
    if (room <= 0) {
      toast.error(`You can attach up to ${MAX_FILES} files.`);
      return;
    }
    const accepted: PendingFile[] = [];
    for (const file of incoming.slice(0, room)) {
      const err = validateEvidenceFile(file);
      if (err) {
        toast.error(err);
        continue;
      }
      accepted.push({ file, previewUrl: URL.createObjectURL(file) });
    }
    setPendingFiles((p) => [...p, ...accepted]);
  };

  const removeFile = (i: number) => {
    setPendingFiles((p) => {
      URL.revokeObjectURL(p[i].previewUrl);
      return p.filter((_, idx) => idx !== i);
    });
  };

  const reset = () => {
    pendingFiles.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setQuantities({});
    setNote("");
    setReason(REASONS[0]);
    setPendingFiles([]);
  };

  const handleSubmit = async () => {
    if (selectedItems.length === 0) return toast.error("Select at least one item to return.");
    if (!user) return toast.error("Please sign in again to continue.");

    let evidencePaths: string[] = [];
    if (pendingFiles.length > 0) {
      setUploading(true);
      try {
        evidencePaths = await Promise.all(
          pendingFiles.map((p) => uploadEvidence.mutateAsync({ userId: user.id, file: p.file })),
        );
      } catch (e) {
        setUploading(false);
        toast.error(e instanceof Error ? e.message : "Could not upload one of your files.");
        return;
      }
      setUploading(false);
    }

    requestReturn.mutate(
      {
        orderId: order.id,
        reason,
        customerNote: note,
        items: selectedItems.map(({ item, qty }) => ({ orderItemId: item.id, quantity: qty })),
        evidencePaths,
      },
      {
        onSuccess: () => {
          toast.success("Return requested — we'll review it shortly.");
          onOpenChange(false);
          reset();
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : "Could not submit this return request."),
      },
    );
  };

  const busy = uploading || requestReturn.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="glass border-border max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Request a Return</DialogTitle>
          <DialogDescription>Order #{order.id.slice(0, 8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-muted-foreground">
          Report broken bottles or damaged packaging within{" "}
          <strong className="text-foreground">{formatReturnWindow(returnWindowDays)}</strong> of
          delivery. A photo or short video of the damage helps us process this faster.
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-2 block">
              Which items?
            </label>
            <div className="space-y-2">
              {order.items.map((item) => {
                const alreadyReturned = alreadyReturnedByItem[item.id] ?? 0;
                const maxReturnable = item.qty - alreadyReturned;
                if (maxReturnable <= 0) return null;
                const qty = quantities[item.id] ?? 0;

                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {sizeWithUnit(item.size, item.unit, item.bottlesPerUnit)} ·{" "}
                        {formatNGN(item.price)} each
                        {alreadyReturned > 0 && ` · ${alreadyReturned} already in a return`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setQty(item.id, qty - 1, maxReturnable)}
                        disabled={qty === 0}
                        className="h-7 w-7 rounded-md bg-background text-sm font-bold disabled:opacity-40"
                      >
                        −
                      </button>
                      <span className="text-sm font-semibold w-5 text-center">{qty}</span>
                      <button
                        onClick={() => setQty(item.id, qty + 1, maxReturnable)}
                        disabled={qty >= maxReturnable}
                        className="h-7 w-7 rounded-md bg-background text-sm font-bold disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              What happened? (optional, but helps us process this faster)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. the box arrived crushed and one bottle was cracked"
              className="w-full bg-input rounded-lg px-4 py-2.5 text-sm outline-none focus:ring-2 ring-primary resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">
              Photo or video (optional, up to {MAX_FILES})
            </label>
            {pendingFiles.length > 0 && (
              <div className="grid grid-cols-4 gap-2 mb-2">
                {pendingFiles.map((p, i) => (
                  <div
                    key={i}
                    className="relative aspect-square rounded-lg overflow-hidden bg-surface-2"
                  >
                    {p.file.type.startsWith("video/") ? (
                      <div className="h-full w-full grid place-items-center">
                        <Video className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ) : (
                      <img src={p.previewUrl} alt="" className="h-full w-full object-cover" />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      disabled={busy}
                      className="absolute top-1 right-1 h-5 w-5 grid place-items-center rounded-full bg-background/90"
                    >
                      <XIcon className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pendingFiles.length < MAX_FILES && (
              <label className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border py-3 text-xs text-muted-foreground cursor-pointer hover:border-primary hover:text-primary transition">
                <Paperclip className="h-3.5 w-3.5" />
                Attach photo or video
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                  multiple
                  className="hidden"
                  disabled={busy}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {selectedItems.length > 0 && (
            <div className="flex justify-between text-sm font-semibold rounded-lg bg-primary/5 px-3 py-2.5">
              <span>Estimated refund</span>
              <span>{formatNGN(refundEstimate)}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => onOpenChange(false)}
            disabled={busy}
            className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || selectedItems.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading ? "Uploading…" : requestReturn.isPending ? "Submitting…" : "Submit Request"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
