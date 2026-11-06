import { useState } from "react";
import { Filter, SlidersHorizontal } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { PRODUCT_GROUPS, PRODUCT_TYPES, productTypeLabel } from "@/lib/products";
import { formatNGN } from "@/lib/currency";

export const SORTS = [
  "Featured",
  "Newest",
  "Price: Low → High",
  "Price: High → Low",
  "Top Rated",
] as const;
export type Sort = (typeof SORTS)[number];

type Props = {
  type: string; // "all" or a product type key
  onType: (type: string | undefined) => void;
  region?: string;
  regions: string[];
  onRegion: (region: string | undefined) => void;
  country?: string;
  countries: string[];
  onCountry: (country: string | undefined) => void;
  /** Price slider: current cap, the dearest product (slider max) and the slider's step. */
  maxPrice: number;
  priceCeiling: number;
  priceStep: number;
  onMaxPrice: (price: number) => void;
  sort: Sort;
  onSort: (sort: Sort) => void;
  resultCount: number;
  /** How many filters differ from the defaults (shown on the button). */
  activeCount: number;
  onClearAll: () => void;
};

// The shop's filters live in a drawer opened by a round button — the same kind of floating
// button as the WhatsApp one, on the opposite (left) side so the two never overlap.
// On a phone the drawer rises from the bottom like a native sheet; on larger screens it slides
// in from the left. Filters apply as you tap (the URL stays the source of truth for type /
// region / country), and "Show N results" just closes the drawer.
export function FilterDrawer(props: Props) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();
  const {
    type,
    region,
    regions,
    country,
    countries,
    maxPrice,
    priceCeiling,
    priceStep,
    sort,
    resultCount,
    activeCount,
  } = props;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
        aria-haspopup="dialog"
        // On phones sit above the bottom tab bar (3.75rem + its safe-area padding); on desktop,
        // where there is no bar, mirror the WhatsApp button's offset.
        className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-40 grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-glow transition hover:scale-110 lg:bottom-5 lg:left-5"
      >
        <SlidersHorizontal className="h-6 w-6" />
        {activeCount > 0 && (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] font-bold text-accent-foreground ring-2 ring-background">
            {activeCount}
          </span>
        )}
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side={isMobile ? "bottom" : "left"}
          className={`flex flex-col gap-0 p-0 ${
            isMobile ? "max-h-[88dvh] rounded-t-3xl" : "w-[24rem] max-w-[90vw] sm:max-w-[24rem]"
          }`}
        >
          {isMobile && (
            <div className="mx-auto mt-3 h-1.5 w-10 shrink-0 rounded-full bg-border" aria-hidden="true" />
          )}
          <SheetHeader className="shrink-0 border-b border-border px-5 pb-4 pt-4 text-left">
            <SheetTitle className="font-display text-xl font-black">Filters</SheetTitle>
            <SheetDescription className="sr-only">
              Narrow the shop by type, region, country and price, and change the sort order.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
            <FilterGroup label="Type">
              <div className="space-y-4">
                <Chip active={type === "all"} onClick={() => props.onType(undefined)}>
                  all
                </Chip>
                {PRODUCT_GROUPS.map((g) => (
                  <div key={g.key}>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {g.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {PRODUCT_TYPES.filter((t) => t.group === g.key).map((t) => (
                        <Chip key={t.key} active={type === t.key} onClick={() => props.onType(t.key)}>
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
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                  <Chip active={!region} onClick={() => props.onRegion(undefined)}>
                    all
                  </Chip>
                  {regions.map((r) => (
                    <Chip key={r} active={region === r} onClick={() => props.onRegion(r)}>
                      {r}
                    </Chip>
                  ))}
                </div>
              </FilterGroup>
            )}

            {countries.length > 0 && (
              <FilterGroup label="Country">
                <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto pr-1">
                  <Chip active={!country} onClick={() => props.onCountry(undefined)}>
                    all
                  </Chip>
                  {countries.map((c) => (
                    <Chip key={c} active={country === c} onClick={() => props.onCountry(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              </FilterGroup>
            )}

            {priceCeiling > priceStep && (
              <div>
                <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Max price
                </h3>
                <input
                  type="range"
                  aria-label="Maximum price"
                  min={priceStep}
                  max={priceCeiling}
                  step={priceStep}
                  value={maxPrice}
                  onChange={(e) => props.onMaxPrice(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="mt-2 text-sm">
                  {maxPrice >= priceCeiling ? "Any price, up to " : "Up to "}
                  <span className="font-display font-bold text-primary">{formatNGN(maxPrice)}</span>
                </p>
              </div>
            )}

            <div>
              <h3 className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Sort</h3>
              <select
                aria-label="Sort by"
                value={sort}
                onChange={(e) => props.onSort(e.target.value as Sort)}
                className="w-full rounded-lg bg-input px-3 py-2.5 text-sm outline-none ring-primary focus:ring-2"
              >
                {SORTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div
            className="flex shrink-0 gap-3 border-t border-border bg-background p-4"
            style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={props.onClearAll}
              disabled={activeCount === 0}
              className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:border-foreground/40 disabled:opacity-40"
            >
              Clear all
            </button>
            <SheetClose asChild>
              <button
                type="button"
                className="flex-1 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground transition hover:shadow-glow"
              >
                Show {resultCount} {resultCount === 1 ? "result" : "results"}
              </button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
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
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-4 py-2 text-sm capitalize transition ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border hover:border-foreground/30"
      }`}
    >
      {children}
    </button>
  );
}
