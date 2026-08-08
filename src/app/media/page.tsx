import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  ChefHat,
  Clapperboard,
  LibraryBig,
  Mic2,
  Play,
} from "lucide-react";
import { MEDIA_FEATURES } from "@/data/media";

export const metadata = {
  title: "Media & Features",
  description: "Watch and listen to Dr. David Musnick's talks, interviews, podcast appearances, short clips, and recipe media.",
};

const shortRecipeMedia = MEDIA_FEATURES.filter((media) => media.type === "Short" || media.type === "Recipe");
const videoMedia = MEDIA_FEATURES.filter((media) => media.type === "Video");
const podcastMedia = MEDIA_FEATURES.filter((media) => media.type === "Podcast");
const seriesMedia = MEDIA_FEATURES.filter((media) => media.type === "Series");

const mediaSections = [
  {
    id: "shorts-recipes",
    title: "Shorts & recipes",
    items: shortRecipeMedia,
    icon: ChefHat,
  },
  {
    id: "video-talks",
    title: "Video talks",
    items: videoMedia,
    icon: Clapperboard,
  },
  {
    id: "podcast-appearances",
    title: "Podcast appearances",
    items: podcastMedia,
    icon: Mic2,
  },
  {
    id: "educational-series",
    title: "Educational series",
    items: seriesMedia,
    icon: LibraryBig,
  },
] as const;

export default function MediaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12 lg:px-6 lg:py-16">
      <header className="mb-10 border-b border-border pb-8 sm:mb-12 sm:pb-10">
        <p className="mb-2 text-caption font-semibold uppercase text-primary">
          Media & features
        </p>
        <h1 className="mb-4 max-w-3xl text-4xl font-bold leading-tight text-foreground sm:text-display">
          Talks, interviews & series
        </h1>
        <p className="max-w-2xl text-body text-foreground-muted sm:text-body-lg">
          Explore Dr. Musnick&apos;s appearances across short clips, recipe media, podcasts, video talks,
          and educational series covering functional medicine, sports medicine, and integrative health.
        </p>
      </header>

      {mediaSections.map(({ id, title, items, icon: Icon }) =>
        items.length > 0 ? (
          <section key={id} aria-labelledby={`${id}-heading`} className="mb-12 sm:mb-16">
            <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
              <h2
                id={`${id}-heading`}
                className="flex min-w-0 items-center gap-3 text-2xl font-bold leading-tight text-foreground sm:text-heading-lg"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-strong bg-surface text-primary">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span>{title}</span>
              </h2>
              <span className="shrink-0 text-body-xs text-foreground-subtle">
                {items.length} {items.length === 1 ? "feature" : "features"}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {items.map((media) => (
                <MediaCard key={media.url} media={media} />
              ))}
            </div>
          </section>
        ) : null
      )}

      <section className="grid gap-6 border-y border-border py-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:py-10">
        <div>
          <h2 className="mb-2 text-heading-sm font-semibold text-foreground sm:text-heading">
            Want Dr. Musnick on your show?
          </h2>
          <p className="max-w-2xl text-body-sm text-foreground-muted sm:text-body">
            For interview requests, media features, or collaboration opportunities, reach out through our contact form.
          </p>
        </div>
        <Link
          href="/contact"
          className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md bg-primary px-5 py-2.5 text-body-sm font-semibold text-background transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Get in touch
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </div>
  );
}

function MediaCard({ media }: { media: (typeof MEDIA_FEATURES)[number] }) {
  const external = /^https?:\/\//.test(media.url);
  const action = media.type === "Podcast" ? "Listen" : "Watch";
  return (
    <Link
      href={media.url}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={`${action}: ${media.title} on ${media.platform}${external ? " (opens in a new tab)" : ""}`}
      className="group grid grid-cols-[7.75rem_minmax(0,1fr)] overflow-hidden rounded-lg border border-border bg-surface transition-colors hover:border-border-strong hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:flex sm:flex-col"
    >
      {media.thumbnailUrl ? (
        <div className="relative aspect-[4/3] w-full self-start overflow-hidden bg-surface-elevated sm:aspect-video">
          <Image
            src={media.thumbnailUrl}
            alt=""
            fill
            sizes="(max-width: 639px) 124px, (max-width: 1023px) 50vw, 33vw"
            className="object-contain transition-opacity duration-200 group-hover:opacity-90"
          />
          <span className="absolute bottom-3 left-3 flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-background/90 text-foreground">
            <Play className="h-4 w-4 fill-current" aria-hidden="true" />
          </span>
        </div>
      ) : (
        <div className="flex aspect-[4/3] w-full self-start items-center justify-center bg-surface-elevated text-primary sm:aspect-video">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border-strong bg-background">
            <Play className="h-5 w-5 fill-current" aria-hidden="true" />
          </span>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] font-semibold uppercase leading-4">
          <span className="text-primary">{media.type}</span>
          <span className="text-foreground-subtle" aria-hidden="true">/</span>
          <span className="text-foreground-muted">{media.platform}</span>
        </div>
        <p className="mb-1 text-[0.6875rem] font-semibold leading-4 text-foreground-muted sm:text-body-xs">
          {media.show}
        </p>
        <h3 className="mb-2 text-sm font-semibold leading-5 text-foreground transition-colors group-hover:text-primary sm:text-body sm:leading-6">
          {media.title}
        </h3>
        <p className="text-xs leading-[1.45] text-foreground-muted sm:text-body-sm">
          {media.summary}
        </p>
        <span className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-border pt-2 text-body-xs font-semibold text-primary sm:text-body-sm">
          {action}
          <ArrowUpRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
