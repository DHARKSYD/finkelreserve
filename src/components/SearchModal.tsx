import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Search as SearchIcon, X, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useProducts } from "@/lib/queries/products";
import { productTypeLabel } from "@/lib/products";
import { formatNGN } from "@/lib/currency";

type Props = { open: boolean; onClose: () => void };

// No "browse by producer/region" quick-links here (yet) — the old Clubs/
// Brands sections were powered by static CLUBS/BRANDS arrays, which don't
// carry over: producer and region are free text on real wine data, not a
// curated closed set (see src/lib/products.ts). A distinct-values query
// could power the same kind of quick-link UI once there's real catalog
// data to browse; not worth building against an empty table.
export function SearchModal({ open, onClose }: Props) {
  const [q, setQ] = useState("");
  const { data: catalog = [] } = useProducts();

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const term = q.trim().toLowerCase();

  const productHits = useMemo(() => {
    if (!term) return catalog.slice(0, 6);
    return catalog
      .filter((p) => {
        const hay =
          `${p.name} ${p.producer} ${p.region ?? ""} ${p.country ?? ""} ${p.productType} ${p.grapeVariety.join(" ")} ${p.description}`.toLowerCase();
        return term.split(/\s+/).every((t) => hay.includes(t));
      })
      .slice(0, 8);
  }, [term, catalog]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[90] bg-background/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ type: "spring", damping: 26, stiffness: 240 }}
            className="fixed inset-x-0 top-0 z-[100] mx-auto max-w-3xl px-4 pt-6"
          >
            <div className="glass rounded-2xl overflow-hidden border border-border">
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border/60">
                <SearchIcon className="h-5 w-5 text-primary" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search wines, whiskeys, producers, regions…"
                  className="flex-1 bg-transparent outline-none text-base placeholder:text-muted-foreground"
                />
                <button
                  onClick={onClose}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 space-y-5">
                <Section
                  title={term ? "Products" : "Trending"}
                  icon={!term ? <TrendingUp className="h-3.5 w-3.5" /> : undefined}
                >
                  {productHits.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6 text-center">
                      No matches. Try a producer, region or grape variety.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/40">
                      {productHits.map((p) => (
                        <li key={p.id}>
                          <Link
                            to="/product/$slug"
                            params={{ slug: p.slug }}
                            onClick={onClose}
                            className="flex gap-3 items-center py-2.5 hover:bg-surface-2/60 rounded-lg px-2 transition"
                          >
                            <img
                              src={p.images[0]}
                              alt=""
                              className="h-12 w-10 object-cover rounded-md"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{p.name}</p>
                              <p className="text-[11px] text-muted-foreground">
                                {p.producer} ·{" "}
                                <span className="capitalize">
                                  {productTypeLabel(p.productType)}
                                </span>
                              </p>
                            </div>
                            <span className="font-display font-bold text-sm">
                              {formatNGN(p.price)}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </Section>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2 flex items-center gap-1.5">
        {icon} {title}
      </p>
      {children}
    </div>
  );
}
