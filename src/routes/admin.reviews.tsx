import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Star, Trash2 } from "lucide-react";
import { useAdminReviews, useAdminDeleteReview } from "@/lib/queries/reviews";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";

export const Route = createFileRoute("/admin/reviews")({
  head: () => ({ meta: [{ title: "Reviews — Admin" }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  const { data: reviews = [], isLoading } = useAdminReviews();
  const del = useAdminDeleteReview();
  const [target, setTarget] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tighter">Reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {reviews.length} review{reviews.length !== 1 && "s"}
        </p>
      </div>

      <div className="overflow-x-auto glass rounded-2xl">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-[0.15em] text-muted-foreground border-b border-border">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Reviewer</th>
              <th className="px-4 py-3">Rating</th>
              <th className="px-4 py-3">Review</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  Loading…
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No reviews yet.
                </td>
              </tr>
            ) : (
              reviews.map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="px-4 py-3 font-semibold max-w-[160px] truncate">
                    {r.productName}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{r.name}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-0.5 text-primary">
                      {Array.from({ length: 5 }).map((_, k) => (
                        <Star
                          key={k}
                          className={`h-3.5 w-3.5 ${k < r.rating ? "fill-current" : ""}`}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground max-w-[320px] truncate">
                    {r.text}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setTarget(r.id)}
                      className="h-8 w-8 grid place-items-center rounded-lg bg-surface-2 hover:bg-destructive hover:text-destructive-foreground ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title="Delete this review?"
        description="The product's average rating and review count update automatically. This can't be undone."
        confirmLabel="Delete review"
        loading={del.isPending}
        onConfirm={() => {
          if (!target) return;
          del.mutate(target, {
            onSuccess: () => toast.success("Review deleted."),
            onError: () => toast.error("Could not delete the review."),
            onSettled: () => setTarget(null),
          });
        }}
      />
    </div>
  );
}
