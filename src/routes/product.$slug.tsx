import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  Minus,
  Plus,
  ShieldCheck,
  Truck,
  Repeat,
  Star,
  ChevronRight,
  Check,
  Pencil,
  Trash2,
  LogIn,
  Package,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { WineProfile } from "@/components/WineProfile";
import { ProductCard } from "@/components/ProductCard";
import { useProduct, useProducts } from "@/lib/queries/products";
import { useProductVariants } from "@/lib/queries/variants";
import { MAX_LINE_QTY, boxPricing, type PurchaseUnit } from "@/lib/box";
import { supabase } from "@/integrations/supabase/client";
import { SITE_URL } from "@/lib/config";
import {
  useProductReviews,
  useSubmitReview,
  useCanReviewProduct,
  useUpdateReview,
  useDeleteReview,
} from "@/lib/queries/reviews";
import { useCart, useWishlist, productToCart } from "@/lib/store";
import { formatReturnWindow } from "@/lib/queries/returns";
import { useAuth } from "@/hooks/use-auth";
import { formatNGN } from "@/lib/currency";
import { productTypeLabel } from "@/lib/products";
import { getPublicShippingSummary } from "@/lib/actions/shipping";
import { useSettings } from "@/lib/queries/settings";

export const Route = createFileRoute("/product/$slug")({
  // Light fetch: only the fields head() needs. The component continues to use
  // useProduct(slug) which fetches the full product independently.
  // Using a direct supabase query (not queryClient.ensureQueryData) because
  // this project does not have <DehydrateRouter> for cache hydration — a
  // direct fetch is simpler and works identically in both SSR and client
  // navigation contexts.
  loader: async ({ params }) => {
    // store_settings isn't in generated types.ts yet (documented types.ts
    // gap — see the audit doc), hence the cast on that one query below.
    const settingsDb = supabase as unknown as {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- documented types.ts gap above
      from: (table: "store_settings") => any;
    };
    const [{ data }, { data: settingsRow }] = await Promise.all([
      supabase
        .from("products")
        .select(
          "name, slug, description, images, producer, price, stock, seo_title, seo_description",
        )
        .eq("slug", params.slug)
        .eq("active", true)
        .maybeSingle(),
      settingsDb.from("store_settings").select("store_name").eq("id", true).maybeSingle(),
    ]);

    if (!data) throw notFound();

    return {
      name: data.name,
      slug: data.slug,
      description: data.description,
      images: data.images as string[] | null,
      producer: data.producer,
      price: Number(data.price),
      stock: data.stock,
      seoTitle: data.seo_title ?? undefined,
      seoDescription: data.seo_description ?? undefined,
      storeName: (settingsRow?.store_name as string | undefined) ?? "Finkel Reserve",
    };
  },

  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Product — Finkel Reserve" }] };

    const p = loaderData;
    const title = p.seoTitle ?? `${p.name} | ${p.storeName}`;
    const description =
      p.seoDescription ??
      (p.description
        ? p.description.slice(0, 160)
        : `Shop the ${p.name} at ${p.storeName} — fine drinks delivered across Nigeria.`);
    const canonicalUrl = `${SITE_URL}/product/${p.slug}`;
    const image = p.images?.[0];
    const inStock = (p.stock ?? 1) > 0;

    const ldJson = {
      "@context": "https://schema.org/",
      "@type": "Product",
      name: p.name,
      ...(image ? { image: [image] } : {}),
      description,
      brand: { "@type": "Brand", name: p.producer },
      offers: {
        "@type": "Offer",
        url: canonicalUrl,
        priceCurrency: "NGN",
        price: p.price.toString(),
        availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        seller: { "@type": "Organization", name: p.storeName },
      },
    };

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "product" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: canonicalUrl },
        { property: "og:site_name", content: p.storeName },
        ...(image ? [{ property: "og:image", content: image }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        ...(image ? [{ name: "twitter:image", content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonicalUrl }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify(ldJson),
        },
      ],
    };
  },

  // Proper 404 component — renders when the loader throws notFound()
  notFoundComponent: () => (
    <Layout>
      <div className="pt-40 text-center px-6">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono mb-3">404</p>
        <h1 className="font-display font-black text-5xl tracking-tighter mb-4">
          Product not found
        </h1>
        <p className="text-muted-foreground mb-8">
          This product may have sold out or been discontinued.
        </p>
        <Link
          to="/shop"
          className="inline-block rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold hover:shadow-glow transition"
        >
          Back to shop
        </Link>
      </div>
    </Layout>
  ),

  component: ProductPage,
});

function ProductPage() {
  const { slug } = Route.useParams();
  const { data: product, isLoading } = useProduct(slug);

  if (isLoading) {
    return (
      <Layout>
        <div className="pt-40 text-center text-muted-foreground">Loading…</div>
      </Layout>
    );
  }

  // If we reach here, the loader confirmed the product exists and populated
  // the TanStack Query cache — useProduct() will return immediately from cache.
  return <ProductDetail slug={slug} productId={product!.id} />;
}

// Split so hooks below can rely on a stable, non-optional product id.
function ProductDetail({ slug, productId }: { slug: string; productId: string }) {
  const { data: product } = useProduct(slug);
  const { data: allProducts = [] } = useProducts();
  const { user } = useAuth();
  const { data: reviews = [] } = useProductReviews(productId);
  const submitReview = useSubmitReview(productId);
  const { data: canReview, isLoading: checkingEligibility } = useCanReviewProduct(
    productId,
    user?.id,
  );
  const updateReview = useUpdateReview(productId);
  const deleteReview = useDeleteReview(productId);

  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState<string>("");
  const [unit, setUnit] = useState<PurchaseUnit>("bottle");
  const [qty, setQty] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [added, setAdded] = useState(false);
  const cart = useCart();
  const wish = useWishlist();
  // Public read (RLS: "variants readable by all"). Gives per-size stock, which the
  // product row alone doesn't carry (box size and discount ARE on the product).
  const { data: variants = [] } = useProductVariants(productId);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewSort, setReviewSort] = useState<"recent" | "rating">("recent");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Same query key as shipping-policy.tsx — shares its cache, and both pages
  // now read the one live source (whatever's set in /admin/shipping)
  // instead of each having their own copy of the number to drift out of
  // sync. This badge shows the best available free-shipping threshold
  // across active zones (a general trust signal, same as before); checkout
  // still prices shipping for the customer's actual state, this never did
  // that job.
  const { data: shippingSummary } = useQuery({
    queryKey: ["shipping", "public-summary"],
    queryFn: () => getPublicShippingSummary(),
    staleTime: 60_000,
  });
  const freeShippingThreshold = useMemo(() => {
    const thresholds = (shippingSummary ?? [])
      .flatMap((zone) => zone.rates)
      .map((rate) => rate.freeShippingThresholdNgn)
      .filter((t): t is number => t != null);
    return thresholds.length > 0 ? Math.min(...thresholds) : null;
  }, [shippingSummary]);
  // Store Settings → Returns is the source of truth an admin can change,
  // rather than a hardcoded window here.
  const { data: settings } = useSettings();
  const returnWindowDays = settings?.returnWindowDays ?? 1;

  useEffect(() => {
    if (product) {
      setSize((s) => s || product.bottleSizes[0] || "");
    }
  }, [product]);

  const ownReview = reviews.find((r) => r.userId === user?.id);
  const alreadyReviewed = !!ownReview;

  useEffect(() => {
    if (editingId && ownReview && editingId === ownReview.id) {
      setReviewRating(ownReview.rating);
      setReviewText(ownReview.text);
    }
  }, [editingId, ownReview]);

  if (!product) return null;
  const liked = wish.has(product.id);

  // ── Bottle / box purchase ─────────────────────────────────────────────
  // The product's price is always the price of ONE bottle. If the admin set a box size on the
  // product, a customer can instead buy a whole box at bottles × price less the box discount.
  // Stock is counted in bottles, so the most boxes available is floor(stock / bottles per box).
  // Until the variants load (or for a product with none) we fall back to the product-level
  // stock, and the server re-checks everything at checkout regardless.
  const perBox = product.bottlesPerBox;
  const pricing = perBox ? boxPricing(product.price, perBox, product.boxDiscountPercent) : null;
  const variant = variants.find((v) => v.size === size);
  const sizeStock = variant ? variant.stock : product.stock;
  const boxesInStock = perBox ? Math.floor(sizeStock / perBox) : 0;
  // The effective unit falls back to a bottle if a box isn't available (e.g. the selected
  // size has fewer than a box left), so the buy box never gets stuck on an impossible choice.
  const isBox = unit === "box" && perBox !== null && boxesInStock >= 1;
  const availableUnits = isBox ? boxesInStock : sizeStock;
  const maxQty = Math.max(1, Math.min(MAX_LINE_QTY, availableUnits));
  const safeQty = Math.min(qty, maxQty);
  const unitPrice = isBox ? pricing!.price : product.price;
  const unavailable = !size || sizeStock < 1;
  const addLabel = sizeStock < 1 ? "Out of stock" : null;

  const sortedReviews = [...reviews].sort((a, b) =>
    reviewSort === "rating" ? b.rating - a.rating || b.at - a.at : b.at - a.at,
  );
  const related = allProducts.filter((p) => p.id !== product.id).slice(0, 4);

  const handleAdd = () => {
    cart.add(productToCart(product, size, isBox), safeQty);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !reviewText.trim()) return;
    if (editingId) {
      updateReview.mutate(
        { id: editingId, rating: reviewRating, text: reviewText.trim() },
        { onSuccess: () => setEditingId(null) },
      );
    } else {
      submitReview.mutate(
        { userId: user.id, rating: reviewRating, text: reviewText.trim() },
        {
          onSuccess: () => {
            setReviewText("");
            setReviewRating(5);
          },
        },
      );
    }
  };

  const handleDeleteOwn = () => {
    if (!ownReview) return;
    if (confirm("Delete your review?")) {
      deleteReview.mutate(ownReview.id);
      setEditingId(null);
    }
  };

  const reviewError = submitReview.isError
    ? submitReview.error instanceof Error
      ? submitReview.error.message
      : "Couldn't post review."
    : null;

  return (
    <Layout hideFabOnMobile>
      <div className="pt-32" />
      <div className="mx-auto max-w-[1400px] px-6 md:px-10">
        <nav className="text-xs text-muted-foreground flex items-center gap-1 mb-6">
          <Link to="/" className="hover:text-foreground">
            Home
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link to="/shop" className="hover:text-foreground">
            Shop
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground">{productTypeLabel(product.productType)}</span>
        </nav>

        <div className="grid lg:grid-cols-[1fr_460px] gap-10 lg:gap-16">
          {/* GALLERY */}
          <div className="grid grid-cols-[80px_1fr] gap-4 lg:sticky lg:top-28 lg:self-start">
            <div className="flex flex-col gap-2">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square rounded-lg overflow-hidden border-2 transition ${
                    activeImg === i
                      ? "border-primary"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
            <div
              className="relative aspect-[4/5] rounded-2xl overflow-hidden bg-surface-2 cursor-zoom-in group"
              onClick={() => setZoom(true)}
            >
              <AnimatePresence mode="wait">
                <motion.img
                  key={activeImg}
                  src={product.images[activeImg]}
                  alt={product.name}
                  initial={{ opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.4 }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </AnimatePresence>
              {product.badge && (
                <span className="absolute top-4 left-4 px-3 py-1.5 rounded-full text-xs font-bold uppercase bg-primary text-primary-foreground">
                  {product.badge}
                </span>
              )}
            </div>
          </div>

          {/* DETAILS */}
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-primary font-mono">
              {product.producer}
            </p>
            <h1 className="mt-2 font-display font-black text-4xl md:text-5xl tracking-tighter leading-[0.95]">
              {product.name}
              {product.vintage && <span className="text-muted-foreground"> {product.vintage}</span>}
            </h1>

            <div className="mt-3 flex items-center gap-3">
              <div className="flex gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < Math.round(product.rating) ? "fill-current" : ""}`}
                  />
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                {product.rating.toFixed(1)} · {product.reviews} reviews
              </p>
            </div>

            <div className="mt-5 flex items-baseline gap-3">
              <span className="font-display font-black text-3xl">{formatNGN(product.price)}</span>
              {perBox !== null && <span className="text-sm text-muted-foreground">per bottle</span>}
              {product.oldPrice && (
                <>
                  <span className="text-muted-foreground line-through">
                    {formatNGN(product.oldPrice)}
                  </span>
                  <span className="text-xs font-bold text-primary">
                    SAVE {formatNGN(product.oldPrice - product.price)}
                  </span>
                </>
              )}
            </div>

            <p className="mt-6 text-foreground/90 leading-relaxed">{product.description}</p>
            {product.details && product.details !== product.description && (
              <p className="mt-3 text-muted-foreground leading-relaxed text-sm">
                {product.details}
              </p>
            )}

            {/* Highlights */}
            {product.highlights && product.highlights.length > 0 && (
              <div className="mt-6 glass rounded-2xl p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3 font-mono">
                  — Highlights
                </p>
                <ul className="space-y-2">
                  {product.highlights.map((h) => (
                    <li key={h} className="flex gap-2.5 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-foreground/85">{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Wine details — only fields the product actually has are
                shown, rather than assuming every wine has every attribute. */}
            {(product.region ||
              product.country ||
              product.grapeVariety.length > 0 ||
              product.abv != null) && (
              <div className="mt-6 glass rounded-2xl p-5">
                <p className="text-xs uppercase tracking-[0.2em] text-primary mb-3 font-mono">
                  — Details
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Type" value={productTypeLabel(product.productType)} />
                  {product.region && <DetailField label="Region" value={product.region} />}
                  {product.country && <DetailField label="Country" value={product.country} />}
                  {product.vintage && (
                    <DetailField label="Vintage" value={String(product.vintage)} />
                  )}
                  {product.grapeVariety.length > 0 && (
                    <DetailField label="Grape Variety" value={product.grapeVariety.join(", ")} />
                  )}
                  {product.abv != null && <DetailField label="ABV" value={`${product.abv}%`} />}
                </div>
              </div>
            )}

            {(product.tastingNotes || product.foodPairing) && (
              <div className="mt-6 grid sm:grid-cols-2 gap-4">
                {product.tastingNotes && (
                  <div className="glass rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-mono">
                      — Tasting Notes
                    </p>
                    <p className="text-sm text-foreground/85 leading-relaxed">
                      {product.tastingNotes}
                    </p>
                  </div>
                )}
                {product.foodPairing && (
                  <div className="glass rounded-2xl p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-2 font-mono">
                      — Food Pairing
                    </p>
                    <p className="text-sm text-foreground/85 leading-relaxed">
                      {product.foodPairing}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Bottle size */}
            {product.bottleSizes.length > 0 && (
              <div className="mt-7">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                  Bottle Size
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {product.bottleSizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSize(s);
                        setQty(1);
                      }}
                      className={`py-3 rounded-lg text-sm font-semibold border transition ${
                        size === s
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border hover:border-foreground/40"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Buy by the box */}
            {perBox !== null && pricing && (
              <section
                aria-labelledby="buy-by-box"
                className="mt-6 rounded-2xl border border-border bg-surface-2/40 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <Package className="h-4 w-4" />
                  </span>
                  <div>
                    <h3 id="buy-by-box" className="text-sm font-semibold">
                      Buy by the box
                      {pricing.saving > 0 && (
                        <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">
                          Save {pricing.percent}%
                        </span>
                      )}
                    </h3>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                      One box holds <strong className="text-foreground">{perBox} bottles</strong>
                      {size ? ` (${perBox} × ${size})` : ""} of this{" "}
                      {product.productType === "non_alcoholic" || product.productType === "mixers"
                        ? "drink"
                        : "bottle"}
                      .
                      {pricing.saving > 0
                        ? ` Buy the whole box and pay ${pricing.percent}% less than buying ${perBox} single bottles.`
                        : ""}
                    </p>
                  </div>
                </div>

                <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-background/50 px-2 py-2">
                    <dt className="text-muted-foreground">1 bottle</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums">
                      {formatNGN(product.price)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-background/50 px-2 py-2">
                    <dt className="text-muted-foreground">{perBox} single bottles</dt>
                    <dd
                      className={`mt-0.5 font-semibold tabular-nums ${
                        pricing.saving > 0 ? "text-muted-foreground line-through" : ""
                      }`}
                    >
                      {formatNGN(pricing.regular)}
                    </dd>
                  </div>
                  <div className="rounded-lg bg-primary/10 px-2 py-2">
                    <dt className="text-primary">1 box of {perBox}</dt>
                    <dd className="mt-0.5 font-bold tabular-nums">{formatNGN(pricing.price)}</dd>
                    <dd className="text-[10px] text-muted-foreground tabular-nums">
                      {formatNGN(Math.round(pricing.perBottle))} a bottle
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Buy by">
                  {(
                    [
                      { id: "bottle", title: "Single bottle", sub: formatNGN(product.price) },
                      {
                        id: "box",
                        title: `Box of ${perBox}`,
                        sub: formatNGN(pricing.price),
                      },
                    ] as const
                  ).map((o) => {
                    const disabled = o.id === "box" && boxesInStock < 1;
                    return (
                      <button
                        key={o.id}
                        role="radio"
                        aria-checked={(isBox ? "box" : "bottle") === o.id}
                        disabled={disabled}
                        onClick={() => {
                          setUnit(o.id);
                          setQty(1);
                        }}
                        className={`rounded-lg border py-3 text-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
                          (isBox ? "box" : "bottle") === o.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border hover:border-foreground/40"
                        }`}
                      >
                        <span className="block text-sm font-semibold">{o.title}</span>
                        <span className="block text-xs tabular-nums opacity-80">{o.sub}</span>
                      </button>
                    );
                  })}
                </div>
                {boxesInStock < 1 && sizeStock > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Only {sizeStock} bottle{sizeStock === 1 ? "" : "s"} of this size left — not
                    enough for a full box.
                  </p>
                )}
              </section>
            )}

            {/* Qty + Add */}
            <div className="mt-7 flex items-stretch gap-3 pb-24 lg:pb-0">
              <div className="flex items-center bg-surface-2 rounded-full px-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, Math.min(q, maxQty) - 1))}
                  className="h-10 w-10 grid place-items-center"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-8 text-center font-bold tabular-nums">{safeQty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  disabled={safeQty >= maxQty}
                  className="h-10 w-10 grid place-items-center disabled:opacity-40"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleAdd}
                disabled={unavailable}
                className="flex-1 rounded-full bg-primary text-primary-foreground font-bold hover:shadow-glow transition relative overflow-hidden disabled:opacity-50"
              >
                <AnimatePresence mode="wait">
                  <motion.span
                    key={added ? "added" : "add"}
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -20, opacity: 0 }}
                    className="block py-4"
                  >
                    {addLabel ?? (added ? "✓ Added to bag" : "Add to bag")}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              <button
                onClick={() => wish.toggle(product.id)}
                className={`h-[52px] w-[52px] grid place-items-center rounded-full border border-border ${liked ? "text-primary" : "hover:border-foreground/40"}`}
                aria-label="Wishlist"
              >
                <Heart className={`h-5 w-5 ${liked ? "fill-current" : ""}`} />
              </button>
            </div>

            {/* Mobile-only sticky total + Add to Cart. */}
            <div
              className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur border-t border-border px-4 py-3 flex items-center gap-3"
              style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
            >
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="font-display font-black text-lg leading-none truncate">
                  {formatNGN(unitPrice * safeQty)}
                </p>
              </div>
              <button
                onClick={handleAdd}
                disabled={unavailable}
                className="flex-1 min-h-[44px] rounded-full bg-primary text-primary-foreground font-bold py-3.5 disabled:opacity-50"
              >
                {addLabel ?? (added ? "✓ Added" : "Add to bag")}
              </button>
            </div>

            {/* Trust */}
            <div className="mt-8 grid grid-cols-3 gap-3">
              {[
                {
                  Icon: Truck,
                  t:
                    freeShippingThreshold != null
                      ? `Free shipping over ${formatNGN(freeShippingThreshold)}`
                      : "Same-day–next-day delivery",
                },
                { Icon: ShieldCheck, t: "Verified sourcing" },
                { Icon: Repeat, t: `${formatReturnWindow(returnWindowDays)} returns` },
              ].map(({ Icon, t }) => (
                <div
                  key={t}
                  className="glass rounded-xl p-3 flex flex-col items-center text-center gap-1"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <p className="text-[11px] text-muted-foreground leading-tight">{t}</p>
                </div>
              ))}
            </div>

            {/* Reviews */}
            <div className="mt-10 border-t border-border pt-8">
              <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
                <div>
                  <h3 className="font-display font-black text-2xl">Reviews</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {product.reviews} total · avg {product.rating.toFixed(1)} ★
                  </p>
                </div>
                {sortedReviews.length > 0 && (
                  <div className="flex items-center gap-1 bg-surface-2 rounded-full p-1 text-xs">
                    <button
                      type="button"
                      onClick={() => setReviewSort("recent")}
                      className={`px-3 py-1.5 rounded-full transition ${reviewSort === "recent" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
                    >
                      Most recent
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewSort("rating")}
                      className={`px-3 py-1.5 rounded-full transition ${reviewSort === "rating" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground"}`}
                    >
                      Highest rated
                    </button>
                  </div>
                )}
              </div>

              {/* Submit form */}
              {!user ? (
                <div className="glass rounded-2xl p-5 mb-6 text-sm text-muted-foreground flex items-center gap-3">
                  <LogIn className="h-4 w-4 text-primary shrink-0" />
                  <span>
                    <Link to="/auth" className="text-primary font-semibold hover:underline">
                      Sign in
                    </Link>{" "}
                    to leave a review.
                  </span>
                </div>
              ) : alreadyReviewed && !editingId ? (
                <div className="glass rounded-2xl p-5 mb-6 text-sm text-muted-foreground flex items-center gap-2">
                  <Check className="h-4 w-4 text-primary" />
                  You've reviewed this product. Use Edit or Delete on your review below.
                </div>
              ) : !alreadyReviewed && checkingEligibility ? null : !alreadyReviewed &&
                !canReview ? (
                <div className="glass rounded-2xl p-5 mb-6 text-sm text-muted-foreground">
                  You can review this product once your order has been delivered.
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="glass rounded-2xl p-5 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary font-mono">
                      — {editingId ? "Edit your review" : "Leave a review"}
                    </p>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setReviewRating(n)}
                          className="p-1"
                          aria-label={`${n} stars`}
                        >
                          <Star
                            className={`h-5 w-5 transition ${
                              n <= reviewRating
                                ? "fill-primary text-primary"
                                : "text-muted-foreground"
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                  <textarea
                    value={reviewText}
                    onChange={(e) => setReviewText(e.target.value)}
                    placeholder="Tell others about the taste, quality, and value…"
                    rows={3}
                    maxLength={500}
                    required
                    className="w-full bg-input rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 ring-primary resize-none"
                  />
                  {reviewError && <p className="mt-2 text-xs text-destructive">{reviewError}</p>}
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">
                      {reviewText.length}/500
                    </span>
                    <div className="flex gap-2">
                      {editingId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(null);
                            setReviewText("");
                            setReviewRating(5);
                          }}
                          className="rounded-full bg-surface-2 px-4 py-2 text-sm"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        type="submit"
                        disabled={submitReview.isPending || updateReview.isPending}
                        className="rounded-full bg-primary text-primary-foreground px-5 py-2 text-sm font-bold hover:shadow-glow transition disabled:opacity-60"
                      >
                        {submitReview.isPending || updateReview.isPending
                          ? "Saving…"
                          : editingId
                            ? "Save changes"
                            : "Post review"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {sortedReviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Be the first to review this bottle.
                  </p>
                ) : (
                  sortedReviews.map((rev) => {
                    const isOwn = ownReview?.id === rev.id;
                    return (
                      <div
                        key={rev.id}
                        className={`glass rounded-xl p-5 ${isOwn ? "ring-1 ring-primary/50" : ""}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className="font-bold text-sm">
                            {rev.name}
                            {isOwn && (
                              <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-primary">
                                You
                              </span>
                            )}
                          </p>
                          <div className="flex gap-0.5 text-primary">
                            {Array.from({ length: 5 }).map((_, k) => (
                              <Star
                                key={k}
                                className={`h-3.5 w-3.5 ${k < rev.rating ? "fill-current" : ""}`}
                              />
                            ))}
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-foreground/85">{rev.text}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {new Date(rev.at).toLocaleDateString()}
                          </p>
                          {isOwn && (
                            <div className="flex gap-1">
                              <button
                                onClick={() => setEditingId(rev.id)}
                                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-surface-2 hover:bg-primary hover:text-primary-foreground transition"
                              >
                                <Pencil className="h-3 w-3" /> Edit
                              </button>
                              <button
                                onClick={handleDeleteOwn}
                                className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-surface-2 hover:bg-destructive hover:text-destructive-foreground transition"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

        <WineProfile product={product} />

        {/* Related */}
        <section className="mt-24">
          <h2 className="font-display font-black text-3xl md:text-4xl tracking-tighter mb-8">
            You may also like
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        </section>
      </div>

      {/* Zoom modal */}
      <AnimatePresence>
        {zoom && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] bg-background/95 backdrop-blur-md grid place-items-center p-6 cursor-zoom-out"
            onClick={() => setZoom(false)}
          >
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={product.images[activeImg]}
              alt={product.name}
              className="max-h-full max-w-full object-contain rounded-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
      <p className="text-sm mt-1">{value}</p>
    </div>
  );
}
