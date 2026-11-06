import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BookOpen, Wine } from "lucide-react";

// A quiet two-link strip shown above the footer on every page (it lives in <Layout>). "Our Story"
// and "Wine Guide" aren't in the phone's bottom tabs, so this keeps them one glance away on
// every screen without shouting — small type, muted colour, a hairline above.
export function DiscoverStrip() {
  const item =
    "group inline-flex items-center gap-2 py-1 text-xs text-muted-foreground transition hover:text-primary";
  return (
    <aside aria-label="Discover Finkel Reserve" className="border-t border-border/60">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-center gap-x-8 gap-y-1 px-6 py-3.5 md:px-10">
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground/70">
          Discover
        </span>
        <Link to="/about" className={item}>
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Our Story
          <span className="hidden text-muted-foreground/70 sm:inline">— the people behind the bottles</span>
          <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        </Link>
        <Link to="/blog" className={item}>
          <Wine className="h-3.5 w-3.5" aria-hidden="true" />
          Wine Guide
          <span className="hidden text-muted-foreground/70 sm:inline">— know before you pour</span>
          <ArrowUpRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
