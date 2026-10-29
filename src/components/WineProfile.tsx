import type { Product } from "@/lib/products";

/**
 * The long-form wine description on the product page: a sommelier-style
 * tasting breakdown, how to serve and keep it, and who made it and how.
 *
 * Every field is optional and the section renders only what's filled in, so a
 * half-written profile reads as a shorter page rather than a broken one. It
 * sits below the buy box (not inside it) so reading doesn't push "Add to
 * cart" off screen.
 */
type Props = {
  product: Pick<
    Product,
    | "appearance"
    | "nose"
    | "palate"
    | "finish"
    | "servingNotes"
    | "cellaringNotes"
    | "producerNotes"
    | "winemakingNotes"
    | "producer"
  >;
};

const EYEBROW = "text-xs uppercase tracking-[0.2em] text-primary mb-3 font-mono";

/** Blank-line separated text → paragraphs (admins write these in a plain textarea). */
function Prose({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm text-foreground/85 leading-relaxed">
      {text
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p, i) => (
          <p key={i}>{p}</p>
        ))}
    </div>
  );
}

export function WineProfile({ product }: Props) {
  const tasting = [
    { label: "Appearance", text: product.appearance },
    { label: "Nose", text: product.nose },
    { label: "Palate", text: product.palate },
    { label: "Finish", text: product.finish },
  ].filter((r): r is { label: string; text: string } => Boolean(r.text?.trim()));

  const hasLeft = tasting.length > 0 || product.servingNotes || product.cellaringNotes;
  const hasRight = product.producerNotes || product.winemakingNotes;
  if (!hasLeft && !hasRight) return null;

  return (
    <section className="mt-20" aria-labelledby="wine-profile-heading">
      <p className="text-xs uppercase tracking-[0.3em] text-primary font-mono">— The details</p>
      <h2
        id="wine-profile-heading"
        className="mt-2 font-display font-black text-3xl md:text-4xl tracking-tight"
      >
        About this bottle
      </h2>

      <div className="mt-8 grid gap-5 lg:grid-cols-12">
        {hasLeft && (
          <div className={`space-y-5 ${hasRight ? "lg:col-span-7" : "lg:col-span-12"}`}>
            {tasting.length > 0 && (
              <div className="glass rounded-2xl p-6">
                <p className={EYEBROW}>— Tasting profile</p>
                <dl className="divide-y divide-border/50">
                  {tasting.map((r) => (
                    <div
                      key={r.label}
                      className="grid sm:grid-cols-[8rem_1fr] gap-1 sm:gap-4 py-3 first:pt-0 last:pb-0"
                    >
                      <dt className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground pt-0.5">
                        {r.label}
                      </dt>
                      <dd className="text-sm text-foreground/85 leading-relaxed">{r.text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            {(product.servingNotes || product.cellaringNotes) && (
              <div className="grid sm:grid-cols-2 gap-5">
                {product.servingNotes && (
                  <div className="glass rounded-2xl p-6">
                    <p className={EYEBROW}>— Serving</p>
                    <Prose text={product.servingNotes} />
                  </div>
                )}
                {product.cellaringNotes && (
                  <div className="glass rounded-2xl p-6">
                    <p className={EYEBROW}>— Cellaring</p>
                    <Prose text={product.cellaringNotes} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {hasRight && (
          <div className={`space-y-5 ${hasLeft ? "lg:col-span-5" : "lg:col-span-12"}`}>
            {product.producerNotes && (
              <div className="glass rounded-2xl p-6">
                <p className={EYEBROW}>— About {product.producer}</p>
                <Prose text={product.producerNotes} />
              </div>
            )}
            {product.winemakingNotes && (
              <div className="glass rounded-2xl p-6">
                <p className={EYEBROW}>— How it's made</p>
                <Prose text={product.winemakingNotes} />
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
