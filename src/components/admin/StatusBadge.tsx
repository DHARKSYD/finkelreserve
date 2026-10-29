const TONES = {
  neutral: "bg-surface-2 text-muted-foreground",
  success: "bg-primary/10 text-primary",
  warning: "bg-amber-500/15 text-amber-400",
  danger: "bg-destructive/15 text-destructive",
} as const;

export type StatusTone = keyof typeof TONES;

// Central place mapping each order/payment status to how it should read —
// change the color story once here instead of in every table that shows a
// status.
const ORDER_STATUS_TONE: Record<string, StatusTone> = {
  pending: "neutral",
  processing: "warning",
  shipped: "success",
  delivered: "success",
  cancelled: "danger",
};

const PAYMENT_STATUS_TONE: Record<string, StatusTone> = {
  pending: "neutral",
  paid: "success",
  failed: "danger",
  refunded: "warning",
  partially_refunded: "warning",
};

const RETURN_STATUS_TONE: Record<string, StatusTone> = {
  requested: "neutral",
  under_review: "warning",
  approved: "success",
  rejected: "danger",
  item_received: "warning",
  refund_initiated: "warning",
  completed: "success",
};

export function StatusBadge({
  label,
  tone = "neutral",
  className = "",
}: {
  label: string;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex text-[11px] font-bold px-2.5 py-1 rounded-full capitalize whitespace-nowrap ${TONES[tone]} ${className}`}
    >
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  return <StatusBadge label={status} tone={ORDER_STATUS_TONE[status] ?? "neutral"} />;
}

export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge label={status.replace("_", " ")} tone={PAYMENT_STATUS_TONE[status] ?? "neutral"} />
  );
}

export function ReturnStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge label={status.replace("_", " ")} tone={RETURN_STATUS_TONE[status] ?? "neutral"} />
  );
}
