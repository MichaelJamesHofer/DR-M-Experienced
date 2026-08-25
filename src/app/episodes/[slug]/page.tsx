import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, ExternalLink, Lightbulb, Play } from "lucide-react";
import { episodeDisplayTitle } from "@/data/episodes";
import {
  AFFILIATE_DISCLOSURE,
  AffiliateProduct,
  affiliateDisplayName,
  affiliateProductsForEpisode,
} from "@/data/affiliates";
import { getContentCatalog } from "@/data/content-catalog";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { EpisodeTopicRail } from "@/components/episode-topic-rail";
import { VimeoPlayer } from "@/components/vimeo-player";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export async function generateStaticParams() {
  const { episodes } = await getContentCatalog();
  return episodes.map((episode) => ({ slug: episode.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { episodes } = await getContentCatalog();
  const episode = episodes.find((item) => item.slug === slug);
  if (!episode) {
    return { title: "Episode not found" };
  }

  const title = episodeDisplayTitle(episode);
  const canonicalPath = `/episodes/${episode.slug}/`;
  const images = episode.thumbnailUrl
    ? [{ url: episode.thumbnailUrl, alt: title }]
    : undefined;

  return {
    title,
    description: episode.summary,
    alternates: {
      canonical: canonicalPath,
    },
    openGraph: {
      title,
      description: episode.summary,
      url: canonicalPath,
      type: "article",
      publishedTime: `${episode.publishDate}T00:00:00Z`,
      images,
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description: episode.summary,
      images: images?.map((image) => image.url),
    },
  };
}

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { episodes, affiliateProducts, blogPosts } = await getContentCatalog();
  const episode = episodes.find((item) => item.slug === slug);
  if (!episode) {
    notFound();
  }

  const publishDate = dateFormatter.format(new Date(episode.publishDate));
  const related = episodes.filter(
    (item) =>
      item.slug !== episode.slug && item.topics.some((topic) => episode.topics.includes(topic))
  ).slice(0, 3);
  const relatedAffiliateProducts = affiliateProductsForEpisode(episode, affiliateProducts);
  const relatedBlogPosts = blogPosts
    .filter((post) => post.relatedEpisodeSlugs?.includes(episode.slug))
    .slice(0, 3);

  const hasComingSoonReference = episode.references?.some((ref) => ref.comingSoon === true);

  const episodesChronological = [...episodes].sort((a, b) => {
    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.number - b.number;
  });
  const currentIndex = episodesChronological.findIndex((ep) => ep.slug === episode.slug);
  const prevEpisode = currentIndex > 0 ? episodesChronological[currentIndex - 1] : null;
  const nextEpisode =
    currentIndex >= 0 && currentIndex < episodesChronological.length - 1
      ? episodesChronological[currentIndex + 1]
      : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-14">
      {/* Breadcrumb */}
      <nav className="mb-6 flex min-h-11 items-center gap-2 text-body-sm text-foreground-muted">
        <Link href="/" className="inline-flex min-h-11 items-center px-1 transition-colors duration-200 hover:text-foreground">
          Home
        </Link>
        <span>/</span>
        <Link href="/episodes" className="inline-flex min-h-11 items-center transition-colors duration-200 hover:text-foreground">
          Episodes
        </Link>
        <span>/</span>
        <span className="text-foreground line-clamp-2">{episodeDisplayTitle(episode)}</span>
      </nav>

      <div className="grid min-w-0 gap-12 lg:grid-cols-3">
        {/* Main Content */}
        <div className="min-w-0 space-y-10 lg:col-span-2">
          {/* Header */}
          <header className="min-w-0">
            <div className="mb-4 flex min-h-11 items-center gap-3 text-body-sm text-foreground-muted">
              <span>{publishDate}</span>
              {episode.durationMinutes && (
                <span className="flex items-center gap-1.5">
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                  {episode.durationMinutes} min
                </span>
              )}
            </div>
            <h1 className="mb-4 break-words text-[1.875rem] font-bold !tracking-normal leading-tight text-foreground min-[375px]:text-[2.25rem] sm:text-display">
              {episodeDisplayTitle(episode)}
            </h1>
            <p className="text-body-lg text-foreground-muted">
              {episode.summary}
            </p>
            <EpisodeTopicRail topics={episode.topics} />
          </header>

          {/* Video Player */}
          <section
            aria-labelledby={`video-player-${episode.slug}`}
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
              <div>
                <h2
                  id={`video-player-${episode.slug}`}
                  className="text-body-sm font-semibold text-foreground"
                >
                  Watch the video
                </h2>
                <p className="mt-1 text-caption text-foreground-muted">
                  Select play to load the video and access its playback controls.
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-border bg-background px-3 py-1 text-caption font-semibold uppercase tracking-wider text-foreground-muted">
                Video
              </span>
            </div>
            {episode.vimeoId ? (
              <VimeoPlayer
                videoId={episode.vimeoId}
                title={episodeDisplayTitle(episode)}
                thumbnailUrl={episode.thumbnailUrl}
                className="w-full"
              />
            ) : (
              <div className="aspect-video bg-gradient-to-br from-surface to-surface-elevated flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                {episode.thumbnailUrl ? (
                  <>
                    <Image
                      src={episode.thumbnailUrl}
                      alt={episodeDisplayTitle(episode)}
                      fill
                      className="object-cover opacity-50"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent" />
                    {hasComingSoonReference && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
                        <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-primary/30 bg-primary/20 text-primary">
                          <Clock3 className="h-8 w-8" aria-hidden="true" />
                        </div>
                        <div className="text-center px-4">
                          <p className="text-body font-semibold text-foreground mb-1">
                            Video Coming Soon
                          </p>
                          <p className="text-body-sm text-foreground-muted">
                            Vimeo upload in progress
                          </p>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <Play className="h-8 w-8 fill-current" aria-hidden="true" />
                    </div>
                    <p className="text-body-sm text-foreground-muted">
                      Episode player coming soon
                    </p>
                  </>
                )}
              </div>
            )}
            {hasComingSoonReference && (
              <div className="px-4 pb-4 pt-2 border-t border-border bg-surface">
                <p className="text-body-xs text-foreground-subtle">
                  Vimeo video for this episode is <span className="font-semibold">coming soon</span>.
                </p>
              </div>
            )}
            {episode.references && episode.references.length > 0 && (
              <nav
                aria-label="Episode listening and viewing platforms"
                className="border-t border-border bg-surface-elevated p-4 sm:p-5"
              >
                <p className="mb-4 text-center text-body-sm font-semibold text-foreground">
                  Listen or watch
                </p>
                <ul className="mx-auto grid max-w-3xl grid-cols-1 gap-2 min-[360px]:grid-cols-2 md:grid-cols-4">
                  {episode.references.map((ref, index) => {
                    const isComingSoon = ref.comingSoon === true;
                    if (isComingSoon) {
                      return (
                        <li key={`${ref.label}-${index}`}>
                          <span
                            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md border border-dashed border-border bg-surface px-3 py-2 text-center text-body-sm font-medium leading-snug text-foreground-subtle opacity-60"
                            title="Coming soon"
                            aria-disabled="true"
                          >
                            <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                            {ref.label}
                          </span>
                        </li>
                      );
                    }
                    return (
                      <li key={`${ref.url}-${index}`}>
                        <a
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-center text-body-sm font-semibold leading-snug text-foreground-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:text-primary focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 motion-reduce:transform-none motion-reduce:transition-none"
                        >
                          <span>{ref.label}</span>
                          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                          <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </section>

          {(episode.audioUrl || episode.spotifyId) && (
            <section
              aria-labelledby={`audio-player-${episode.slug}`}
              className="rounded-lg border border-primary/25 bg-surface-elevated p-5 shadow-sm sm:p-6"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l11-2v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm11-2c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2z" />
                    </svg>
                  </span>
                  <div className="min-w-0">
                    <h2
                      id={`audio-player-${episode.slug}`}
                      className="text-heading font-semibold text-foreground"
                    >
                      Listen to the audio edition
                    </h2>
                    <p className="mt-1 text-body-sm text-foreground-muted">
                      This audio player is separate from the video above.
                    </p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-caption font-semibold uppercase tracking-wider text-primary">
                  Audio
                </span>
              </div>
              {episode.audioUrl ? (
                <audio
                  aria-label={`Audio edition: ${episodeDisplayTitle(episode)}`}
                  controls
                  preload="none"
                  className="min-w-0 w-full max-w-full"
                  src={episode.audioUrl}
                >
                  Your browser does not support audio.
                </audio>
              ) : episode.spotifyId ? (
                <iframe
                  title={`Listen: ${episodeDisplayTitle(episode)}`}
                  src={`https://open.spotify.com/embed/episode/${episode.spotifyId}?utm_source=generator`}
                  width="100%"
                  height="232"
                  allowFullScreen
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="rounded-lg"
                />
              ) : null}
            </section>
          )}

          {/* Key Takeaways */}
          <section className="border-y border-border py-6 sm:py-8">
            <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
              <Lightbulb className="h-6 w-6 text-primary" aria-hidden="true" />
              Key takeaways
            </h2>
            <ul className="space-y-4">
              {episode.keyTakeaways.map((takeaway, index) => (
                <li key={index} className="flex gap-4">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-bold text-primary">
                    {index + 1}
                  </span>
                  <span className="text-body text-foreground-muted">{takeaway}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Checklist */}
          {episode.checklist && episode.checklist.length > 0 && (
            <section className="border-y border-success/30 py-6 sm:py-8">
              <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
                <CheckCircle2 className="h-6 w-6 text-success" aria-hidden="true" />
                Order-of-operations checklist
              </h2>
              <ul className="space-y-3">
                {episode.checklist.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                    <span className="text-body text-foreground-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Show Notes / Sections */}
          {episode.sections.length > 0 && (
            <section className="space-y-6">
              <h2 className="text-heading-lg font-bold text-foreground">Show notes</h2>
              {episode.sections.map((section, index) => (
                <div key={index} className="border-t border-border pt-6">
                  <h3 className="text-heading font-semibold text-foreground mb-4">
                    {section.title}
                  </h3>
                  <div className="space-y-3">
                    {section.content.map((paragraph, pIndex) => (
                      <p key={pIndex} className="text-body text-foreground-muted">
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* Related Affiliate Products */}
          {relatedAffiliateProducts.length > 0 && (
            <section className="rounded-lg border border-border bg-surface p-8">
              <div className="mb-6">
                <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
                  Affiliate guide
                </p>
                <h2 className="text-heading-lg font-bold text-foreground">
                  Products referenced in this episode
                </h2>
                <p className="mt-3 text-body-sm text-foreground-muted">
                  {AFFILIATE_DISCLOSURE}
                </p>
              </div>
              <div className="space-y-4">
                {relatedAffiliateProducts.map((product) => (
                  <EpisodeAffiliateCard key={product.slug} product={product} />
                ))}
              </div>
            </section>
          )}

          {/* Episode Navigation */}
          <div className="flex items-center justify-between pt-8 border-t border-border">
            {prevEpisode ? (
              <Link
                href={`/episodes/${prevEpisode.slug}`}
                className="group flex min-h-12 items-center gap-3 text-foreground-muted transition-colors duration-200 hover:text-foreground"
              >
                <ArrowLeft className="h-5 w-5 transition-transform duration-200 group-hover:-translate-x-1" aria-hidden="true" />
                <div className="text-left min-w-0">
                  <p className="text-caption text-foreground-subtle">Previous</p>
                  <p className="text-body-sm font-medium line-clamp-2">{episodeDisplayTitle(prevEpisode)}</p>
                </div>
              </Link>
            ) : (
              <div />
            )}
            {nextEpisode ? (
              <Link
                href={`/episodes/${nextEpisode.slug}`}
                className="group flex min-h-12 items-center gap-3 text-foreground-muted transition-colors duration-200 hover:text-foreground"
              >
                <div className="text-right min-w-0">
                  <p className="text-caption text-foreground-subtle">Next</p>
                  <p className="text-body-sm font-medium line-clamp-2">{episodeDisplayTitle(nextEpisode)}</p>
                </div>
                <ArrowRight className="h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-8">
          {/* Newsletter */}
          <NewsletterCapture
            variant="inline"
            heading="Get episode notes"
            description="Weekly protocols delivered to your inbox."
          />

          {/* Disclaimer */}
          <div className="rounded-lg border border-dashed border-border bg-surface p-6">
            <p className="text-body-sm font-semibold text-foreground mb-2">
              Educational only
            </p>
            <p className="text-body-sm text-foreground-muted">
              This episode does not provide medical advice. Consult your clinician 
              before acting on any protocols discussed.
            </p>
          </div>

          {/* Related Episodes */}
          {related.length > 0 && (
            <div>
              <h3 className="text-heading font-semibold text-foreground mb-4">
                Related episodes
              </h3>
              <div className="space-y-3">
                {related.map((ep) => (
                  <Link
                    key={ep.slug}
                    href={`/episodes/${ep.slug}`}
                    className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 transition-all duration-200"
                  >
                    <p className="text-body-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-3">
                      {episodeDisplayTitle(ep)}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Related Blog Posts */}
          {relatedBlogPosts.length > 0 && (
            <div>
              <h3 className="text-heading font-semibold text-foreground mb-4">
                Related blog notes
              </h3>
              <div className="space-y-3">
                {relatedBlogPosts.map((post) => (
                  <Link
                    key={post.slug}
                    href={`/blogs/${post.slug}`}
                    className="group block rounded-lg border border-border bg-surface p-4 hover:border-primary/50 transition-all duration-200"
                  >
                    <p className="text-body-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-3">
                      {post.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function EpisodeAffiliateCard({ product }: { product: AffiliateProduct }) {
  const productUrl = product.affiliateUrl ?? product.directUrl;
  const companyName = affiliateDisplayName(product);

  return (
    <article className="rounded-lg border border-border bg-background p-5">
      <div className="mb-4">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          {product.category}
        </p>
        <h3 className="text-heading font-semibold text-foreground">{companyName}</h3>
        {product.brand && (
          <p className="mt-1 text-body-sm font-semibold text-foreground-muted">
            {product.name}
          </p>
        )}
        <p className="mt-3 text-body-sm text-foreground-muted">{product.summary}</p>
      </div>

      <div className="mb-5 flex flex-col gap-3 border-y border-border py-4 sm:flex-row sm:items-center sm:justify-between">
        {(product.couponCode || product.discountNote || product.purchaseNote) && (
          <div className="space-y-1 text-body-sm text-foreground-muted">
            {product.couponCode && (
              <p>
                Code: <span className="font-semibold text-foreground">{product.couponCode}</span>
              </p>
            )}
            {product.discountNote && <p>{product.discountNote}</p>}
            {product.purchaseNote && <p>{product.purchaseNote}</p>}
          </div>
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href={`/affiliates#${product.slug}`}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-body-sm font-semibold text-foreground-muted transition-colors duration-200 hover:border-primary hover:text-primary"
          >
            Guide notes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-background transition-colors duration-200 hover:bg-primary-hover"
            >
              View products
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
            </a>
          )}
        </div>
      </div>

      {(product.featuredProducts?.length ?? 0) > 0 && (
        <div className="mb-4">
          <p className="text-body-sm font-semibold text-foreground mb-2">
            Products Dr. M mentioned
          </p>
          <div className="flex flex-wrap gap-2">
            {product.featuredProducts!.slice(0, 8).map((item) => (
              <span
                key={item}
                className="rounded-lg border border-border bg-surface px-3 py-1.5 text-caption font-medium text-foreground-muted"
              >
                {item}
              </span>
            ))}
            {product.featuredProducts!.length > 8 && (
              <Link
                href={`/affiliates#${product.slug}`}
                className="inline-flex min-h-11 items-center rounded-lg border border-border bg-surface px-3 py-2 text-caption font-semibold text-primary transition-colors duration-200 hover:border-primary"
              >
                +{product.featuredProducts!.length - 8} more
              </Link>
            )}
          </div>
        </div>
      )}

      {product.cautionNote && (
        <div className="mb-4 border-l-2 border-warning/60 pl-4">
          <p className="text-body-sm font-semibold text-foreground mb-2">Clinical boundary</p>
          <p className="text-body-sm text-foreground-muted">{product.cautionNote}</p>
        </div>
      )}

      {(product.tags?.length ?? 0) > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {product.tags!.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

    </article>
  );
}
