import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/lib/queries/products";
import { PRODUCT_TYPES, productTypeLabel, type ProductType } from "@/lib/products";
import { FilterDrawer, type Sort } from "@/components/shop/FilterDrawer";
import { X } from "lucide-react";

const TYPES = ["all", ...PRODUCT_TYPES.map((w) => w.key)] as const;
type TypeFilter = (typeof TYPES)[number];
type ShopSearch = { type?: TypeFilter; region?: string; country?: string };

export const Route = createFileRoute("/shop")({
  validateSearch: (s: Record<string, unknown>): ShopSearch => {
    const type =
      typeof s.type === "string" && (TYPES as readonly string[]).includes(s.type)
        ? (s.type as TypeFilter)
        : undefined;
    const region = typeof s.region === "string" ? s.region : undefined;
    const country = typeof s.country === "string" ? s.country : undefined;
    return { type, region, country };
  },
  head: () => ({
    meta: [
      { title: "Shop — Finkel Reserve" },
      {
        name: "description",
        content: "Browse fine wines, whiskeys, spirits and premium beverages.",
      },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: products = [], isLoading } = useProducts();

  // URL is the single source of truth — derive instead of mirroring in state
  const type: TypeFilter = search.type ?? "all";
  const region: string | undefined = search.region;
  const country: string | undefined = search.country;

  const [sort, setSort] = useState<Sort>("Featured");
  // null = "no price cap". The cap used to default to a fixed ₦100,000, which silently hid every
  // dearer product (whiskey, champagne…); now the slider's top is the dearest item on sale.
  const [maxPriceChoice, setMaxPriceChoice] = useState<number | null>(null);

  const update = (patch: Partial<ShopSearch>) =>
    navigate({ search: (prev: ShopSearch) => ({ ...prev, ...patch }) });

  // Region/country are free text on real product data, not a curated static
  // list (see src/lib/products.ts) — derived from whatever's actually
  // loaded rather than a hardcoded taxonomy. Empty until real wines with
  // that field set exist, which is correct: no fabricated options.
  const regions = useMemo(
    () => [...new Set(products.map((p) => p.region).filter((r): r is string => !!r))].sort(),
    [products],
  );
  const countries = useMemo(
    () => [...new Set(products.map((p) => p.country).filter((c): c is string => !!c))].sort(),
    [products],
  );

  const priceCeiling = useMemo(() => {
    const dearest = Math.max(0, ...products.map((p) => p.price));
    return dearest > 0 ? Math.ceil(dearest / 10000) * 10000 : 100000;
  }, [products]);
  const priceStep = priceCeiling > 300000 ? 25000 : priceCeiling > 120000 ? 10000 : 5000;
  const maxPrice = Math.min(maxPriceChoice ?? priceCeiling, priceCeiling);

  const activeCount =
    (type !== "all" ? 1 : 0) +
    (region ? 1 : 0) +
    (country ? 1 : 0) +
    (maxPrice < priceCeiling ? 1 : 0) +
    (sort !== "Featured" ? 1 : 0);

  const clearAll = () => {
    navigate({ search: {} });
    setMaxPriceChoice(null);
    setSort("Featured");
  };

  const filtered = useMemo(() => {
    let list = products.filter(
      (p) =>
        (type === "all" || p.productType === type) &&
        (!region || p.region === region) &&
        (!country || p.country === country) &&
        p.price <= maxPrice,
    );
    if (sort === "Newest") list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    if (sort === "Price: Low → High") list = [...list].sort((a, b) => a.price - b.price);
    if (sort === "Price: High → Low") list = [...list].sort((a, b) => b.price - a.price);
    if (sort === "Top Rated") list = [...list].sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, type, region, country, sort, maxPrice]);

  return (
    <Layout>
      <div className="pt-32" />
      <section className="mx-auto max-w-[1400px] px-6 md:px-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— The shop</p>
            <h1 className="mt-3 font-display font-black text-5xl md:text-7xl tracking-tighter leading-[0.9]">
              The shop.
            </h1>
            <p className="mt-3 text-muted-foreground max-w-lg">
              Fine wines, whiskeys and premium beverages. {filtered.length} item
              {filtered.length === 1 ? "" : "s"}.
            </p>
            {(type !== "all" || region || country) && (
              <div className="mt-4 flex flex-wrap gap-2">
                {type !== "all" && (
                  <ActiveChip
                    label={`Type: ${productTypeLabel(type)}`}
                    onClear={() => update({ type: undefined })}
                  />
                )}
                {region && (
                  <ActiveChip
                    label={`Region: ${region}`}
                    onClear={() => update({ region: undefined })}
                  />
                )}
                {country && (
                  <ActiveChip
                    label={`Country: ${country}`}
                    onClear={() => update({ country: undefined })}
                  />
                )}
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-xs text-muted-foreground underline self-center"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pb-24">
          <FilterDrawer
            type={type}
            onType={(t) => update({ type: t as TypeFilter | undefined })}
            region={region}
            regions={regions}
            onRegion={(r) => update({ region: r })}
            country={country}
            countries={countries}
            onCountry={(c) => update({ country: c })}
            maxPrice={maxPrice}
            priceCeiling={priceCeiling}
            priceStep={priceStep}
            onMaxPrice={(v) => setMaxPriceChoice(v >= priceCeiling ? null : v)}
            sort={sort}
            onSort={setSort}
            resultCount={filtered.length}
            activeCount={activeCount}
            onClearAll={clearAll}
          />

          <div>
            {isLoading ? (
              <div className="glass rounded-2xl p-16 text-center text-muted-foreground">
                Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="glass rounded-2xl p-16 text-center">
                <p className="text-muted-foreground">Nothing matches those filters.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-4">
                {filtered.map((p, i) => (
                  <ProductCard key={p.id} product={p} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    </Layout>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono uppercase tracking-wider bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  );
}
