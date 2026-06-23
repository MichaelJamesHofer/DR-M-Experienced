import { Metadata } from "next";
import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AFFILIATE_DISCLOSURE,
  affiliateDisplayName,
  type AffiliateProduct,
} from "@/data/affiliates";
import { BLOG_EMPTY_STATIC_SLUG, blogTopicLabel } from "@/data/blogs";
import { getContentCatalog } from "@/data/content-catalog";
import { episodeDisplayTitle, type Episode } from "@/data/episodes";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { siteImageSrc } from "@/lib/site-images";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export const dynamicParams = false;

export async function generateStaticParams() {
  const { blogPosts } = await getContentCatalog();
  if (blogPosts.length === 0) {
    return [{ slug: BLOG_EMPTY_STATIC_SLUG }];
  }

  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { blogPosts } = await getContentCatalog();
  const post = blogPosts.find((item) => item.slug === slug);
  if (!post && slug === BLOG_EMPTY_STATIC_SLUG) {
    return {
      title: "Blogs coming soon",
      description: "The Dr. M's Experienced blog library is ready for published posts.",
      robots: {
        index: false,
        follow: false,
      },
    };
  }

  if (!post) {
    return { title: "Blog not found" };
  }

  return {
    title: post.title,
    description: post.metaDescription ?? post.excerpt,
  };
}

export default async function BlogDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { blogPosts, episodes, affiliateProducts } = await getContentCatalog();
  const post = blogPosts.find((item) => item.slug === slug);
  if (!post) {
    if (slug === BLOG_EMPTY_STATIC_SLUG) {
      return <EmptyBlogDetailPage />;
    }

    notFound();
  }

  const publishDate = dateFormatter.format(new Date(post.publishDate));
  const relatedEpisodes = episodes.filter((episode) =>
    post.relatedEpisodeSlugs?.includes(episode.slug)
  );
  const relatedProducts = affiliateProducts.filter((product) =>
    post.relatedAffiliateProductSlugs?.includes(product.slug)
  );
  const heroImageSrc = siteImageSrc(post.heroImageUrl);
  const relatedPosts = blogPosts
    .filter(
      (item) =>
        item.slug !== post.slug && item.topics.some((topic) => post.topics.includes(topic))
    )
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <nav className="mb-8 flex items-center gap-2 text-body-sm text-foreground-muted">
        <Link href="/" className="transition-colors duration-200 hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/blogs" className="transition-colors duration-200 hover:text-foreground">
          Blogs
        </Link>
        <span>/</span>
        <span className="line-clamp-2 text-foreground">{post.title}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-3">
        <article className="lg:col-span-2">
          <header className="mb-10">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-body-sm text-foreground-muted">
              <span>{publishDate}</span>
              {post.readingMinutes && (
                <>
                  <span>•</span>
                  <span>{post.readingMinutes} min read</span>
                </>
              )}
              <span>•</span>
              <span>{post.authorName}</span>
            </div>
            <h1 className="mb-4 text-display font-bold text-foreground">{post.title}</h1>
            {post.subtitle && (
              <p className="mb-4 text-heading-sm font-semibold text-foreground-muted">
                {post.subtitle}
              </p>
            )}
            <p className="text-body-lg text-foreground-muted">{post.excerpt}</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {post.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/blogs?topic=${encodeURIComponent(topic.toLowerCase())}`}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-body-sm text-foreground-muted transition-all duration-200 hover:border-primary hover:text-primary"
                >
                  {blogTopicLabel(topic)}
                </Link>
              ))}
            </div>
          </header>

          {heroImageSrc && (
            <div className="mb-10 overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="relative aspect-video">
                <Image src={heroImageSrc} alt={post.title} fill className="object-cover" />
              </div>
            </div>
          )}

          <div className="space-y-8">
            {post.sections.map((section, index) => (
              <section key={`${section.title}-${index}`} className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
                <h2 className="mb-4 text-heading-lg font-bold text-foreground">
                  {section.title}
                </h2>
                <div className="space-y-4">
                  {section.content.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex} className="text-body text-foreground-muted">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          {post.references && post.references.length > 0 && (
            <section className="mt-8 rounded-2xl border border-border bg-surface p-8">
              <h2 className="mb-6 text-heading-lg font-bold text-foreground">
                References & resources
              </h2>
              <ul className="space-y-3">
                {post.references.map((reference) => (
                  <li key={reference.url}>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-body text-primary transition-colors duration-200 hover:text-primary-hover"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {reference.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>

        <aside className="space-y-8">
          <NewsletterCapture
            variant="inline"
            heading="Get new notes"
            description="Practical frameworks and episode follow-up in your inbox."
          />

          <div className="rounded-2xl border border-dashed border-border bg-surface p-6">
            <p className="mb-2 text-body-sm font-semibold text-foreground">Educational only</p>
            <p className="text-body-sm text-foreground-muted">
              Blog content is educational and does not provide medical advice. Work with your own
              clinician for diagnosis and treatment.
            </p>
          </div>

          {relatedEpisodes.length > 0 && (
            <RelatedList title="Related episodes">
              {relatedEpisodes.map((episode) => (
                <RelatedEpisodeLink key={episode.slug} episode={episode} />
              ))}
            </RelatedList>
          )}

          {relatedProducts.length > 0 && (
            <RelatedList
              title="Related resources"
              note={AFFILIATE_DISCLOSURE}
            >
              {relatedProducts.map((product) => (
                <RelatedProductLink key={product.slug} product={product} />
              ))}
            </RelatedList>
          )}

          {relatedPosts.length > 0 && (
            <RelatedList title="Related blog notes">
              {relatedPosts.map((relatedPost) => (
                <Link
                  key={relatedPost.slug}
                  href={`/blogs/${relatedPost.slug}`}
                  className="group block rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-primary/50"
                >
                  <p className="line-clamp-3 text-body-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                    {relatedPost.title}
                  </p>
                </Link>
              ))}
            </RelatedList>
          )}
        </aside>
      </div>
    </div>
  );
}

function EmptyBlogDetailPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <nav className="mb-8 flex items-center gap-2 text-body-sm text-foreground-muted">
        <Link href="/" className="transition-colors duration-200 hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/blogs" className="transition-colors duration-200 hover:text-foreground">
          Blogs
        </Link>
      </nav>

      <section className="rounded-3xl border border-dashed border-border bg-surface p-8 text-center sm:p-12">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Blog library
        </p>
        <h1 className="mb-4 text-display font-bold text-foreground">Blogs are ready for content</h1>
        <p className="mx-auto mb-8 max-w-2xl text-body-lg text-foreground-muted">
          The site can now publish long-form notes from the content database. Published posts will
          appear in the blog library after they are added.
        </p>
        <Link
          href="/blogs"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-body-sm font-semibold text-background transition-all duration-200 hover:bg-primary-hover"
        >
          Back to blogs
        </Link>
      </section>
    </div>
  );
}

function RelatedList({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-4 text-heading font-semibold text-foreground">{title}</h2>
      {note && <p className="mb-4 text-body-xs text-foreground-subtle">{note}</p>}
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function RelatedEpisodeLink({ episode }: { episode: Episode }) {
  return (
    <Link
      href={`/episodes/${episode.slug}`}
      className="group block rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-primary/50"
    >
      <p className="line-clamp-3 text-body-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
        {episodeDisplayTitle(episode)}
      </p>
    </Link>
  );
}

function RelatedProductLink({ product }: { product: AffiliateProduct }) {
  return (
    <Link
      href={`/affiliates#${product.slug}`}
      className="group block rounded-xl border border-border bg-surface p-4 transition-all duration-200 hover:border-primary/50"
    >
      <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-primary">
        {product.category}
      </p>
      <p className="line-clamp-3 text-body-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
        {affiliateDisplayName(product)}
      </p>
    </Link>
  );
}
