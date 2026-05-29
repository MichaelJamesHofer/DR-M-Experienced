import Link from "next/link";
import { BLOG_POSTS } from "@/data/blog";

export const metadata = {
  title: "Blog",
  description:
    "Short clinical essays from DrMExperienced on complex cases, concussion, memory, and functional medicine sequencing.",
};

export default function BlogPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Blog
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Short clinical essays connected to the podcast
        </h1>
        <p className="text-body-lg text-foreground-muted max-w-2xl">
          A concise article layer for listeners who want the core reasoning before choosing an episode, consultation path, or speaking inquiry.
        </p>
      </div>
      <div className="grid gap-6">
        {BLOG_POSTS.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group block rounded-2xl border border-border bg-surface p-6 transition hover:-translate-y-1 hover:border-primary/50 hover:shadow-glow-sm"
          >
            <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">{post.category}</p>
            <h2 className="text-heading-lg font-bold text-foreground mb-3">{post.title}</h2>
            <p className="text-body text-foreground-muted">{post.excerpt}</p>
            <p className="mt-5 text-body-sm font-semibold text-primary transition group-hover:text-primary-hover">
              Read essay
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
