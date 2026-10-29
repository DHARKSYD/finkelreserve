import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { headingId, type Block } from "@/content/blog/types";

/** **bold** → <strong>. The only inline markup; everything else renders as plain text. */
function Inline({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export function PostBody({ blocks }: { blocks: Block[] }) {
  return (
    <div>
      {blocks.map((b, i) => {
        switch (b.type) {
          case "h2":
            return (
              <h2
                key={i}
                id={headingId(b.text)}
                className="scroll-mt-28 mt-14 mb-4 font-display font-black text-2xl md:text-3xl tracking-tight"
              >
                {b.text}
              </h2>
            );
          case "h3":
            return (
              <h3 key={i} className="mt-8 mb-3 font-display font-bold text-xl tracking-tight">
                {b.text}
              </h3>
            );
          case "p":
            return (
              <p key={i} className="mb-5 text-[17px] leading-8 text-foreground/85">
                <Inline text={b.text} />
              </p>
            );
          case "ul":
            return (
              <ul key={i} className="mb-6 space-y-3 text-[17px] leading-8 text-foreground/85">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span
                      aria-hidden
                      className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                    />
                    <span>
                      <Inline text={it} />
                    </span>
                  </li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={i} className="mb-6 space-y-3 text-[17px] leading-8 text-foreground/85">
                {b.items.map((it, j) => (
                  <li key={j} className="flex gap-3">
                    <span className="mt-1.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {j + 1}
                    </span>
                    <span>
                      <Inline text={it} />
                    </span>
                  </li>
                ))}
              </ol>
            );
          case "steps":
            return (
              <ol key={i} className="my-8 space-y-0">
                {b.items.map((s, j) => (
                  <li key={j} className="relative flex gap-5 pb-8 last:pb-0">
                    {j < b.items.length - 1 && (
                      <span
                        aria-hidden
                        className="absolute left-[1.15rem] top-10 bottom-0 w-px bg-border"
                      />
                    )}
                    <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-wine text-sm font-bold text-primary-foreground shadow-glow">
                      {j + 1}
                    </span>
                    <div className="pt-1.5">
                      <p className="font-display font-bold text-lg leading-snug">{s.title}</p>
                      <p className="mt-1.5 text-[16px] leading-7 text-foreground/80">
                        <Inline text={s.text} />
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "facts":
            return (
              <div key={i} className="my-8 glass rounded-2xl p-6">
                {b.title && (
                  <p className="mb-4 font-mono text-xs uppercase tracking-[0.2em] text-primary">
                    — {b.title}
                  </p>
                )}
                <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {b.items.map((f, j) => (
                    <div key={j}>
                      <dt className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                        {f.label}
                      </dt>
                      <dd className="mt-1 text-[15px] leading-6 text-foreground/90">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          case "callout":
            return (
              <aside
                key={i}
                className="my-8 rounded-r-2xl border-l-4 border-accent bg-surface-2/70 p-6"
              >
                {b.title && <p className="mb-1.5 font-display font-bold text-lg">{b.title}</p>}
                <p className="text-[16px] leading-7 text-foreground/85">
                  <Inline text={b.text} />
                </p>
              </aside>
            );
          case "shop":
            return (
              <div key={i} className="my-8">
                <Link
                  to="/shop"
                  search={{ type: b.productType }}
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-6 py-3.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                >
                  {b.label}
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </Link>
              </div>
            );
        }
      })}
    </div>
  );
}
