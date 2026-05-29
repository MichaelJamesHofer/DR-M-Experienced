import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG_POSTS } from "@/data/blog";

type BlogPostPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

function findPost(slug: string) {
  return BLOG_POSTS.find((post) => post.slug === slug);
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({
    slug: post.slug,
  }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = findPost(slug);

  if (!post) {
    return {
      title: "Article not found",
    };
  }

  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = findPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-4xl px-4 py-12 lg:px-6 lg:py-16">
      <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">{post.category}</p>
      <h1 className="text-display font-bold text-foreground mb-5">{post.title}</h1>
      <p className="text-body-lg text-foreground-muted mb-10">{post.excerpt}</p>

      <div className="space-y-5">
        {post.sections.map((section) => (
          <section key={section.heading} className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-heading font-semibold text-foreground mb-3">{section.heading}</h2>
            <p className="text-body text-foreground-muted">{section.body}</p>
          </section>
        ))}
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/episodes"
          className="rounded-full bg-primary px-5 py-3 text-body-sm font-semibold text-background transition hover:bg-primary-hover"
        >
          Browse episodes
        </Link>
        <Link
          href="https://peakmedicine.com/contact"
          className="rounded-full border border-border px-5 py-3 text-body-sm font-semibold text-foreground-muted transition hover:border-primary hover:text-primary"
        >
          Consultation inquiries
        </Link>
      </div>
    </article>
  );
}
