import { createFileRoute, Link } from "@tanstack/react-router";
import { RotateCcw, Video } from "lucide-react";
import { useMyReturns } from "@/lib/queries/returns";
import { useEvidenceUrls, isVideoPath } from "@/lib/queries/return-evidence";
import { formatNGN } from "@/lib/currency";
import { ReturnStatusBadge } from "@/components/admin/StatusBadge";

export const Route = createFileRoute("/account/returns")({
  head: () => ({ meta: [{ title: "Returns — My Account" }] }),
  component: ReturnsPage,
});

function ReturnsPage() {
  const { data: returns = [], isLoading } = useMyReturns();

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
            <div key={r.id} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div>
                  <p className="text-sm font-semibold">
                    Order #{r.orderId.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Requested {new Date(r.createdAt).toLocaleDateString("en-NG")}
                  </p>
                </div>
                <ReturnStatusBadge status={r.status} />
              </div>
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
