import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { ProductCard } from "@/components/ProductCard";
import { useProducts } from "@/lib/queries/products";
import { PRODUCT_GROUPS, PRODUCT_TYPES, productTypeLabel, type ProductType } from "@/lib/products";
import { formatNGN } from "@/lib/currency";
import { Filter, SlidersHorizontal, X } from "lucide-react";

const TYPES = ["all", ...PRODUCT_TYPES.map((w) => w.key)] as const;
type TypeFilter = (typeof TYPES)[number];
const SORTS = [
  "Featured",
  "Newest",
  "Price: Low → High",
  "Price: High → Low",
  "Top Rated",
] as const;

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

  const [sort, setSort] = useState<(typeof SORTS)[number]>("Featured");
  const [maxPrice, setMaxPrice] = useState(100000);

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
                <Link to="/shop" className="text-xs text-muted-foreground underline self-center">
                  Clear all
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          <aside className="space-y-7 lg:sticky lg:top-28 lg:self-start">
            <FilterGroup label="Type">
              <div className="space-y-4">
                <Chip active={type === "all"} onClick={() => update({ type: undefined })}>
                  all
                </Chip>
                {PRODUCT_GROUPS.map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {g.label}
                    </p>
                    <div className="flex lg:flex-col gap-2 flex-wrap">
                      {PRODUCT_TYPES.filter((t) => t.group === g.key).map((t) => (
                        <Chip
                          key={t.key}
                          active={type === t.key}
                          onClick={() => update({ type: t.key })}
                        >
                          {productTypeLabel(t.key)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </FilterGroup>

            {regions.length > 0 && (
              <FilterGroup label="Region">
                <div className="flex lg:flex-col gap-2 flex-wrap max-h-56 overflow-y-auto pr-1">
                  <Chip active={!region} onClick={() => update({ region: undefined })}>
                    all
                  </Chip>
                  {regions.map((r) => (
                    <Chip key={r} active={region === r} onClick={() => update({ region: r })}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </FilterGroup>
            )}

            {countries.length > 0 && (
              <FilterGroup label="Country">
                <div className="flex lg:flex-col gap-2 flex-wrap max-h-56 overflow-y-auto pr-1">
                  <Chip active={!country} onClick={() => update({ country: undefined })}>
                    all
                  </Chip>
                  {countries.map((c) => (
                    <Chip key={c} active={country === c} onClick={() => update({ country: c })}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </FilterGroup>
            )}

            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
                <SlidersHorizontal className="h-3.5 w-3.5" /> Max price
              </h3>
              <input
                type="range"
                min={10000}
                max={100000}
                step={5000}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-primary"
              />
              <p className="mt-2 text-sm">
                Up to{" "}
                <span className="font-display font-bold text-primary">{formatNGN(maxPrice)}</span>
              </p>
            </div>

            <div>
              <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3">
                Sort
              </h3>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="w-full bg-input rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 ring-primary"
              >
                {SORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </aside>

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
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
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

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 flex items-center gap-2">
        <Filter className="h-3.5 w-3.5" /> {label}
      </h3>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-full text-sm capitalize transition border ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "border-border hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
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
