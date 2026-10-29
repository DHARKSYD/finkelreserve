import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useWishlist } from "@/lib/store";
import { useProducts } from "@/lib/queries/products";
import { ProductCard } from "@/components/ProductCard";

export const Route = createFileRoute("/account/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — My Account" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { ids } = useWishlist();
  const { data: products = [], isLoading } = useProducts();
  const items = products.filter((p) => ids.includes(p.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-bold text-lg">
          Wishlist{" "}
          <span className="text-muted-foreground font-normal text-sm">({items.length})</span>
        </h2>
      </div>

      {isLoading ? (
        <div className="glass rounded-2xl p-8 text-center text-muted-foreground text-sm">
          Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="glass rounded-2xl p-10 text-center">
          <Heart className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold mb-1">Nothing saved yet</p>
          <p className="text-sm text-muted-foreground mb-5">
            Tap the heart on any product to save it here.
          </p>
          <Link
            to="/shop"
            className="inline-block rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold"
          >
            Browse drops
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
