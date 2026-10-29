import type { ProductType } from "@/lib/products";

/**
 * The Wine Guide's content model. Articles are typed data rather than
 * Markdown/HTML: nothing is parsed or injected as markup, so there is no XSS
 * surface, no extra dependency, and the compiler checks every article.
 *
 * Inline emphasis: wrap text in **double asterisks** for bold (see PostBody).
 * To add an article: create a file in ./posts, then register it in ./index.ts.
 */
export type Block =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  /** A numbered process, rendered as a vertical timeline. */
  | { type: "steps"; items: { title: string; text: string }[] }
  /** Label/value pairs in a card — quick facts, temperatures, dish → wine matches. */
  | { type: "facts"; title?: string; items: { label: string; value: string }[] }
  | { type: "callout"; title?: string; text: string }
  /** Link into the shop, pre-filtered to a wine style. */
  | { type: "shop"; productType: ProductType; label: string };

export type BlogCategory = "How it's made" | "Serving & storing" | "Food & wine";

export type BlogPost = {
  slug: string;
  title: string;
  /** Shown on cards and used as the meta description — keep it under ~160 characters. */
  excerpt: string;
  category: BlogCategory;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt?: string;
  blocks: Block[];
};

const stripBold = (s: string) => s.replace(/\*\*/g, "");

function blockText(b: Block): string {
  switch (b.type) {
    case "p":
    case "h2":
    case "h3":
      return stripBold(b.text);
    case "ul":
    case "ol":
      return b.items.map(stripBold).join(" ");
    case "steps":
      return b.items.map((i) => `${i.title} ${stripBold(i.text)}`).join(" ");
    case "facts":
      return b.items.map((i) => `${i.label} ${i.value}`).join(" ");
    case "callout":
      return `${b.title ?? ""} ${stripBold(b.text)}`;
    case "shop":
      return "";
  }
}

/** Reading time at ~200 words a minute, never less than a minute. */
export function readingMinutes(post: BlogPost): number {
  const words = post.blocks.map(blockText).join(" ").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** URL-safe anchor for a heading ("Where the styles split" → "where-the-styles-split"). */
export function headingId(text: string): string {
  return stripBold(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function postHeadings(post: BlogPost): { id: string; text: string }[] {
  return post.blocks
    .filter((b): b is Extract<Block, { type: "h2" }> => b.type === "h2")
    .map((b) => ({ id: headingId(b.text), text: stripBold(b.text) }));
}
