import { useEffect, useRef, useState } from "react";
import { sizeWithUnit } from "@/lib/box";
import { toast } from "sonner";
import { Camera, Play, X as XIcon, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
  evidenceKind,
  formatFileSize,
  uploadEvidenceFile,
  validateEvidenceFile,
  MAX_FILES,
} from "@/lib/queries/return-evidence";
import { useAuth } from "@/hooks/use-auth";
import type { Order } from "@/lib/queries/orders";

const REASONS = ["Broken bottle(s)", "Damaged box/packaging", "Wrong item received", "Other"];
// For these the customer is reporting damage, so photos/video really do help — we say so.
const DAMAGE_REASONS = new Set(["Broken bottle(s)", "Damaged box/packaging"]);

// One photo/video the customer has picked. It moves ready → uploading → done (or error); a failed
// upload keeps its place so "Submit" retries only what's left, never re-uploading finished files.
type PendingFile = {
  id: string;
  file: File;
  previewUrl: string;
  kind: "image" | "video";
  status: "ready" | "uploading" | "done" | "error";
  progress: number; // 0..1
  path?: string; // storage path once uploaded
  error?: string;
};

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
  const [files, setFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const { user } = useAuth();
  const requestReturn = useRequestReturn();

  // Release the browser's preview blobs when the dialog goes away.
  const filesRef = useRef<PendingFile[]>([]);
  filesRef.current = files;
  useEffect(
    () => () => {
      abortRef.current?.abort();
      filesRef.current.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    },
    [],
  );

  const setQty = (itemId: string, qty: number, max: number) =>
    setQuantities((q) => ({ ...q, [itemId]: Math.max(0, Math.min(max, qty)) }));

  const selectedItems = order.items
    .map((item) => ({ item, qty: quantities[item.id] ?? 0 }))
    .filter((x) => x.qty > 0);

  const refundEstimate = selectedItems.reduce((sum, { item, qty }) => sum + item.price * qty, 0);

  const patchFile = (id: string, patch: Partial<PendingFile>) =>
    setFiles((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));

  const addFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    setFormError(null);
    const room = MAX_FILES - files.length;
    if (room <= 0) return setFormError(`You can attach up to ${MAX_FILES} files.`);
    const accepted: PendingFile[] = [];
    let problem: string | null = null;
    for (const file of Array.from(fileList).slice(0, room)) {
      const err = validateEvidenceFile(file);
      if (err) {
        problem = err;
        continue;
      }
      accepted.push({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        kind: evidenceKind(file)!,
        status: "ready",
        progress: 0,
      });
    }
    if (fileList.length > room) {
      problem = `Only the first ${room} file${room === 1 ? "" : "s"} fit — the limit is ${MAX_FILES}.`;
    }
    if (problem) setFormError(problem);
    setFiles((fs) => [...fs, ...accepted]);
  };

  const removeFile = (id: string) => {
    setFiles((fs) => {
      const gone = fs.find((f) => f.id === id);
      if (gone) URL.revokeObjectURL(gone.previewUrl);
      return fs.filter((f) => f.id !== id);
    });
  };

  const reset = () => {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setQuantities({});
    setNote("");
    setReason(REASONS[0]);
    setFiles([]);
    setFormError(null);
  };

  // Uploads whatever isn't uploaded yet, two at a time (more would just fight for a weak
  // connection). Returns every file's storage path when ALL are done, otherwise null.
  const uploadPending = async (userId: string): Promise<string[] | null> => {
    const controller = new AbortController();
    abortRef.current = controller;
    const paths = new Map<string, string>();
    const queue: PendingFile[] = [];
    for (const f of filesRef.current) {
      if (f.status === "done" && f.path) paths.set(f.id, f.path);
      else queue.push(f);
    }

    let cancelled = false;
    const worker = async () => {
      for (let f = queue.shift(); f; f = queue.shift()) {
        patchFile(f.id, { status: "uploading", progress: 0, error: undefined });
        try {
          const path = await uploadEvidenceFile({
            userId,
            file: f.file,
            signal: controller.signal,
            onProgress: (p) => patchFile(f.id, { progress: p }),
          });
          paths.set(f.id, path);
          patchFile(f.id, { status: "done", progress: 1, path });
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") {
            cancelled = true;
            patchFile(f.id, { status: "ready", progress: 0 });
            return;
          }
          patchFile(f.id, {
            status: "error",
            error: e instanceof Error ? e.message : "Could not upload this file.",
          });
        }
      }
    };
    await Promise.all([worker(), worker()]);
    abortRef.current = null;
    if (cancelled) return null;
    return paths.size === filesRef.current.length
      ? filesRef.current.map((f) => paths.get(f.id)!)
      : null;
  };

  const handleSubmit = async () => {
    setFormError(null);
    if (selectedItems.length === 0) return setFormError("Select at least one item to return.");
    if (!user) return setFormError("Please sign in again to continue.");

    let evidencePaths: string[] = [];
    if (files.length > 0) {
      setUploading(true);
      const result = await uploadPending(user.id);
      setUploading(false);
      if (!result) {
        // Either the customer stopped the upload (no message needed) or some files failed — those
        // are marked on the files themselves, and "Submit" will retry only them.
        if (filesRef.current.some((f) => f.status === "error")) {
          setFormError(
            "Some files didn't upload. Check them below, then tap Submit again to retry.",
          );
        }
        return;
      }
      evidencePaths = result;
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
          setFormError(e instanceof Error ? e.message : "Could not submit this return request."),
      },
    );
  };

  const busy = uploading || requestReturn.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="glass border-border max-w-lg max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Request a Return</DialogTitle>
          <DialogDescription>Order #{order.id.slice(0, 8).toUpperCase()}</DialogDescription>
        </DialogHeader>

        <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2.5 text-xs text-muted-foreground">
          Report broken bottles or damaged packaging within{" "}
          <strong className="text-foreground">{formatReturnWindow(returnWindowDays)}</strong> of
          delivery. Photos or a short video of the damage help us process this faster.
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

          {/* Evidence: photos and/or video of the damage. */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <label className="text-xs font-semibold text-muted-foreground">
                Photos or video {DAMAGE_REASONS.has(reason) ? "of the damage" : "(optional)"}
              </label>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {files.length}/{MAX_FILES}
              </span>
            </div>
            {DAMAGE_REASONS.has(reason) && (
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                Strongly recommended — it lets us approve your claim faster. Show the broken bottle,
                the label and the packaging.
              </p>
            )}

            {files.length > 0 && (
              <ul className="space-y-2">
                {files.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 rounded-xl bg-surface-2/60 p-2">
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {f.kind === "video" ? (
                        <>
                          {/* #t=0.1 makes iOS show a first frame instead of a blank box */}
                          <video
                            src={`${f.previewUrl}#t=0.1`}
                            muted
                            playsInline
                            preload="metadata"
                            className="h-full w-full object-cover"
                          />
                          <span className="absolute inset-0 grid place-items-center bg-black/30">
                            <Play className="h-4 w-4 fill-white text-white" />
                          </span>
                        </>
                      ) : (
                        <img src={f.previewUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{f.file.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {f.kind === "video" ? "Video" : "Photo"} · {formatFileSize(f.file.size)}
                      </p>
                      {f.status === "uploading" && (
                        <div
                          className="mt-1.5"
                          role="progressbar"
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.round(f.progress * 100)}
                        >
                          <div className="h-1.5 overflow-hidden rounded-full bg-border">
                            <div
                              className="h-full rounded-full bg-primary transition-[width] duration-200"
                              style={{ width: `${Math.round(f.progress * 100)}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            Uploading {Math.round(f.progress * 100)}%
                          </p>
                        </div>
                      )}
                      {f.status === "done" && (
                        <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Uploaded
                        </p>
                      )}
                      {f.status === "error" && (
                        <p className="mt-1 inline-flex items-start gap-1 text-[11px] text-destructive">
                          <AlertCircle className="mt-px h-3 w-3 shrink-0" /> {f.error}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFile(f.id)}
                      disabled={busy}
                      aria-label={`Remove ${f.file.name}`}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted-foreground transition hover:bg-background hover:text-foreground disabled:opacity-40"
                    >
                      <XIcon className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {files.length < MAX_FILES && (
              <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border px-3 py-4 text-center transition focus-within:ring-2 focus-within:ring-primary hover:border-primary">
                <Camera className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold">Add photos or video</span>
                <span className="text-[11px] text-muted-foreground">
                  Take one now or choose from your gallery · JPG, PNG, WEBP, MP4, MOV, WEBM · videos
                  up to 50MB (about 30 seconds is plenty)
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm"
                  multiple
                  className="sr-only"
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

        {formError && (
          <p
            role="alert"
            className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2.5 text-xs text-destructive"
          >
            <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
            {formError}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => (uploading ? abortRef.current?.abort() : onOpenChange(false))}
            disabled={requestReturn.isPending}
            className="rounded-full bg-surface-2 px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {uploading ? "Stop upload" : "Cancel"}
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || selectedItems.length === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold disabled:opacity-60"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {uploading
              ? "Uploading…"
              : requestReturn.isPending
                ? "Submitting…"
                : files.some((f) => f.status === "error")
                  ? "Retry & submit"
                  : "Submit Request"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
