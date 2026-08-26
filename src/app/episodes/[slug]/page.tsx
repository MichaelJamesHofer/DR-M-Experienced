import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import type { CSSProperties } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Lightbulb,
  ListChecks,
  NotebookText,
  Play,
  ShoppingBag,
  Video,
  Volume2,
} from "lucide-react";
import { episodeDisplayTitle, type EpisodeReference } from "@/data/episodes";
import {
  AFFILIATE_DISCLOSURE,
  AffiliateProduct,
  affiliateDisplayName,
  affiliateProductsForEpisode,
} from "@/data/affiliates";
import { getContentCatalog } from "@/data/content-catalog";
import { groupEpisodeReferences } from "@/data/episode-reference-groups.mjs";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { EpisodeTopicRail } from "@/components/episode-topic-rail";
import { VimeoPlayer } from "@/components/vimeo-player";
import { AnimatedDisclosure } from "@/components/animated-disclosure";

type EpisodePlatform = "Vimeo" | "Spotify" | "YouTube" | "Rumble";

const EPISODE_PLATFORM_PROFILES: Record<
  EpisodePlatform,
  { accent: string; label: string }
> = {
  Vimeo: { accent: "#1ab7ea", label: "Vimeo" },
  Spotify: { accent: "#1ed760", label: "Spotify" },
  YouTube: { accent: "#ff0000", label: "YouTube" },
  Rumble: { accent: "#85c742", label: "Rumble" },
};

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
  const knownEpisodeSlugs = new Set(episodes.map((item) => item.slug));
  const referenceGroups = groupEpisodeReferences(
    episode.references ?? [],
    knownEpisodeSlugs,
  );
  const topicRelated = episodes.filter(
    (item) =>
      item.slug !== episode.slug && item.topics.some((topic) => episode.topics.includes(topic))
  );
  const curatedRelated = referenceGroups.relatedEpisodeReferences
    .map(({ episodeSlug }) => episodes.find((item) => item.slug === episodeSlug))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const related = (curatedRelated.length > 0 ? curatedRelated : topicRelated).slice(0, 3);
  const relatedAffiliateProducts = affiliateProductsForEpisode(episode, affiliateProducts);
  const relatedAffiliateProductSlugs = new Set(
    relatedAffiliateProducts.map((product) => product.slug),
  );
  const affiliateGuideReferences = referenceGroups.affiliateReferences.filter(
    ({ productSlug }) => productSlug === null,
  );
  const unmatchedAffiliateReferences = new Set(
    referenceGroups.affiliateReferences
      .filter(
        ({ productSlug }) =>
          productSlug !== null && !relatedAffiliateProductSlugs.has(productSlug),
      )
      .map(({ reference }) => reference),
  );
  const supplementalReferences = new Set(referenceGroups.resourceReferences);
  const resourceReferences = (episode.references ?? []).filter(
    (reference) =>
      supplementalReferences.has(reference) || unmatchedAffiliateReferences.has(reference),
  );
  const relatedBlogPosts = blogPosts
    .filter((post) => post.relatedEpisodeSlugs?.includes(episode.slug))
    .slice(0, 3);

  const hasComingSoonReference = referenceGroups.platformReferences.some(
    ({ reference, platform }) => platform === "Vimeo" && reference.comingSoon === true,
  );

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
            {(relatedAffiliateProducts.length > 0 || affiliateGuideReferences.length > 0) && (
              <a
                href="#episode-affiliates"
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-body-sm font-semibold text-primary transition-all duration-300 hover:border-primary/55 hover:bg-primary/15 hover:shadow-glow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:shadow-glow-sm"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                Jump to product guide
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </a>
            )}
          </header>

          {/* Video Player */}
          <section
            aria-labelledby={`video-player-${episode.slug}`}
            className="overflow-hidden rounded-lg border border-border bg-surface"
          >
            <AnimatedDisclosure
              label={
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Video className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span
                      id={`video-player-${episode.slug}`}
                      className="block text-body font-semibold text-foreground"
                    >
                      Watch the video
                    </span>
                    <span className="mt-0.5 block text-caption font-normal text-foreground-muted">
                      Expand the embedded player
                    </span>
                  </span>
                </span>
              }
              triggerClassName="min-h-20 gap-4 px-5 py-4 sm:px-6"
              iconClassName="h-5 w-5"
            >
              <div className="border-t border-border">
                {episode.vimeoId ? (
                  <VimeoPlayer
                    videoId={episode.vimeoId}
                    title={episodeDisplayTitle(episode)}
                    thumbnailUrl={episode.thumbnailUrl}
                    className="w-full"
                  />
                ) : (
                  <div className="relative flex aspect-video flex-col items-center justify-center gap-4 overflow-hidden bg-gradient-to-br from-surface to-surface-elevated">
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
                          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
                            <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-primary/30 bg-primary/20 text-primary">
                              <Clock3 className="h-8 w-8" aria-hidden="true" />
                            </div>
                            <div className="px-4 text-center">
                              <p className="mb-1 text-body font-semibold text-foreground">
                                Video coming soon
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
                  <div className="border-t border-border bg-surface px-4 pb-4 pt-2">
                    <p className="text-body-xs text-foreground-subtle">
                      Vimeo video for this episode is <span className="font-semibold">coming soon</span>.
                    </p>
                  </div>
                )}
              </div>
            </AnimatedDisclosure>
            {referenceGroups.platformReferences.length > 0 && (
              <nav
                aria-label="Episode listening and viewing platforms"
                className="border-t border-border bg-surface-elevated p-4 sm:p-5"
              >
                <p className="mb-4 text-center text-body-sm font-semibold text-foreground">
                  Listen or watch
                </p>
                <ul className="mx-auto flex max-w-3xl flex-wrap justify-center gap-3">
                  {referenceGroups.platformReferences.map(({ reference, platform }) => (
                    <EpisodePlatformTile
                      key={`${platform}-${reference.url}`}
                      platform={platform}
                      reference={reference}
                    />
                  ))}
                </ul>
              </nav>
            )}
          </section>

          {(episode.audioUrl || episode.spotifyId) && (
            <section
              aria-labelledby={`audio-player-${episode.slug}`}
              className="overflow-hidden rounded-lg border border-primary/25 bg-surface-elevated shadow-sm"
            >
              <AnimatedDisclosure
                label={
                  <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Volume2 className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span
                      id={`audio-player-${episode.slug}`}
                      className="block text-body font-semibold text-foreground"
                    >
                      Listen to the audio edition
                    </span>
                    <span className="mt-0.5 block text-caption font-normal text-foreground-muted">
                      Expand the standalone audio player
                    </span>
                  </span>
                </span>
                }
                triggerClassName="min-h-20 gap-4 px-5 py-4 sm:px-6"
                iconClassName="h-5 w-5"
              >
                <div className="border-t border-border p-5 sm:p-6">
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
                </div>
              </AnimatedDisclosure>
            </section>
          )}

          {/* Collapsed episode notes */}
          {(episode.keyTakeaways.length > 0 ||
            (episode.checklist?.length ?? 0) > 0 ||
            episode.sections.length > 0) && (
            <section
              aria-label="Episode notes"
              className="overflow-hidden rounded-lg border border-border bg-surface"
            >
              {episode.keyTakeaways.length > 0 && (
                <AnimatedDisclosure
                  className="border-b border-border last:border-b-0"
                  triggerClassName="min-h-16 gap-4 px-5 py-4 sm:px-6"
                  label={
                    <span className="flex min-w-0 items-center gap-3">
                      <Lightbulb className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-body font-semibold text-foreground">
                        Key takeaways
                        <span className="ml-2 text-caption font-normal text-foreground-subtle">
                          {episode.keyTakeaways.length}
                        </span>
                      </span>
                    </span>
                  }
                >
                  <ul className="space-y-4 border-t border-border px-5 py-6 sm:px-6">
                    {episode.keyTakeaways.map((takeaway, index) => (
                      <li key={index} className="flex gap-4">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-caption font-bold text-primary">
                          {index + 1}
                        </span>
                        <span className="text-body text-foreground-muted">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </AnimatedDisclosure>
              )}

              {(episode.checklist?.length ?? 0) > 0 && (
                <AnimatedDisclosure
                  className="border-b border-border last:border-b-0"
                  triggerClassName="min-h-16 gap-4 px-5 py-4 sm:px-6"
                  label={
                    <span className="flex min-w-0 items-center gap-3">
                      <ListChecks className="h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                      <span className="text-body font-semibold text-foreground">
                        Order-of-operations checklist
                        <span className="ml-2 text-caption font-normal text-foreground-subtle">
                          {episode.checklist!.length}
                        </span>
                      </span>
                    </span>
                  }
                >
                  <ul className="space-y-3 border-t border-border px-5 py-6 sm:px-6">
                    {episode.checklist!.map((item, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden="true" />
                        <span className="text-body text-foreground-muted">{item}</span>
                      </li>
                    ))}
                  </ul>
                </AnimatedDisclosure>
              )}

              {episode.sections.length > 0 && (
                <AnimatedDisclosure
                  className="last:border-b-0"
                  triggerClassName="min-h-16 gap-4 px-5 py-4 sm:px-6"
                  label={
                    <span className="flex min-w-0 items-center gap-3">
                      <NotebookText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                      <span className="text-body font-semibold text-foreground">
                        Show notes
                        <span className="ml-2 text-caption font-normal text-foreground-subtle">
                          {episode.sections.length} sections
                        </span>
                      </span>
                    </span>
                  }
                >
                  <div className="divide-y divide-border border-t border-border px-5 sm:px-6">
                    {episode.sections.map((section, index) => (
                      <div key={index} className="py-6">
                        <h3 className="mb-4 text-heading font-semibold text-foreground">
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
                  </div>
                </AnimatedDisclosure>
              )}
            </section>
          )}

          {/* Related Affiliate Products */}
          {(relatedAffiliateProducts.length > 0 || affiliateGuideReferences.length > 0) && (
            <section
              id="episode-affiliates"
              className="scroll-mt-28 rounded-lg border border-primary/25 bg-surface p-5 shadow-glow-sm sm:p-8"
            >
              <div className="mb-6">
                <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
                  Affiliate guide
                </p>
                <h2 className="text-heading-lg font-bold text-foreground">
                  {relatedAffiliateProducts.length > 0
                    ? "Products and resources for this episode"
                    : "Affiliate and product guide"}
                </h2>
                <p className="mt-3 text-body-sm text-foreground-muted">
                  {AFFILIATE_DISCLOSURE}
                </p>
              </div>
              {relatedAffiliateProducts.length > 0 && (
                <div className="space-y-4">
                  {relatedAffiliateProducts.map((product) => (
                    <EpisodeAffiliateCard key={product.slug} product={product} />
                  ))}
                </div>
              )}
              {affiliateGuideReferences.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                  {affiliateGuideReferences.map(({ reference }) => (
                    <Link
                      key={reference.url}
                      href="/affiliates/"
                      className="inline-flex items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
                    >
                      {reference.label}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* References */}
          {resourceReferences.length > 0 && (
            <section className="overflow-hidden rounded-lg border border-border bg-surface">
              <AnimatedDisclosure
                triggerClassName="min-h-16 gap-4 px-5 py-4 sm:px-6"
                label={
                  <span className="flex min-w-0 items-center gap-3">
                    <NotebookText className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                    <span className="text-body font-semibold text-foreground">
                      Episode resources
                      <span className="ml-2 text-caption font-normal text-foreground-subtle">
                        {resourceReferences.length}
                      </span>
                    </span>
                  </span>
                }
              >
                <ul className="space-y-3 border-t border-border px-5 py-6 sm:px-6">
                  {resourceReferences.map((ref) => (
                    <li key={ref.url}>
                      <a
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-h-11 items-center gap-2 text-body text-primary transition-colors duration-200 hover:text-primary-hover"
                      >
                        <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                        {ref.label}
                        <span className="sr-only"> (opens in a new tab)</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </AnimatedDisclosure>
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
                    className="group block rounded-lg border border-border bg-surface p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:shadow-glow-sm"
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
                    className="group block rounded-lg border border-border bg-surface p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:shadow-glow-sm"
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

function EpisodePlatformTile({
  platform,
  reference,
}: {
  platform: EpisodePlatform;
  reference: EpisodeReference;
}) {
  const profile = EPISODE_PLATFORM_PROFILES[platform];
  const style = { "--platform-accent": profile.accent } as CSSProperties;
  const tileClassName =
    "episode-platform-tile relative flex min-h-[7.25rem] w-full flex-col items-center justify-center gap-2 rounded-lg border px-4 py-4 text-center";

  return (
    <li className="w-full min-[390px]:w-[calc(50%-0.375rem)] md:w-[10.5rem]">
      {reference.comingSoon ? (
        <span
          style={style}
          className={`${tileClassName} border-dashed opacity-60`}
          title={`${profile.label} destination coming soon`}
          aria-disabled="true"
        >
          <span className="episode-platform-mark flex h-11 w-11 items-center justify-center rounded-full border">
            <EpisodePlatformLogo platform={platform} />
          </span>
          <span className="text-body-sm font-semibold leading-snug text-foreground-muted">
            {reference.label}
          </span>
          <span className="inline-flex items-center gap-1 text-caption text-foreground-subtle">
            <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
            Coming soon
          </span>
        </span>
      ) : (
        <a
          href={reference.url}
          target="_blank"
          rel="noopener noreferrer"
          style={style}
          className={`${tileClassName} group transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 motion-reduce:transform-none motion-reduce:transition-none`}
        >
          <ExternalLink
            className="absolute right-3 top-3 h-3.5 w-3.5 text-foreground-subtle transition-colors duration-300 group-hover:text-foreground"
            aria-hidden="true"
          />
          <span className="episode-platform-mark flex h-11 w-11 items-center justify-center rounded-full border transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none">
            <EpisodePlatformLogo platform={platform} />
          </span>
          <span className="text-body-sm font-semibold leading-snug text-foreground">
            {reference.label}
          </span>
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      )}
    </li>
  );
}

function EpisodePlatformLogo({ platform }: { platform: EpisodePlatform }) {
  const path = {
    YouTube:
      "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z",
    Vimeo:
      "M23.977 6.416c-.105 2.338-1.739 5.543-4.894 9.609-3.268 4.247-6.026 6.37-8.29 6.37-1.409 0-2.578-1.294-3.553-3.881L3.322 11.4C2.603 8.816 1.837 7.522 1.022 7.522c-.179 0-.806.378-1.881 1.132L0 7.197c1.185-1.044 2.351-2.084 3.501-3.128C5.08 2.701 6.266 1.984 7.055 1.91c1.867-.18 3.016 1.1 3.447 3.838.465 2.953.789 4.789.971 5.507.539 2.45 1.131 3.674 1.776 3.674.502 0 1.256-.796 2.265-2.385 1.004-1.589 1.54-2.797 1.612-3.628.144-1.371-.395-2.061-1.614-2.061-.574 0-1.167.121-1.777.391 1.186-3.868 3.434-5.757 6.762-5.67 2.473.06 3.628 1.664 3.493 4.797l-.013.01z",
    Spotify:
      "M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z",
    Rumble:
      "M16.156 7.173c.227-.478.199-1.019-.074-1.467a1.502 1.502 0 0 0-1.256-.706H8.438c-.533 0-1.026.292-1.285.762L4.561 10.8a1.51 1.51 0 0 0 .026 1.52c.26.432.727.68 1.222.68h2.468l-2.012 4.166a1.503 1.503 0 0 0 .663 1.972 1.495 1.495 0 0 0 2.023-.528l7.174-11.374a.04.04 0 0 0 .03-.063zm3.122.827H17.33a.75.75 0 0 0-.642 1.135l2.623 4.35a.75.75 0 0 0 1.285 0l1.324-2.194a1.502 1.502 0 0 0-.009-1.555l-.927-1.496a.75.75 0 0 0-.706-.24z",
  }[platform];

  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
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
