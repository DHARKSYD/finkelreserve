import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useOrderRefunds, useRequestRefund, type AdminPayment } from "@/lib/queries/payments";
import { formatNGN } from "@/lib/currency";

export function RefundDialog({
  payment,
  onOpenChange,
}: {
  payment: AdminPayment | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [type, setType] = useState<"full" | "partial">("full");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");

  const { data: history = [] } = useOrderRefunds(payment?.orderId ?? null);
  const refund = useRequestRefund();

  useEffect(() => {
    if (payment) {
      setType("full");
      setAmount(payment.refundable.toFixed(2));
      setReason("");
    }
  }, [payment]);

  if (!payment) return null;

  const parsedAmount = type === "full" ? payment.refundable : Number(amount);
  const isValidAmount =
    Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= payment.refundable + 0.01;

  const handleConfirm = () => {
    refund.mutate(
      {
        orderId: payment.orderId,
        amount: type === "full" ? undefined : parsedAmount,
        reason: reason.trim() || undefined,
      },
      {
        onSuccess: (result) => {
          if (!result.ok) {
            toast.error(result.error);
            return;
          }
          toast.success(
            result.status === "pending"
              ? "Refund submitted — Paystack is processing it."
              : result.status === "failed"
                ? "Paystack could not process this refund."
                : "Refund recorded.",
          );
          onOpenChange(false);
        },
        onError: () => toast.error("Could not submit the refund."),
      },
    );
  };

  return (
    <Dialog open={!!payment} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display font-bold">Refund order</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-surface-2/60 px-3 py-2.5 text-xs space-y-1">
            <p className="font-semibold">{payment.customerName}</p>
            <p className="text-muted-foreground">
              Total {formatNGN(payment.total)}
              {payment.refundedAmount > 0 &&
                ` · ${formatNGN(payment.refundedAmount)} already refunded`}{" "}
              · {formatNGN(payment.refundable)} refundable
            </p>
            <p className="text-muted-foreground">
              {payment.paymentMethod === "paystack"
                ? "Paid online — refund goes through Paystack automatically."
                : "Paid on delivery — this only records that a cash refund was given; nothing is charged or transferred automatically."}
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setType("full")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold border-2 ${type === "full" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              Full refund
            </button>
            <button
              onClick={() => setType("partial")}
              className={`flex-1 rounded-lg py-2 text-xs font-bold border-2 ${type === "partial" ? "border-primary bg-primary/5" : "border-border"}`}
            >
              Partial refund
            </button>
          </div>

          {type === "partial" && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Amount (₦)</label>
              <input
                type="number"
                min={0}
                max={payment.refundable}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              {!isValidAmount && amount !== "" && (
                <p className="text-[11px] text-destructive mt-1">
                  Must be between ₦0 and {formatNGN(payment.refundable)}.
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground">Reason (optional)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg bg-surface-2 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 resize-none"
              placeholder="e.g. customer requested a different size"
            />
          </div>

          {history.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Refund history
              </p>
              <div className="space-y-1.5">
                {history.map((r) => (
                  <div key={r.id} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {new Date(r.createdAt).toLocaleDateString("en-NG", { dateStyle: "medium" })} ·{" "}
                      {r.method === "paystack" ? "Paystack" : "Manual"}
                    </span>
                    <span
                      className={
                        r.status === "processed"
                          ? "text-primary font-semibold"
                          : r.status === "failed"
                            ? "text-destructive"
                            : "text-amber-500"
                      }
                    >
                      {formatNGN(r.amount)} · {r.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            onClick={handleConfirm}
            disabled={!isValidAmount || refund.isPending}
            className="rounded-full bg-destructive text-destructive-foreground px-5 py-2.5 text-sm font-bold w-full disabled:opacity-50"
          >
            {refund.isPending ? "Processing…" : `Refund ${formatNGN(parsedAmount || 0)}`}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
