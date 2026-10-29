import { Link } from "@tanstack/react-router";
import { Heart, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { useWishlist, useCart, productToCart } from "@/lib/store";
import type { Product } from "@/lib/products";
import { formatNGN } from "@/lib/currency";

const badgeColor: Record<string, string> = {
  new: "bg-primary text-primary-foreground",
  hot: "bg-accent text-accent-foreground",
  limited: "bg-foreground text-background",
  sale: "bg-destructive text-destructive-foreground",
};

export function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const wish = useWishlist();
  const cart = useCart();
  const liked = wish.has(product.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="group relative"
    >
      <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-surface-2">
          <div className="absolute inset-0 bg-gradient-to-br from-surface to-background" />
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="relative h-full w-full object-cover transition-all duration-700 group-hover:scale-110 group-hover:rotate-1"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition" />

          {product.badge && (
            <span
              className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeColor[product.badge]}`}
            >
              {product.badge}
            </span>
          )}

          <button
            onClick={(e) => {
              e.preventDefault();
              wish.toggle(product.id);
            }}
            className={`absolute top-3 right-3 grid h-9 w-9 place-items-center rounded-full glass transition ${
              liked ? "text-primary" : "hover:text-primary"
            }`}
            aria-label="Wishlist"
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              cart.add(productToCart(product, product.bottleSizes[0] ?? "750ml"));
            }}
            className="absolute bottom-3 left-3 right-3 translate-y-12 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-500 py-3 rounded-full bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 hover:shadow-glow"
          >
            <Plus className="h-4 w-4" /> Quick add
          </button>
        </div>

        <div className="pt-4 px-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {product.producer}
          </p>
          <h3 className="mt-1 font-display font-bold text-base leading-snug truncate">
            {product.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground leading-snug line-clamp-2 min-h-[2.25rem]">
            {product.description}
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display font-black text-lg">{formatNGN(product.price)}</span>
            {product.oldPrice && (
              <span className="text-xs text-muted-foreground line-through">
                {formatNGN(product.oldPrice)}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
