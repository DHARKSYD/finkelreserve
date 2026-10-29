import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Layout } from "@/components/Layout";
import { PostCard } from "@/components/blog/PostCard";
import { CATEGORIES, POSTS } from "@/content/blog";
import type { BlogCategory } from "@/content/blog/types";

export const Route = createFileRoute("/blog/")({
  head: () => ({
    meta: [
      { title: "The Wine Guide — How Wine Is Made, Served & Paired | Finkel Reserve" },
      {
        name: "description",
        content:
          "How red, white, rosé and sparkling wine are made, how to store and serve wine in Nigeria's heat, and what to pour with jollof, suya and pepper soup.",
      },
    ],
  }),
  component: BlogIndex,
});

function BlogIndex() {
  const [category, setCategory] = useState<BlogCategory | "all">("all");
  const posts = category === "all" ? POSTS : POSTS.filter((p) => p.category === category);
  const [featured, ...rest] = posts;

  return (
    <Layout>
      <div className="pt-32" />
      <section className="mx-auto max-w-[1400px] px-6 md:px-10">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
          — The Wine Guide
        </p>
        <h1 className="mt-3 max-w-4xl font-display font-black text-5xl md:text-7xl leading-[1.02] tracking-tight">
          Know your wine, <span className="text-gradient-wine">glass by glass.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          How wine is made, how to keep and serve it in Nigeria's heat, and what to pour with the
          food you actually eat — in plain language.
        </p>

        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Filter articles">
          {(["all", ...CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              aria-pressed={category === c}
              className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                category === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {c === "all" ? "All articles" : c}
            </button>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-10 max-w-[1400px] px-6 pb-24 md:px-10">
        {featured && (
          <div className="mb-6">
            <PostCard post={featured} large />
          </div>
        )}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </section>
    </Layout>
  );
}
