import type { LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Wine } from "lucide-react";

// Two prominent links shown above the footer on every page (it lives in <Layout>). "Our Story"
// and "Wine Guide" are not in the phone's bottom tabs, so these cards keep them one tap away on
// every screen. Colours come from the theme tokens, so the cards follow light and dark mode.
const CARD =
  "group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-4 transition hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-glow motion-reduce:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:gap-4 md:px-5";

function DiscoverCardBody({
  icon: Icon,
  title,
  tagline,
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
}) {
  return (
    <>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary/15 md:h-11 md:w-11">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-base font-semibold text-foreground md:text-lg">
          {title}
        </span>
        <span className="block text-balance text-sm text-muted-foreground">{tagline}</span>
      </span>
      <ArrowUpRight
        className="h-5 w-5 shrink-0 text-muted-foreground transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary"
        aria-hidden="true"
      />
    </>
  );
}

export function DiscoverStrip() {
  return (
    <aside aria-label="Discover Finkel Reserve" className="border-t border-border/60">
      <div className="mx-auto max-w-[1400px] px-6 py-8 md:px-10 md:py-10">
        <div className="mx-auto max-w-3xl">
          <p className="mb-4 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Discover
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4">
            <Link to="/about" className={CARD}>
              <DiscoverCardBody
                icon={BookOpen}
                title="Our Story"
                tagline="The people behind the bottles"
              />
            </Link>
            <Link to="/blog" className={CARD}>
              <DiscoverCardBody icon={Wine} title="Wine Guide" tagline="Know before you pour" />
            </Link>
          </div>
        </div>
      </div>
    </aside>
  );
}
