import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Clock, RotateCcw, Video } from "lucide-react";
import {
  useMyReturns,
  useMyReturnRefunds,
  type ReturnRefund,
  type ReturnStatus,
} from "@/lib/queries/returns";
import { useEvidenceUrls, isVideoPath } from "@/lib/queries/return-evidence";
import { formatNGN } from "@/lib/currency";
import { ReturnStatusBadge } from "@/components/admin/StatusBadge";

export const Route = createFileRoute("/account/returns")({
  head: () => ({ meta: [{ title: "Returns — My Account" }] }),
  component: ReturnsPage,
});

// Where a return is in its life, in the customer's words.
const STEPS = ["Requested", "In review", "Approved", "Item received", "Refund", "Done"] as const;
const STEP_INDEX: Record<ReturnStatus, number> = {
  requested: 0,
  under_review: 1,
  approved: 2,
  item_received: 3,
  refund_initiated: 4,
  completed: 5,
  rejected: -1,
};
const STATUS_TEXT: Record<ReturnStatus, string> = {
  requested: "We've received your request and will review it shortly.",
  under_review: "We're looking at your request and any photos or video you sent.",
  approved: "Approved. We'll be in touch about getting the item back to us.",
  item_received: "We have the item and are getting your refund ready.",
  refund_initiated: "Your refund has been started.",
  completed: "All done — your refund is complete.",
  rejected: "We couldn't approve this request. See our note below.",
};

function ReturnsPage() {
  const { data: returns = [], isLoading } = useMyReturns();
  const { data: refunds = [] } = useMyReturnRefunds();

  return (
    <div className="space-y-6">
      <h2 className="font-display font-bold text-lg">Returns</h2>

      {isLoading && (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      )}

      {!isLoading && returns.length === 0 && (
        <div className="glass rounded-2xl p-10 text-center">
          <RotateCcw className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold mb-1">No return requests</p>
          <p className="text-sm text-muted-foreground mb-5">
            Eligible orders show a "Request Return" option from your order history.
          </p>
          <Link
            to="/account/orders"
            className="inline-block rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
          >
            View Orders
          </Link>
        </div>
      )}

      {!isLoading && returns.length > 0 && (
        <div className="space-y-3">
          {returns.map((r) => (
            <div key={r.id} className="glass min-w-0 rounded-2xl p-4 sm:p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    Order #{r.orderId.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(r.createdAt).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <ReturnStatusBadge status={r.status} />
              </div>
              <ProgressSteps status={r.status} />
              <p className="mt-1 mb-3 text-xs text-muted-foreground">{STATUS_TEXT[r.status]}</p>
              <div className="space-y-1 mb-2">
                {r.items.map((item) => (
                  <p key={item.id} className="text-xs text-muted-foreground">
                    {item.quantity}× {item.productName}
                    {item.size && ` (${item.size})`}
                  </p>
                ))}
              </div>
              <div className="flex items-center justify-between text-sm pt-2 border-t border-border/60">
                <span className="text-muted-foreground">{r.reason}</span>
                <span className="font-semibold">{formatNGN(r.refundTotal)}</span>
              </div>
              {r.evidencePaths.length > 0 && <EvidenceThumbs paths={r.evidencePaths} />}
              {refunds
                .filter((f) => f.returnRequestId === r.id)
                .map((f, i) => (
                  <RefundStatus key={i} refund={f} />
                ))}
              {r.adminNote && (
                <p className="text-xs text-muted-foreground mt-2 italic">Note: {r.adminNote}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProgressSteps({ status }: { status: ReturnStatus }) {
  const current = STEP_INDEX[status];
  if (current < 0) return null; // rejected: no progress to show
  return (
    <div className="mt-3">
      <ol className="flex items-center gap-1" aria-label="Return progress">
        {STEPS.map((label, i) => (
          <li key={label} className="flex-1" aria-current={i === current ? "step" : undefined}>
            <span
              className={`block h-1.5 rounded-full ${i <= current ? "bg-primary" : "bg-border"}`}
            />
          </li>
        ))}
      </ol>
      <p className="mt-1.5 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">{STEPS[current]}</span> · step {current + 1}{" "}
        of {STEPS.length}
      </p>
    </div>
  );
}

// What happened to the money, in plain words. Paystack's own wording for the wait:
// once a refund is "processed" it can still take up to 10 business days to reach the customer.
function RefundStatus({ refund }: { refund: ReturnRefund }) {
  const amount = formatNGN(refund.amount);
  let tone: "ok" | "wait" | "warn" = "wait";
  let title: string;
  let detail: string | null = null;

  if (refund.status === "processed") {
    tone = "ok";
    if (refund.method === "manual") {
      title = `${amount} refunded`;
      detail = "Confirmed by our team.";
    } else {
      title = `${amount} sent back to you via Paystack`;
      detail = "It can take up to 10 business days to show in your account.";
    }
  } else if (refund.status === "failed") {
    tone = "warn";
    title = `We couldn't send your ${amount} refund automatically`;
    detail = "Our team will contact you to sort it out.";
  } else if (refund.gatewayStatus === "needs-attention") {
    tone = "warn";
    title = `We need your bank details to send your ${amount} refund`;
    detail = "Please contact us with your account number and bank name.";
  } else {
    title = `Your ${amount} refund is being processed`;
    detail = refund.method === "paystack" ? "Paystack is sending it back to you." : null;
  }

  const Icon = tone === "ok" ? CheckCircle2 : tone === "warn" ? AlertTriangle : Clock;
  const colour =
    tone === "ok"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-primary";

  return (
    <div className="mt-3 flex gap-3 rounded-xl bg-surface-2/60 p-3" role="status">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${colour}`} aria-hidden="true" />
      <div className="min-w-0 text-xs">
        <p className="font-semibold">{title}</p>
        {detail && <p className="mt-0.5 text-muted-foreground">{detail}</p>}
        {refund.gatewayStatus === "needs-attention" && refund.status === "pending" && (
          <Link to="/contact" className="mt-1.5 inline-block font-semibold text-primary underline">
            Contact us
          </Link>
        )}
      </div>
    </div>
  );
}

function EvidenceThumbs({ paths }: { paths: string[] }) {
  const { data: urls = {} } = useEvidenceUrls(paths);
  return (
    <div className="flex gap-1.5 mt-2">
      {paths.map((path) => {
        const url = urls[path];
        if (!url) return null;
        return isVideoPath(path) ? (
          <a
            key={path}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 w-10 rounded-md bg-surface-2 grid place-items-center shrink-0"
          >
            <Video className="h-3.5 w-3.5 text-muted-foreground" />
          </a>
        ) : (
          <a
            key={path}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 w-10 rounded-md overflow-hidden bg-surface-2 shrink-0"
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </a>
        );
      })}
    </div>
  );
}
