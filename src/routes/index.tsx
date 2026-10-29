import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Zap, Truck, ShieldCheck, Repeat } from "lucide-react";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { ScrollHero } from "@/components/ScrollHero";
import { ProductCard } from "@/components/ProductCard";
import { PRODUCT_TYPES, productGroupOf, PRODUCT_GROUPS } from "@/lib/products";
import { bottlePlaceholder } from "@/lib/placeholder";
import { useProducts } from "@/lib/queries/products";
import { useSubscribeNewsletter } from "@/lib/queries/contact";
import { formatNGN } from "@/lib/currency";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Finkel Reserve — Fine Wines, Whiskeys & Beverages, Curated for Nigeria" },
      {
        name: "description",
        content:
          "Curated wines, whiskeys, spirits and premium beverages, sourced honestly and delivered across Nigeria.",
      },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { data: products = [], isLoading } = useProducts();
  const featured = products.slice(0, 4);
  const trending = products.slice(2, 6);
  const bestSellers = [...products].sort((a, b) => b.reviews - a.reviews).slice(0, 4);
  const newArrivals = [...products].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8);

  // A tile uses a real product photo of that type when one exists, otherwise
  // the on-brand placeholder bottle in that type's colour (never a hotlinked
  // stock shot, which would show the wrong drink for e.g. whiskey).
  const imageFor = (type: string) =>
    products.find((p) => p.productType === type)?.images[0] ?? bottlePlaceholder(type);

  // One tile per part of the range, not just the first four wine styles.
  const FEATURED_TYPES = ["red", "white", "whiskey", "sparkling"];

  // FINKEL10 is advertised below and in the footer/newsletter, but the
  // code itself still needs to actually be created via
  // /admin/promotions (or a seed script) before checkout will accept it.
  // Advertising a code that doesn't exist yet in `coupons` would mean the
  // promise on this page silently fails at checkout.
  const PROMO_CODE = "FINKEL10";

  return (
    <Layout>
      {/* HERO — pinned, scroll-scrubbed film (see ScrollHero.tsx) */}
      <ScrollHero />

      {/* Trust bar */}
      <div className="border-b border-border/60 bg-background">
        <div className="mx-auto flex max-w-[1400px] flex-wrap justify-center gap-x-8 gap-y-2 px-4 py-3.5 text-xs uppercase tracking-[0.2em] text-muted-foreground">
          {[
            "Same-day–next-day delivery",
            "Verified sourcing",
            "New arrivals regularly",
            "Easy returns",
            "Secure payment via Paystack",
            "18+ only",
          ].map((t) => (
            <span key={t} className="inline-flex items-center gap-2.5">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURED COLLECTIONS */}
      <Section
        title="Featured collections"
        eyebrow="— Curated"
        cta={{ label: "See all", to: "/shop" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5">
          {FEATURED_TYPES.map((k) => PRODUCT_TYPES.find((t) => t.key === k)!).map((w, i) => (
            <motion.div
              key={w.key}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.06 }}
              className="relative group aspect-[3/4] overflow-hidden rounded-2xl"
            >
              <Link to="/shop" search={{ type: w.key }} className="block absolute inset-0">
                <img
                  src={imageFor(w.key)}
                  alt={w.label}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-primary">
                    {PRODUCT_GROUPS.find((g) => g.key === productGroupOf(w.key))?.label}
                  </p>
                  <h3 className="font-display font-black text-2xl md:text-3xl mt-1">{w.label}</h3>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs uppercase tracking-wider opacity-0 group-hover:opacity-100 transition">
                    Shop now <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </Section>

      {/* NEW ARRIVALS — dedicated spot */}
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface to-background p-6 md:p-10">
          <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary/30 blur-[120px] pointer-events-none" />
          <div className="relative flex items-end justify-between gap-4 mb-8">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">
                — Just landed
              </p>
              <h2 className="mt-2 font-display font-black text-3xl md:text-5xl tracking-tighter">
                New arrivals
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">Recently added to the cellar.</p>
            </div>
            <Link
              to="/shop"
              className="hidden md:inline-flex items-center gap-2 text-sm hover:text-primary transition"
            >
              See all <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {isLoading ? (
              <p className="col-span-full text-sm text-muted-foreground">Loading…</p>
            ) : (
              newArrivals
                .slice(0, 4)
                .map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
            )}
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <Section
        title="Featured bottles"
        eyebrow="— Curated"
        cta={{ label: "All products", to: "/shop" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {isLoading ? (
            <p className="col-span-full text-sm text-muted-foreground">Loading…</p>
          ) : (
            featured.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
          )}
        </div>
      </Section>

      {/* KNOW WHAT YOU'RE DRINKING */}
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <div className="relative overflow-hidden rounded-3xl glass p-8 md:p-16 grid md:grid-cols-2 gap-10 items-center">
          <div className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary/30 blur-[120px] pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-accent/20 blur-[120px] pointer-events-none" />
          <div className="relative">
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">
              — No guesswork
            </p>
            <h2 className="mt-4 font-display font-black text-4xl md:text-6xl tracking-tighter leading-[0.95]">
              Know what you're <span className="text-gradient-wine">drinking</span>.
            </h2>
            <p className="mt-5 text-muted-foreground max-w-md leading-relaxed">
              Every bottle lists real region, vintage, grape variety, and tasting notes — not just a
              picture and a price.
            </p>
            <Link
              to="/shop"
              className="mt-7 inline-flex items-center gap-3 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm hover:shadow-glow transition"
            >
              Explore the range <Zap className="h-4 w-4" />
            </Link>
          </div>
          <div className="relative aspect-square md:aspect-[4/5] rounded-2xl overflow-hidden">
            <img
              src={imageFor("red")}
              alt="Bottle detail"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent" />
            <div className="absolute bottom-6 left-6 right-6 glass rounded-xl p-4 space-y-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                On every label
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["Region", "Vintage", "Grape variety", "ABV"].map((f) => (
                  <span
                    key={f}
                    className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-full bg-primary/15 text-primary"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BEST SELLERS */}
      <Section
        title="Best sellers"
        eyebrow="— Customer picks"
        cta={{ label: "Browse", to: "/shop" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {isLoading ? (
            <p className="col-span-full text-sm text-muted-foreground">Loading…</p>
          ) : (
            bestSellers.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
          )}
        </div>
      </Section>

      {/* PROMO BANNER */}
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-wine p-10 md:p-16">
          <div className="absolute inset-0 grain opacity-20" />
          <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-primary-foreground/70 font-mono">
                — Welcome offer
              </p>
              <h2 className="mt-3 font-display font-black text-3xl md:text-5xl tracking-tighter text-primary-foreground">
                10% off your first order
              </h2>
              <p className="mt-2 text-primary-foreground/80 text-sm">
                Applied at checkout — no expiry games, just a genuine discount.
              </p>
            </div>
            <div className="glass rounded-2xl px-8 py-5 text-center">
              <p className="text-[10px] uppercase tracking-[0.25em] text-primary-foreground/70">
                Use code
              </p>
              <p className="font-display font-black text-3xl tracking-tighter text-primary-foreground">
                {PROMO_CODE}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* TRENDING */}
      <Section title="Trending now" eyebrow="— Hot list">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {isLoading ? (
            <p className="col-span-full text-sm text-muted-foreground">Loading…</p>
          ) : (
            trending.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)
          )}
        </div>
      </Section>

      {/* SOCIAL GALLERY */}
      <Section
        title="@finkelreserve"
        eyebrow="— Follow along"
        cta={{ label: "Tag us", to: "/contact" }}
      >
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {products
            .flatMap((p) => p.images)
            .slice(0, 12)
            .map((src, i) => (
              <motion.a
                key={i}
                href="#"
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                className="aspect-square overflow-hidden rounded-lg group relative"
              >
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition grid place-items-center">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
              </motion.a>
            ))}
        </div>
      </Section>

      {/* PERKS */}
      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { Icon: Truck, t: "Free shipping", s: `Orders over ${formatNGN(180000)}` },
            { Icon: ShieldCheck, t: "Verified sourcing", s: "Every bottle checked" },
            { Icon: Repeat, t: "24-hour returns", s: "Report damage fast" },
            { Icon: Zap, t: "Same-day dispatch", s: "Next-day delivery" },
          ].map(({ Icon, t, s }) => (
            <div key={t} className="glass rounded-2xl p-5 flex items-center gap-4">
              <div className="h-11 w-11 grid place-items-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="font-bold text-sm">{t}</p>
                <p className="text-xs text-muted-foreground">{s}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* NEWSLETTER CTA */}
      <NewsletterSection promoCode={PROMO_CODE} />
    </Layout>
  );
}

function NewsletterSection({ promoCode }: { promoCode: string }) {
  const [email, setEmail] = useState("");
  const subscribe = useSubscribeNewsletter();

  return (
    <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-10 md:p-20 text-center">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 h-72 w-72 rounded-full bg-primary/30 blur-[120px]" />
        <p className="relative text-xs uppercase tracking-[0.3em] text-primary font-mono">
          — Join the cellar list
        </p>
        <h2 className="relative mt-3 font-display font-black text-4xl md:text-6xl tracking-tighter">
          Never miss a <span className="text-gradient-wine">release</span>.
        </h2>
        <p className="relative mt-4 text-muted-foreground max-w-lg mx-auto">
          Subscribe for new arrivals, tasting notes, and 10% off your first order with code{" "}
          {promoCode}.
        </p>
        {subscribe.isSuccess ? (
          <p className="relative mt-8 text-primary font-semibold">You're on the list. 🇳🇬</p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (email.trim()) subscribe.mutate(email.trim());
            }}
            className="relative mt-8 flex flex-col sm:flex-row items-stretch gap-3 max-w-lg mx-auto"
          >
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1 bg-input rounded-full px-6 py-4 outline-none focus:ring-2 ring-primary"
            />
            <button
              disabled={subscribe.isPending}
              className="rounded-full bg-primary text-primary-foreground px-8 py-4 font-bold hover:shadow-glow transition disabled:opacity-60"
            >
              {subscribe.isPending ? "Joining…" : "Subscribe"}
            </button>
          </form>
        )}
        {subscribe.isError && (
          <p className="relative mt-3 text-sm text-destructive">
            Couldn't subscribe — please try again.
          </p>
        )}
      </div>
    </section>
  );
}

function Section({
  title,
  eyebrow,
  cta,
  children,
}: {
  title: string;
  eyebrow?: string;
  cta?: { label: string; to: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
      <div className="flex items-end justify-between gap-4 mb-8">
        <div>
          {eyebrow && (
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">{eyebrow}</p>
          )}
          <h2 className="mt-2 font-display font-black text-3xl md:text-5xl tracking-tighter">
            {title}
          </h2>
        </div>
        {cta && (
          <Link
            to={cta.to}
            className="hidden md:inline-flex items-center gap-2 text-sm hover:text-primary transition"
          >
            {cta.label} <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
