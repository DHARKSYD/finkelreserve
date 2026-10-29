import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useWishlist } from "@/lib/store";
import { useProducts } from "@/lib/queries/products";
import { Heart } from "lucide-react";

export const Route = createFileRoute("/wishlist")({
  head: () => ({ meta: [{ title: "Wishlist — Finkel Reserve" }] }),
  component: WishlistPage,
});

function WishlistPage() {
  const { ids } = useWishlist();
  const { data: products = [], isLoading } = useProducts();
  const items = products.filter((p) => ids.includes(p.id));

  return (
    <Layout>
      <div className="pt-32" />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Saved</p>
        <h1 className="mt-2 font-display font-black text-5xl md:text-6xl tracking-tighter">
          Your Wishlist
        </h1>
        <p className="mt-3 text-muted-foreground">
          {items.length} item{items.length !== 1 && "s"} saved.
        </p>

        {isLoading ? (
          <div className="mt-16 text-center text-muted-foreground">Loading…</div>
        ) : items.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-20 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-surface-2 grid place-items-center mb-5">
              <Heart className="h-9 w-9 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Tap the heart on any product to save it here.</p>
            <Link
              to="/shop"
              className="mt-6 inline-block rounded-full bg-primary text-primary-foreground px-7 py-3 font-bold"
            >
              Browse drops
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {items.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
