import Link from "next/link";
import Image from "next/image";
import { getContentCatalog } from "@/data/content-catalog";
import { episodeDisplayTitle } from "@/data/episodes";
import { physicianProfileExperience } from "@/data/physician-profile";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { PlatformBadges } from "@/components/platform-badges";

export default async function Home() {
  const { episodes, blogPosts } = await getContentCatalog();

  const allTopics = Array.from(new Set(episodes.flatMap((ep) => ep.topics))).sort();
  const sortedEpisodes = [...episodes].sort((a, b) => {
    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return b.number - a.number;
  });

  const latestEpisode = sortedEpisodes[0];
  const featuredEpisodes = sortedEpisodes.slice(0, 3);
  const latestBlogPosts = blogPosts.slice(0, 2);
  const hasLatestVideo = latestEpisode?.vimeoId;

  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-grid-pattern bg-grid opacity-50" />
        <div className="absolute inset-0 bg-gradient-glow" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-radial from-primary/10 via-transparent to-transparent" />

        <div className="relative mx-auto max-w-6xl px-4 py-20 lg:px-6 lg:py-32">
          <div className="flex flex-col items-center text-center">
            {/* Eyebrow */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/50 backdrop-blur px-4 py-2 mb-8 animate-fade-in">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-caption font-medium text-foreground-muted">
                Now streaming on all platforms
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-display-lg md:text-display-xl font-bold text-foreground max-w-4xl mb-6 animate-slide-up">
              Dr. M&apos;s Experienced{" "}
              <span className="text-gradient">Functional And Sports Medicine</span>
            </h1>

            {/* Subheadline */}
            <p className="text-body-lg text-foreground-muted max-w-3xl mb-10 animate-slide-up delay-100">
              David Musnick MD has dedicated {physicianProfileExperience.patientCare} to patient care,
              with deep clinical work in Sports Medicine, Internal Medicine, Regenerative Medicine,
              and {physicianProfileExperience.functionalMedicine} of Functional Medicine. He is a
              master clinician and teacher. In this Podcast he gets right to the point with highly
              practical information based on his experience and on the research. No fluff. No long
              and boring interviews.
            </p>

            {/* Platform Badges */}
            <div className="mb-12 animate-slide-up delay-200">
              <PlatformBadges variant="pill" />
            </div>

            {/* Latest Episode Card */}
            {latestEpisode && (
              <Link
                href={`/episodes/${latestEpisode.slug}`}
                className="group w-full max-w-2xl rounded-2xl border border-border bg-surface/80 backdrop-blur overflow-hidden hover:border-primary/50 hover:shadow-glow transition-all duration-300 animate-slide-up delay-300"
              >
                {latestEpisode.thumbnailUrl ? (
                  <div className="relative aspect-video w-full overflow-hidden">
                    <Image
                      src={latestEpisode.thumbnailUrl}
                      alt={episodeDisplayTitle(latestEpisode)}
                      fill
                      className={`object-cover transition-transform duration-300 ${
                        !hasLatestVideo ? "opacity-50" : "group-hover:scale-105"
                      }`}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/50 to-transparent" />
                    {!hasLatestVideo && (
                      <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/60 to-transparent" />
                    )}
                    <div className="absolute top-4 left-4">
                      <p className="text-caption font-semibold uppercase tracking-wider text-background/90 mb-2">
                        Latest Episode
                      </p>
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/90 backdrop-blur text-heading font-bold text-background">
                        {latestEpisode.number.toString().padStart(2, "0")}
                      </span>
                    </div>
                    {!hasLatestVideo ? (
                      <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-2 px-4">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm border-2 border-primary/30 text-primary">
                            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <p className="text-body font-semibold text-background drop-shadow-lg text-center">
                            Video Coming Soon
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="absolute bottom-4 left-4 right-4">
                          <h3 className="text-heading-lg font-bold text-background mb-2 drop-shadow-lg">
                            {episodeDisplayTitle(latestEpisode)}
                          </h3>
                          <p className="text-body-sm text-background/90 line-clamp-2 drop-shadow">
                            {latestEpisode.summary}
                          </p>
                        </div>
                        {latestEpisode.durationMinutes && (
                          <div className="absolute top-4 right-4 flex items-center gap-1.5 text-caption text-background bg-black/50 backdrop-blur rounded-full px-3 py-1.5">
                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            <span>{latestEpisode.durationMinutes} min</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-background transition-all duration-300">
                        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-1">
                          Latest Episode
                        </p>
                        <h3 className="text-heading font-semibold text-foreground group-hover:text-primary transition-colors duration-200">
                          {episodeDisplayTitle(latestEpisode)}
                        </h3>
                        <p className="text-body-sm text-foreground-muted mt-1 line-clamp-2">
                          {latestEpisode.summary}
                        </p>
                      </div>
                      <div className="hidden sm:flex items-center text-foreground-muted group-hover:text-primary transition-colors duration-200">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Topics Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="text-center mb-10">
          <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
            Browse by topic
          </p>
          <h2 className="text-heading-xl font-bold text-foreground">
            Find what you need
          </h2>
        </div>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/episodes"
            className="rounded-full border border-primary bg-primary/10 px-5 py-2.5 text-body-sm font-semibold text-primary hover:bg-primary hover:text-background transition-all duration-200"
          >
            All Episodes
          </Link>
          {allTopics.map((topic) => (
            <Link
              key={topic}
              href={`/episodes?topic=${encodeURIComponent(topic.toLowerCase())}`}
              className="rounded-full border border-border bg-surface px-5 py-2.5 text-body-sm font-medium text-foreground-muted hover:border-primary hover:text-primary transition-all duration-200"
            >
              {topic}
            </Link>
          ))}
        </div>
      </section>

      {/* Learning Formats */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="mb-10">
          <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
            Choose the format
          </p>
          <h2 className="text-heading-xl font-bold text-foreground">
            Listen, read, then apply
          </h2>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <FormatCard
            href="/episodes"
            eyebrow="Podcast"
            title="Episodes"
            body="Short practical audio and video notes with summaries, references, and order-of-operations takeaways."
          />
          <FormatCard
            href="/blogs"
            eyebrow="Long-form"
            title="Blogs"
            body={
              latestBlogPosts.length > 0
                ? `Read ${latestBlogPosts.length} current note${latestBlogPosts.length === 1 ? "" : "s"} and the longer context behind recurring topics.`
                : "A home for long-form explainers, episode expansions, and clinic-style frameworks as posts are published."
            }
          />
          <FormatCard
            href="/affiliates"
            eyebrow="Resources"
            title="Affiliate guide"
            body="Products, tools, and resource notes connected back to topics and episodes when there is a clear reason."
          />
        </div>
      </section>

      {/* Featured Episodes */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
              Featured episodes
            </p>
            <h2 className="text-heading-xl font-bold text-foreground">
              Start here
            </h2>
          </div>
          <Link
            href="/episodes"
            className="hidden sm:inline-flex items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
          >
            View all
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {featuredEpisodes.map((episode, index) => (
            <Link
              key={episode.slug}
              href={`/episodes/${episode.slug}`}
              className="group rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 hover:shadow-glow-sm transition-all duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Thumbnail */}
              {episode.thumbnailUrl ? (
                <div className="relative aspect-video w-full overflow-hidden bg-surface-elevated">
                  <Image
                    src={episode.thumbnailUrl}
                    alt={episodeDisplayTitle(episode)}
                    fill
                    className={`object-cover transition-transform duration-300 ${
                      episode.references?.some((ref) => ref.comingSoon === true)
                        ? "opacity-50"
                        : "group-hover:scale-105"
                    }`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                  {episode.references?.some((ref) => ref.comingSoon === true) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent" />
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/90 backdrop-blur text-caption font-bold text-background">
                      {episode.number.toString().padStart(2, "0")}
                    </span>
                  </div>
                  {episode.references?.some((ref) => ref.comingSoon === true) ? (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-1.5 px-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm border-2 border-primary/30 text-primary">
                          <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-caption font-semibold text-background drop-shadow-lg text-center">
                          Coming Soon
                        </p>
                      </div>
                    </div>
                  ) : (
                    episode.durationMinutes && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-caption text-background bg-black/50 backdrop-blur rounded-full px-2.5 py-1">
                        <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                        <span>{episode.durationMinutes} min</span>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="relative aspect-video w-full bg-gradient-to-br from-surface to-surface-elevated flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-body-sm font-bold text-primary">
                    {episode.number.toString().padStart(2, "0")}
                  </span>
                </div>
              )}
              <div className="p-6">
                <h3 className="text-heading font-semibold text-foreground group-hover:text-primary transition-colors duration-200 mb-2">
                  {episodeDisplayTitle(episode)}
                </h3>
                <p className="text-body-sm text-foreground-muted line-clamp-2 mb-4">
                  {episode.summary}
                </p>
                <div className="flex flex-wrap gap-2">
                  {episode.topics.slice(0, 2).map((topic) => (
                    <span
                      key={topic}
                      className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
        <div className="mt-8 text-center sm:hidden">
          <Link
            href="/episodes"
            className="inline-flex items-center gap-2 rounded-full border border-primary bg-primary/10 px-6 py-3 text-body-sm font-semibold text-primary hover:bg-primary hover:text-background transition-all duration-200"
          >
            View all episodes
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="relative rounded-3xl border border-border bg-surface overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-glow opacity-50" />

          <div className="relative px-6 py-16 sm:px-12 sm:py-20">
            <NewsletterCapture
              variant="hero"
              heading="Get the latest"
              description="Weekly insights on functional medicine, sports performance, and actionable health strategies. No spam, unsubscribe anytime."
              className="mx-auto"
            />
          </div>
        </div>
      </section>

      {/* Credibility Section */}
      <section className="mx-auto max-w-6xl px-4 py-16 lg:px-6">
        <div className="rounded-3xl border border-border bg-surface p-8 sm:p-12">
          <div className="grid gap-10 lg:grid-cols-3 lg:gap-12 items-start">
            {/* Portrait */}
            <div className="lg:col-span-1">
              <div className="aspect-square rounded-2xl overflow-hidden border border-border">
                <Image
                  src="/images/davidmusnicksketch.jpg"
                  alt="Dr. David Musnick"
                  width={300}
                  height={300}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            <div className="lg:col-span-2">
              <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-3">
                Your host
              </p>
              <h2 className="text-heading-xl font-bold text-foreground mb-4">
                Dr. David Musnick, MD
              </h2>
              <p className="text-body text-foreground-muted mb-6">
                Board-certified in Internal Medicine, Sports Medicine, and Functional Medicine.
                {physicianProfileExperience.patientCare} in patient care, with deep dives into
                concussion, brain-based symptoms and conditions, autoimmune conditions, fatigue,
                arthritis, and gastrointestinal symptoms and conditions.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  "Faculty: IFM, Bastyr University, Andrews University, UW",
                  "Author: Integrative Neurology, Metabolic Orthopedics",
                  "Pioneer: FSM protocols, integrative concussion rehab",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-body-sm text-foreground-muted">
                    <svg className="h-5 w-5 shrink-0 text-primary mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/about"
                className="inline-flex items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
              >
                Full credentials
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <div className="mt-8 rounded-2xl border border-dashed border-border bg-surface-elevated p-6">
                <p className="text-body-sm font-semibold text-foreground mb-2">
                  Educational content only
                </p>
                <p className="text-body-sm text-foreground-muted">
                  Dr. M&apos;s Experienced Functional and Sports Medicine is a signal chain—Dr. Musnick&apos;s clinic notes translated into episodes
                  so athletes, clinicians, and curious humans can think clearly. This is not
                  medical advice. Work with your own clinician for diagnosis and treatment.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function FormatCard({
  href,
  eyebrow,
  title,
  body,
}: {
  href: string;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-56 flex-col rounded-2xl border border-border bg-surface p-6 transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm"
    >
      <p className="mb-3 text-caption font-semibold uppercase tracking-wider text-primary">
        {eyebrow}
      </p>
      <h3 className="mb-3 text-heading-lg font-bold text-foreground transition-colors duration-200 group-hover:text-primary">
        {title}
      </h3>
      <p className="flex-1 text-body-sm text-foreground-muted">{body}</p>
      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <span className="text-body-sm font-semibold text-primary">Open</span>
        <svg
          className="h-4 w-4 text-foreground-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}
