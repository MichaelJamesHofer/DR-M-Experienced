import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Mic2,
  Play,
  ShoppingBag,
} from "lucide-react";
import { NewsletterCapture } from "@/components/newsletter-capture";
import { HomeHero } from "@/components/home-hero";
import { PlatformBadges } from "@/components/platform-badges";
import { VimeoPlayer } from "@/components/vimeo-player";
import { getContentCatalog } from "@/data/content-catalog";
import { episodeDisplayTitle, type Episode } from "@/data/episodes";
import { physicianProfileExperience } from "@/data/physician-profile";
import { SITE_HOST_LINE, SITE_NAME, SITE_SHORT_NAME } from "@/lib/site-brand";

const CURATED_TOPICS = [
  {
    label: "Brain fog",
    topic: "brain-fog",
    description: "Clarity, focus, testing, and common drivers",
  },
  {
    label: "Sleep & insomnia",
    topic: "insomnia",
    description: "Why sleep breaks down and how to recover",
  },
  {
    label: "Concussion recovery",
    topic: "concussion",
    description: "Injury mechanics, inflammation, and recovery",
  },
  {
    label: "Energy & mitochondria",
    topic: "energy",
    description: "Fatigue, metabolism, and cellular energy",
  },
  {
    label: "EMF & health",
    topic: "emf",
    description: "Exposure, evidence, and practical steps",
  },
] as const;

const homeDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function localImageUrl(url?: string) {
  return url?.replace(/^https:\/\/drmexperienced\.com/, "");
}

export default async function Home() {
  const { episodes, blogPosts } = await getContentCatalog();
  const sortedEpisodes = [...episodes].sort((a, b) => {
    const dateDifference = new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime();
    return dateDifference || b.number - a.number;
  });
  const latestEpisode = sortedEpisodes[0];
  const latestVimeoId = latestEpisode?.vimeoId?.trim();
  const latestEpisodeImage = latestEpisode
    ? localImageUrl(latestEpisode.thumbnailUrl) ??
      latestEpisode.thumbnailUrl ??
      "/images/brand/hero-brand-mountain-v1.webp"
    : "/images/brand/hero-brand-mountain-v1.webp";
  const featuredEpisodes = sortedEpisodes.slice(0, 3);
  const latestBlogPosts = blogPosts.slice(0, 2);

  return (
    <>
      <HomeHero>
        <div className="relative mx-auto flex w-full max-w-6xl flex-1 items-center justify-center self-stretch px-4 py-8 lg:px-6">
          <div className="w-full max-w-[46rem] text-center">
            <p className="mb-3 text-caption font-bold uppercase text-[#0e7490]">
              Practical health education
            </p>
            <h1 className="break-words text-[2.5rem] font-bold leading-[1.02] text-[#0a0f1a] sm:text-[3.2rem] md:text-[4rem]">
              {SITE_SHORT_NAME}
            </h1>
            <p className="mt-2 text-[1.2rem] font-semibold leading-tight text-[#9a5b05] sm:text-[1.45rem]">
              {SITE_HOST_LINE}
            </p>
            <p className="mx-auto mt-4 max-w-[38rem] text-base leading-7 text-[#334155] md:text-lg">
              <span className="max-[350px]:hidden xl:hidden">
                Practical, research-informed guidance from {physicianProfileExperience.patientCare} in medicine.
              </span>
              <span className="hidden xl:inline">
                Clear, research-informed guidance drawn from {physicianProfileExperience.patientCare} of
                patient care across sports, internal, regenerative, and functional medicine.
              </span>
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {latestEpisode && (
                <Link
                  href={latestVimeoId ? "#latest-episode" : `/episodes/${latestEpisode.slug}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#0a0f1a] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#172554] sm:px-5"
                >
                  {latestVimeoId ? (
                    <Play className="h-4 w-4 fill-current text-[#22d3ee]" aria-hidden="true" />
                  ) : (
                    <ArrowRight className="h-4 w-4 text-[#22d3ee]" aria-hidden="true" />
                  )}
                  View latest
                </Link>
              )}
              <Link
                href="/episodes"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg border border-[#0a0f1a]/25 bg-white/80 px-4 py-3 text-sm font-semibold text-[#0a0f1a] transition-colors hover:border-[#0e7490] hover:text-[#0e7490] sm:px-5"
              >
                All episodes
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <PlatformBadges variant="hero" className="mt-5 justify-center" />
          </div>
        </div>
      </HomeHero>

      {latestEpisode && (
        <section id="latest-episode" className="scroll-mt-24 border-b border-border bg-background">
          <div className="mx-auto grid w-full min-w-0 max-w-6xl items-center gap-7 px-4 py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] lg:gap-10 lg:px-6 lg:py-14">
            {latestVimeoId ? (
              <VimeoPlayer
                videoId={latestVimeoId}
                title={episodeDisplayTitle(latestEpisode)}
                thumbnailUrl={latestEpisodeImage}
                className="min-w-0 w-full rounded-lg border border-border"
              />
            ) : (
              <Link
                href={`/episodes/${latestEpisode.slug}`}
                className="group relative aspect-video w-full min-w-0 overflow-hidden rounded-lg border border-border bg-surface-elevated"
                aria-label={`View ${episodeDisplayTitle(latestEpisode)}`}
              >
                <Image
                  src={latestEpisodeImage}
                  alt=""
                  fill
                  sizes="(max-width: 1024px) 100vw, 720px"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <span className="absolute inset-0 bg-black/30 transition-colors group-hover:bg-black/20" />
                <span className="absolute bottom-4 left-4 inline-flex min-h-11 items-center gap-2 rounded-lg bg-white px-4 py-2 text-body-sm font-semibold text-[#0a0f1a]">
                  Episode details
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </Link>
            )}
            <div className="min-w-0 text-center lg:text-left">
              <p className="mb-3 text-caption font-semibold uppercase text-primary">Latest episode</p>
              <h2 className="text-heading-xl font-bold text-foreground md:text-[2.25rem] md:leading-tight">
                {episodeDisplayTitle(latestEpisode)}
              </h2>
              <div className="mt-3 flex items-center justify-center gap-3 text-caption text-foreground-subtle lg:justify-start">
                <span>{homeDateFormatter.format(new Date(latestEpisode.publishDate))}</span>
                {latestEpisode.durationMinutes && (
                  <>
                    <span aria-hidden="true">•</span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
                      {latestEpisode.durationMinutes} min
                    </span>
                  </>
                )}
              </div>
              <p className="mt-4 line-clamp-4 text-body leading-7 text-foreground-muted">
                {latestEpisode.summary}
              </p>
              <Link
                href={`/episodes/${latestEpisode.slug}`}
                className="mt-5 inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover"
              >
                Episode notes and references
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="border-b border-border bg-surface/45">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 lg:px-6 lg:py-16">
          <div className="text-center lg:pt-2 lg:text-left">
            <p className="mb-3 text-caption font-semibold uppercase text-primary">Browse by topic</p>
            <h2 className="mb-4 text-[2rem] font-bold leading-tight text-foreground md:text-[2.5rem]">
              Start with the question you have.
            </h2>
            <p className="mx-auto max-w-md text-body text-foreground-muted lg:mx-0">
              Five practical paths into the current episode library, organized around real concerns
              rather than internal tags.
            </p>
            <Link
              href="/episodes"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover"
            >
              View all episodes
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="border-t border-border">
            {CURATED_TOPICS.map((item, index) => {
              const episodeCount = episodes.filter((episode) =>
                episode.topics.includes(item.topic)
              ).length;

              return (
                <Link
                  key={item.topic}
                  href={`/episodes?topic=${encodeURIComponent(item.topic)}`}
                  className="group grid min-h-16 grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-border py-3 transition-colors hover:bg-surface-elevated/45 sm:grid-cols-[2.5rem_0.8fr_1.2fr_auto] sm:px-2"
                >
                  <span className="text-caption text-foreground-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-body font-semibold text-foreground group-hover:text-primary">
                    {item.label}
                  </span>
                  <span className="hidden text-body-sm text-foreground-muted sm:block">
                    {item.description}
                  </span>
                  <span className="flex items-center gap-3 text-caption text-foreground-subtle">
                    <span>
                      {episodeCount} {episodeCount === 1 ? "episode" : "episodes"}
                    </span>
                    <ArrowRight
                      className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:text-primary"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
        <div className="mx-auto mb-8 max-w-2xl text-center md:mx-0 md:text-left">
          <p className="mb-3 text-caption font-semibold uppercase text-primary">Explore the library</p>
          <h2 className="text-[2rem] font-bold leading-tight text-foreground md:text-[2.5rem]">
            Listen, read, then apply.
          </h2>
        </div>
        <div className="divide-y divide-border border-y border-border md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
          <FormatLink
            href="/episodes"
            icon={Mic2}
            eyebrow="Podcast"
            title="Episodes"
            body="Concise audio and video with summaries, references, and practical takeaways."
          />
          <FormatLink
            href="/blogs"
            icon={BookOpen}
            eyebrow="Long-form"
            title="Blogs"
            body={
              latestBlogPosts.length === 1
                ? "One current note expands the evidence and context behind recurring topics."
                : latestBlogPosts.length > 1
                  ? `${latestBlogPosts.length} current notes expand the evidence and context behind recurring topics.`
                : "Long-form explainers and episode expansions for topics that need more context."
            }
          />
          <FormatLink
            href="/affiliates"
            icon={ShoppingBag}
            eyebrow="Resources"
            title="Affiliate guide"
            body="Products Dr. M references, why he uses them, and the episodes where they appear."
          />
        </div>
      </section>

      <section className="border-y border-border bg-surface/45">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
          <div className="mb-8 flex items-end justify-center gap-6 text-center sm:justify-between sm:text-left">
            <div>
              <p className="mb-3 text-caption font-semibold uppercase text-primary">Featured episodes</p>
              <h2 className="text-[2rem] font-bold leading-tight text-foreground md:text-[2.5rem]">
                A good place to start.
              </h2>
            </div>
            <Link
              href="/episodes"
              className="hidden min-h-11 items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover sm:inline-flex"
            >
              View all
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {featuredEpisodes.map((episode) => (
              <EpisodeCard key={episode.slug} episode={episode} />
            ))}
          </div>
          <Link
            href="/episodes"
            className="mt-6 flex min-h-11 items-center justify-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover sm:hidden"
          >
            View all episodes
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="border-b border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 md:grid-cols-[0.8fr_1.2fr] md:items-center lg:px-6 lg:py-20">
          <div className="text-center md:text-left">
            <p className="mb-3 text-caption font-semibold uppercase text-primary">Field notes</p>
            <h2 className="mb-3 text-[2rem] font-bold leading-tight text-foreground md:text-[2.5rem]">
              New episodes and practical notes.
            </h2>
            <p className="mx-auto max-w-md text-body text-foreground-muted md:mx-0">
              A concise email when there is something useful to share. No filler.
            </p>
          </div>
          <NewsletterCapture
            variant="hero"
            heading="Join the email list"
            description="Episode releases, research notes, and practical follow-ups."
          />
        </div>
      </section>

      <section id="your-host" className="scroll-mt-24 border-b border-border bg-surface/35">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[minmax(280px,0.65fr)_minmax(0,1.35fr)] lg:gap-x-14 lg:gap-y-8 lg:px-6 lg:py-20 xl:grid-cols-[minmax(320px,0.65fr)_minmax(0,1.35fr)] xl:gap-x-18">
          <header className="text-center lg:col-start-2 lg:text-left">
            <p className="mb-3 text-caption font-semibold uppercase text-primary">Your host</p>
            <h2 className="text-[2rem] font-bold leading-tight text-foreground md:text-[2.5rem]">
              Dr. David Musnick, MD
            </h2>
          </header>

          <figure className="relative mx-auto aspect-[5/6] w-full max-w-[16rem] overflow-hidden rounded-lg border border-border bg-white lg:col-start-1 lg:row-span-2 lg:row-start-1 lg:max-w-[21rem]">
            <Image
              src="/images/davidmusnicksketch.jpg"
              alt="Portrait illustration of Dr. David Musnick"
              fill
              sizes="(min-width: 1280px) 336px, (min-width: 1024px) 300px, 256px"
              className="object-cover object-center"
            />
            <span className="absolute inset-y-0 left-0 w-1 bg-primary" aria-hidden="true" />
            <span className="absolute bottom-0 left-0 h-1 w-20 bg-accent" aria-hidden="true" />
          </figure>

          <div className="min-w-0 lg:col-start-2">
            <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_9rem] md:items-start md:gap-8">
              <div className="order-2 text-left md:order-1">
                <p className="text-body leading-7 text-foreground-muted">
                  Board-certified in Internal Medicine and Sports Medicine, with deep Functional Medicine
                  training. His work spans concussion, brain-based symptoms, autoimmune conditions,
                  fatigue, arthritis, and gastrointestinal health.
                </p>
              </div>
              <div className="order-1 border-b border-border pb-5 text-center md:order-2 md:border-b-0 md:border-l md:pb-0 md:pl-7 md:text-left">
                <p className="text-[3rem] font-bold leading-none text-accent">
                  {physicianProfileExperience.patientCare}
                </p>
                <p className="mt-2 text-body-sm font-semibold text-foreground-muted">in patient care</p>
              </div>
            </div>

            <div className="mt-6 divide-y divide-border border-y border-border text-left text-body-sm text-foreground-muted md:grid md:grid-cols-3 md:divide-x md:divide-y-0">
              <p className="py-4 md:pr-4">Faculty at IFM, Bastyr, Andrews, and UW</p>
              <p className="py-4 md:px-4">Author of Integrative Neurology and Metabolic Orthopedics</p>
              <p className="py-4 md:pl-4">Pioneer in FSM protocols and integrative concussion rehab</p>
            </div>

            <div className="mt-6 flex items-center justify-center lg:justify-start">
              <Link
                href="/about"
                className="inline-flex min-h-11 items-center gap-2 text-body-sm font-semibold text-primary hover:text-primary-hover"
              >
                About Dr. Musnick
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            <p className="mt-6 border-l-2 border-border pl-4 text-left text-caption leading-5 text-foreground-subtle">
              {SITE_NAME} is for education only and does not replace individualized medical care.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

function FormatLink({
  href,
  icon: Icon,
  eyebrow,
  title,
  body,
}: {
  href: string;
  icon: typeof Mic2;
  eyebrow: string;
  title: string;
  body: string;
}) {
  return (
    <Link
      href={href}
      className="group grid min-h-44 grid-cols-[2.5rem_1fr_auto] gap-x-4 gap-y-2 py-6 transition-colors hover:bg-surface/45 md:block md:min-h-64 md:px-7 md:py-8"
    >
      <Icon className="row-span-2 mt-1 h-5 w-5 text-primary md:mb-12" aria-hidden="true" />
      <div>
        <p className="mb-1 text-caption font-semibold uppercase text-foreground-subtle">{eyebrow}</p>
        <h3 className="text-heading font-bold text-foreground group-hover:text-primary">{title}</h3>
      </div>
      <ArrowRight
        className="mt-2 h-4 w-4 text-foreground-subtle transition-transform group-hover:translate-x-1 group-hover:text-primary md:float-right"
        aria-hidden="true"
      />
      <p className="col-start-2 text-body-sm leading-6 text-foreground-muted md:mt-4">{body}</p>
    </Link>
  );
}

function EpisodeCard({ episode }: { episode: Episode }) {
  return (
    <Link
      href={`/episodes/${episode.slug}`}
      className="group grid min-h-32 grid-cols-[7rem_1fr] overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-primary/60 md:block"
    >
      <div className="relative min-h-32 overflow-hidden bg-surface-elevated md:aspect-video md:min-h-0">
        {episode.thumbnailUrl ? (
          <Image
            src={localImageUrl(episode.thumbnailUrl) ?? episode.thumbnailUrl}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 112px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-primary">
            <Play className="h-6 w-6" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="min-w-0 p-4 md:p-5">
        <div className="mb-2 flex items-center justify-between gap-3 text-caption text-foreground-subtle">
          <span className="capitalize">{episode.topics[0]?.replaceAll("-", " ")}</span>
          {episode.durationMinutes && <span>{episode.durationMinutes} min</span>}
        </div>
        <h3 className="line-clamp-3 text-body font-semibold leading-6 text-foreground group-hover:text-primary md:line-clamp-2">
          {episodeDisplayTitle(episode)}
        </h3>
        <p className="mt-2 hidden text-body-sm leading-6 text-foreground-muted md:line-clamp-2">
          {episode.summary}
        </p>
      </div>
    </Link>
  );
}
