import { Link } from "@tanstack/react-router";
import { Instagram, Twitter, Youtube, Facebook } from "lucide-react";
import { useState } from "react";
import { useSubscribeNewsletter } from "@/lib/queries/contact";
import { useSettings } from "@/lib/queries/settings";

export function Footer() {
  const { data: settings } = useSettings();

  const socials = [
    settings?.instagramUrl && { Icon: Instagram, href: settings.instagramUrl, label: "Instagram" },
    settings?.twitterUrl && { Icon: Twitter, href: settings.twitterUrl, label: "X (Twitter)" },
    settings?.youtubeUrl && { Icon: Youtube, href: settings.youtubeUrl, label: "YouTube" },
    settings?.facebookUrl && { Icon: Facebook, href: settings.facebookUrl, label: "Facebook" },
  ].filter(Boolean) as { Icon: typeof Instagram; href: string; label: string }[];

  return (
    <footer className="relative mt-24 border-t border-border/60 bg-surface/50">
      {/*
        Grid: brand(2fr) | shop(1fr) | brand-links(1fr) | help(1fr) | newsletter(2fr)
        5 explicit columns avoids col-span arithmetic entirely.
      */}
      <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-16 grid gap-x-8 gap-y-12 md:grid-cols-[2fr_1fr_1fr_1fr_2fr]">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-wine shadow-glow grid place-items-center">
              <span className="font-display font-black text-primary-foreground">F</span>
            </div>
            <span className="font-display font-black tracking-tight text-xl">
              FINKEL<span className="text-gradient-wine">·</span>RESERVE
            </span>
          </div>
          <p className="mt-5 text-sm text-muted-foreground max-w-sm leading-relaxed">
            Fine wines, whiskeys and beverages for Nigeria — curated bottles, trusted provenance,
            and unforgettable moments.
          </p>
          <p className="mt-3 text-xs text-muted-foreground/80">
            Please enjoy responsibly. For purchase by persons 18 and older only.
          </p>
          <div className="mt-6 flex items-center gap-3">
            {socials.map(({ Icon, href, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="grid h-10 w-10 rounded-full glass place-items-center hover:bg-primary hover:text-primary-foreground transition"
                aria-label={label}
              >
                <Icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Shop</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/shop" search={{ type: "red" }} className="hover:text-primary">
                Red
              </Link>
            </li>
            <li>
              <Link to="/shop" search={{ type: "white" }} className="hover:text-primary">
                White
              </Link>
            </li>
            <li>
              <Link to="/shop" search={{ type: "rose" }} className="hover:text-primary">
                Rosé
              </Link>
            </li>
            <li>
              <Link to="/shop" search={{ type: "sparkling" }} className="hover:text-primary">
                Sparkling
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Brand</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/about" className="hover:text-primary">
                Story
              </Link>
            </li>
            <li>
              <Link to="/blog" className="hover:text-primary">
                Wine Guide
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-primary">
                Contact
              </Link>
            </li>
          </ul>
        </div>

        {/* Legal/Help — plain <a> tags used because these routes are added after
            the routeTree snapshot; they use full-page navigation which is fine
            for informational pages. */}
        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">Help</h4>
          <ul className="space-y-2 text-sm">
            <li>
              <a href="/shipping-policy" className="hover:text-primary">
                Shipping
              </a>
            </li>
            <li>
              <a href="/returns-policy" className="hover:text-primary">
                Returns
              </a>
            </li>
            <li>
              <a href="/terms" className="hover:text-primary">
                Terms
              </a>
            </li>
            <li>
              <a href="/privacy" className="hover:text-primary">
                Privacy
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h4 className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-4">
            Join the cellar list
          </h4>
          <p className="text-sm text-muted-foreground mb-4">
            New arrivals, tasting notes, and 10% off your first order.
          </p>
          <FooterNewsletterForm />
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="mx-auto max-w-[1400px] px-6 md:px-10 py-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Finkel Reserve — All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <a href="/privacy" className="hover:text-primary transition">
              Privacy
            </a>
            <a href="/terms" className="hover:text-primary transition">
              Terms
            </a>
            <a href="/shipping-policy" className="hover:text-primary transition">
              Shipping
            </a>
            <a href="/returns-policy" className="hover:text-primary transition">
              Returns
            </a>
          </div>
          <p className="font-mono">NAIJA OWNED · NAIJA BUILT</p>
        </div>
      </div>
    </footer>
  );
}

function FooterNewsletterForm() {
  const [email, setEmail] = useState("");
  const subscribe = useSubscribeNewsletter();

  if (subscribe.isSuccess) {
    return <p className="text-sm text-primary font-semibold">You're on the list. 🇳🇬</p>;
  }

  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (email.trim()) subscribe.mutate(email.trim());
      }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        className="flex-1 bg-input rounded-full px-5 py-3 text-sm outline-none focus:ring-2 ring-primary"
      />
      <button
        disabled={subscribe.isPending}
        className="rounded-full bg-primary text-primary-foreground px-5 py-3 text-sm font-bold hover:shadow-glow transition disabled:opacity-60"
      >
        {subscribe.isPending ? "…" : "Subscribe"}
      </button>
    </form>
  );
}
