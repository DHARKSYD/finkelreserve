import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { readingMinutes, type BlogPost } from "@/content/blog/types";

export function PostCard({ post, large = false }: { post: BlogPost; large?: boolean }) {
  return (
    <Link
      to="/blog/$slug"
      params={{ slug: post.slug }}
      className={`group flex h-full flex-col glass rounded-2xl p-6 transition hover:-translate-y-0.5 hover:shadow-glow ${
        large ? "md:p-10" : ""
      }`}
    >
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">— {post.category}</p>
      <h3
        className={`mt-3 font-display font-black tracking-tight leading-[1.1] ${
          large ? "text-3xl md:text-5xl" : "text-2xl"
        }`}
      >
        {post.title}
      </h3>
      <p
        className={`mt-3 text-muted-foreground leading-relaxed ${large ? "max-w-2xl md:text-lg" : "text-sm"}`}
      >
        {post.excerpt}
      </p>
      <p className="mt-auto pt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
        {readingMinutes(post)} min read
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
      </p>
    </Link>
  );
}
