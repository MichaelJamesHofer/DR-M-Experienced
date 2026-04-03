import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { EPISODES, episodeDisplayTitle } from "@/data/episodes";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { VimeoPlayer } from "@/components/vimeo-player";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
});

export function generateStaticParams() {
  return EPISODES.map((episode) => ({ slug: episode.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const episode = EPISODES.find((item) => item.slug === slug);
  if (!episode) {
    return { title: "Episode not found" };
  }

  return {
    title: episodeDisplayTitle(episode),
    description: episode.summary,
  };
}

export default async function EpisodeDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const episode = EPISODES.find((item) => item.slug === slug);
  if (!episode) {
    notFound();
  }

  const publishDate = dateFormatter.format(new Date(episode.publishDate));
  const related = EPISODES.filter(
    (item) =>
      item.slug !== episode.slug && item.topics.some((topic) => episode.topics.includes(topic))
  ).slice(0, 3);

  const hasComingSoonReference = episode.references?.some((ref) => ref.comingSoon === true);

  const currentIndex = EPISODES.findIndex((ep) => ep.slug === episode.slug);
  const prevEpisode = currentIndex < EPISODES.length - 1 ? EPISODES[currentIndex + 1] : null;
  const nextEpisode = currentIndex > 0 ? EPISODES[currentIndex - 1] : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-body-sm text-foreground-muted mb-8">
        <Link href="/" className="hover:text-foreground transition-colors duration-200">
          Home
        </Link>
        <span>/</span>
        <Link href="/episodes" className="hover:text-foreground transition-colors duration-200">
          Episodes
        </Link>
        <span>/</span>
        <span className="text-foreground line-clamp-2">{episodeDisplayTitle(episode)}</span>
      </nav>

      <div className="grid gap-12 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-10">
          {/* Header */}
          <header>
            <div className="flex items-center gap-3 mb-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-heading font-bold text-primary">
                {episode.number.toString().padStart(2, "0")}
              </span>
              <div className="flex items-center gap-3 text-body-sm text-foreground-muted">
                <span>{publishDate}</span>
                {episode.durationMinutes && (
                  <>
                    <span>•</span>
                    <span>{episode.durationMinutes} min</span>
                  </>
                )}
              </div>
            </div>
            <h1 className="text-display font-bold text-foreground mb-4">
              {episodeDisplayTitle(episode)}
            </h1>
            <p className="text-body-lg text-foreground-muted">
              {episode.summary}
            </p>
            <div className="flex flex-wrap gap-2 mt-6">
              {episode.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/episodes?topic=${encodeURIComponent(topic.toLowerCase())}`}
                  className="rounded-full border border-border bg-surface px-4 py-2 text-body-sm text-foreground-muted hover:border-primary hover:text-primary transition-all duration-200"
                >
                  {topic}
                </Link>
              ))}
            </div>
          </header>

          {/* Video Player */}
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            {episode.vimeoId ? (
              <VimeoPlayer
                videoId={episode.vimeoId}
                title={episodeDisplayTitle(episode)}
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
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm border-2 border-primary/30 text-primary">
                          <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
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
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20 text-primary">
                      <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                    <p className="text-body-sm text-foreground-muted">
                      Episode player coming soon
                    </p>
                  </>
                )}
              </div>
            )}
            {(episode.audioUrl || episode.spotifyId) && (
              <div className="p-4 border-t border-border">
                {episode.audioUrl ? (
                  <audio controls className="w-full" src={episode.audioUrl}>
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
            )}
            {hasComingSoonReference && (
              <div className="px-4 pb-4 pt-2 border-t border-border bg-surface">
                <p className="text-body-xs text-foreground-subtle">
                  Vimeo video for this episode is <span className="font-semibold">coming soon</span>.
                </p>
              </div>
            )}
            {episode.references && episode.references.length > 0 && (
              <div className="p-4 border-t border-border bg-surface-elevated">
                <p className="text-body-sm font-semibold text-foreground mb-3">
                  Listen or watch on:
                </p>
                <div className="flex flex-wrap gap-2">
                  {episode.references.map((ref, index) => {
                    const isComingSoon = ref.comingSoon === true;
                    if (isComingSoon) {
                      return (
                        <span
                          key={index}
                          className="inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface px-4 py-2 text-body-sm font-medium text-foreground-subtle cursor-not-allowed opacity-60"
                          title="Coming soon"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {ref.label}
                        </span>
                      );
                    }
                    return (
                      <a
                        key={index}
                        href={ref.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-body-sm font-medium text-foreground-muted hover:border-primary hover:text-primary transition-all duration-200"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        {ref.label}
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Key Takeaways */}
          <section className="rounded-2xl border border-border bg-surface p-8">
            <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                💡
              </span>
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
            <section className="rounded-2xl border border-success/30 bg-success/5 p-8">
              <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20 text-success">
                  ✓
                </span>
                Order-of-operations checklist
              </h2>
              <ul className="space-y-3">
                {episode.checklist.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <svg className="h-5 w-5 shrink-0 text-success mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
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
                <div key={index} className="rounded-2xl border border-border bg-surface p-6">
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

          {/* References */}
          {episode.references && episode.references.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-8">
              <h2 className="text-heading-lg font-bold text-foreground mb-6">
                References & resources
              </h2>
              <ul className="space-y-3">
                {episode.references.map((ref, index) => (
                  <li key={index}>
                    <a
                      href={ref.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-body text-primary hover:text-primary-hover transition-colors duration-200"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      {ref.label}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Episode Navigation */}
          <div className="flex items-center justify-between pt-8 border-t border-border">
            {prevEpisode ? (
              <Link
                href={`/episodes/${prevEpisode.slug}`}
                className="group flex items-center gap-3 text-foreground-muted hover:text-foreground transition-colors duration-200"
              >
                <svg className="h-5 w-5 group-hover:-translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
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
                className="group flex items-center gap-3 text-foreground-muted hover:text-foreground transition-colors duration-200"
              >
                <div className="text-right min-w-0">
                  <p className="text-caption text-foreground-subtle">Next</p>
                  <p className="text-body-sm font-medium line-clamp-2">{episodeDisplayTitle(nextEpisode)}</p>
                </div>
                <svg className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
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
          <div className="rounded-2xl border border-dashed border-border bg-surface p-6">
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
                    className="group block rounded-xl border border-border bg-surface p-4 hover:border-primary/50 transition-all duration-200"
                  >
                    <p className="text-body-sm font-medium text-foreground group-hover:text-primary transition-colors duration-200 line-clamp-3">
                      {episodeDisplayTitle(ep)}
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
