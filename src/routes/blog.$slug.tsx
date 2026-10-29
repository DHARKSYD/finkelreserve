import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Layout } from "@/components/Layout";
import { PostBody } from "@/components/blog/PostBody";
import { PostCard } from "@/components/blog/PostCard";
import { getPost, relatedPosts } from "@/content/blog";
import { postHeadings, readingMinutes } from "@/content/blog/types";

// Dates are rendered in UTC so the server and the browser always agree (no hydration mismatch).
const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-NG", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export const Route = createFileRoute("/blog/$slug")({
  loader: ({ params }) => {
    const post = getPost(params.slug);
    if (!post) throw notFound();
    return { post };
  },
  head: ({ loaderData }) => {
    const post = loaderData?.post;
    if (!post) return {};
    return {
      meta: [
        { title: `${post.title} | Finkel Reserve Wine Guide` },
        { name: "description", content: post.excerpt },
        { property: "og:title", content: post.title },
        { property: "og:description", content: post.excerpt },
        { property: "og:type", content: "article" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: post.title,
            description: post.excerpt,
            datePublished: post.publishedAt,
            dateModified: post.updatedAt ?? post.publishedAt,
            author: { "@type": "Organization", name: "Finkel Reserve" },
            publisher: { "@type": "Organization", name: "Finkel Reserve" },
          }),
        },
      ],
    };
  },
  component: BlogPostPage,
  notFoundComponent: () => (
    <Layout>
      <div className="mx-auto max-w-xl px-6 pt-40 pb-32 text-center">
        <h1 className="font-display font-black text-4xl">That article isn't here</h1>
        <p className="mt-3 text-muted-foreground">
          It may have moved. The full Wine Guide is one click away.
        </p>
        <Link
          to="/blog"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-bold text-primary-foreground"
        >
          Back to the Wine Guide
        </Link>
      </div>
    </Layout>
  ),
});

function BlogPostPage() {
  const { post } = Route.useLoaderData();
  const headings = postHeadings(post);
  const related = relatedPosts(post.slug, 3);

  const toc = (
    <ul className="space-y-2 text-sm">
      {headings.map((h) => (
        <li key={h.id}>
          <a href={`#${h.id}`} className="text-muted-foreground transition hover:text-primary">
            {h.text}
          </a>
        </li>
      ))}
    </ul>
  );

  return (
    <Layout>
      <div className="pt-32" />
      <article className="mx-auto max-w-[1400px] px-6 md:px-10">
        <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
          <Link to="/blog" className="hover:text-primary">
            Wine Guide
          </Link>
          <span aria-hidden> / </span>
          <span>{post.category}</span>
        </nav>

        <header className="mt-6 max-w-3xl">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-primary">
            — {post.category}
          </p>
          <h1 className="mt-3 font-display font-black text-4xl md:text-6xl leading-[1.05] tracking-tight">
            {post.title}
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground md:text-xl">
            {post.excerpt}
          </p>
          <p className="mt-6 text-sm text-muted-foreground">
            {readingMinutes(post)} min read · Updated{" "}
            {formatDate(post.updatedAt ?? post.publishedAt)}
          </p>
        </header>

        <div className="mt-12 grid gap-12 lg:grid-cols-[minmax(0,44rem)_1fr]">
          <div>
            {headings.length > 1 && (
              <nav aria-label="In this article" className="glass mb-8 rounded-2xl p-5 lg:hidden">
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  — In this article
                </p>
                {toc}
              </nav>
            )}
            <PostBody blocks={post.blocks} />
            <p className="mt-12 border-t border-border/50 pt-6 text-xs text-muted-foreground">
              Wine is for adults aged 18 and over. Please drink responsibly.
            </p>
          </div>
          {headings.length > 1 && (
            <aside className="hidden lg:block">
              <nav aria-label="In this article" className="sticky top-28">
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-primary">
                  — In this article
                </p>
                {toc}
              </nav>
            </aside>
          )}
        </div>
      </article>

      <section className="mx-auto mt-24 max-w-[1400px] px-6 md:px-10">
        <h2 className="font-display font-black text-3xl tracking-tight">Keep reading</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {related.map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </section>

      <section className="mx-auto mt-20 max-w-[1400px] px-6 pb-24 md:px-10">
        <div className="rounded-3xl bg-wine p-8 text-primary-foreground md:p-12">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-accent">
            — Ready to taste?
          </p>
          <h2 className="mt-3 max-w-2xl font-display font-black text-3xl leading-tight md:text-5xl">
            Put what you've learned in a glass.
          </h2>
          <Link
            to="/shop"
            className="group mt-8 inline-flex items-center gap-3 rounded-full bg-primary-foreground px-7 py-4 text-sm font-bold text-primary transition hover:bg-accent hover:text-accent-foreground"
          >
            Browse the collection
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </section>
    </Layout>
  );
}
