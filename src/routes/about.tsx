import { createFileRoute, Link } from "@tanstack/react-router";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Finkel Reserve — Fine Wines, Whiskeys & Beverages for Nigeria" },
      {
        name: "description",
        content:
          "The story behind Finkel Reserve — curated bottles, trusted provenance, and drinking culture for Nigeria.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <Layout>
      <div className="pt-32" />
      <section className="mx-auto max-w-[1400px] px-6 md:px-10">
        <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— The Brand</p>
        <h1 className="mt-3 font-display font-black text-6xl md:text-[10vw] leading-[0.85] tracking-tighter">
          Taste is <span className="text-gradient-wine">culture</span>.
        </h1>
        <p className="mt-8 max-w-2xl text-lg text-muted-foreground leading-relaxed">
          Finkel Reserve exists for one reason: to make exceptional wines, whiskeys and fine
          beverages genuinely accessible in Nigeria — properly sourced, honestly described, and
          delivered with the care a good bottle deserves.
        </p>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-20">
        <div className="grid md:grid-cols-2 gap-6 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="aspect-[4/5] rounded-3xl overflow-hidden"
          >
            <img
              src="https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1000&q=80"
              alt=""
              className="h-full w-full object-cover"
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— Manifesto</p>
            <h2 className="mt-3 font-display font-black text-4xl md:text-5xl tracking-tighter leading-[0.95]">
              A good bottle shouldn't require guesswork.
            </h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">
              Every bottle in our catalogue is chosen for what's actually in the glass — origin,
              age, and craft you can trust — so choosing a bottle feels confident, not intimidating.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { v: "🇳🇬", l: "Naija-owned" },
                { v: "✓", l: "Verified sourcing" },
                { v: "24/7", l: "DM support" },
              ].map((s) => (
                <div key={s.l} className="glass rounded-2xl p-4">
                  <div className="font-display font-black text-3xl text-gradient-wine">{s.v}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground mt-1">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <h2 className="font-display font-black text-3xl md:text-5xl tracking-tighter mb-10">
          Our values
        </h2>
        <div className="grid md:grid-cols-3 gap-5">
          {[
            {
              t: "Honest sourcing",
              d: "Every bottle is listed with real producer, region, and age or vintage detail — no vague labels.",
            },
            {
              t: "Fair pricing",
              d: "Considered pricing on every bottle, from everyday drinking to special occasions.",
            },
            { t: "Real support", d: "DM us on socials or WhatsApp — a person replies, not a bot." },
          ].map((v) => (
            <div key={v.t} className="glass rounded-2xl p-7">
              <h3 className="font-display font-bold text-2xl">{v.t}</h3>
              <p className="mt-3 text-muted-foreground text-sm leading-relaxed">{v.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-[1400px] px-6 md:px-10 mt-24">
        <div className="relative overflow-hidden rounded-3xl bg-wine p-10 md:p-16 text-primary-foreground">
          <h2 className="font-display font-black text-4xl md:text-6xl tracking-tighter max-w-2xl">
            Find your next bottle.
          </h2>
          <Link
            to="/shop"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-background text-foreground px-6 py-3 font-bold text-sm"
          >
            Shop the collection
          </Link>
        </div>
      </section>
    </Layout>
  );
}
