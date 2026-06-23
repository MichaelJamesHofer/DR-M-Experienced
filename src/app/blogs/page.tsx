import { Suspense } from "react";
import { BlogBrowser } from "@/components/blog-browser";
import { getContentCatalog } from "@/data/content-catalog";

export const metadata = {
  title: "Blogs",
  description:
    "Read Dr. M's long-form notes, clinical explainers, episode expansions, and practical functional medicine frameworks.",
};

export default async function BlogsPage() {
  const { blogPosts } = await getContentCatalog();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <div className="mb-12">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Blog library
        </p>
        <h1 className="mb-4 text-display font-bold text-foreground">Blogs</h1>
        <p className="max-w-2xl text-body-lg text-foreground-muted">
          Long-form notes for topics that need more room than an episode card: practical
          explainers, order-of-operations frameworks, and follow-up context from Dr. M&apos;s
          functional and sports medicine work.
        </p>
      </div>

      <Suspense fallback={<BlogBrowserSkeleton />}>
        <BlogBrowser posts={blogPosts} />
      </Suspense>
    </div>
  );
}

function BlogBrowserSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <div className="mb-4 h-12 rounded-xl bg-surface-elevated animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-10 w-24 rounded-full bg-surface-elevated animate-pulse" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2].map((item) => (
          <div key={item} className="rounded-2xl border border-border bg-surface p-6">
            <div className="mb-4 h-6 w-24 rounded bg-surface-elevated animate-pulse" />
            <div className="mb-3 h-7 w-3/4 rounded bg-surface-elevated animate-pulse" />
            <div className="mb-4 h-20 rounded bg-surface-elevated animate-pulse" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
