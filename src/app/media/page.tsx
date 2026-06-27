import Link from "next/link";
import Image from "next/image";
import { MEDIA_FEATURES } from "@/data/media";

export const metadata = {
  title: "Media & Features",
  description: "Watch and listen to Dr. David Musnick's talks, interviews, podcast appearances, short clips, and recipe media.",
};

// Group media by type
const shortRecipeMedia = MEDIA_FEATURES.filter((m) => m.type === "Short" || m.type === "Recipe");
const videoMedia = MEDIA_FEATURES.filter((m) => m.type === "Video");
const podcastMedia = MEDIA_FEATURES.filter((m) => m.type === "Podcast");
const seriesMedia = MEDIA_FEATURES.filter((m) => m.type === "Series");

export default function MediaPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      {/* Header */}
      <div className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Media & features
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Talks, interviews & series
        </h1>
        <p className="text-body-lg text-foreground-muted max-w-2xl">
          Explore Dr. Musnick&apos;s appearances across short clips, recipe media, podcasts, video talks,
          and educational series covering functional medicine, sports medicine, and integrative health.
        </p>
      </div>

      {/* Shorts & Recipes */}
      {shortRecipeMedia.length > 0 && (
        <section className="mb-16">
          <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-caption font-bold text-primary">
              SR
            </span>
            Shorts & recipes
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {shortRecipeMedia.map((media) => (
              <MediaCard key={media.url} media={media} />
            ))}
          </div>
        </section>
      )}

      {/* Video Talks */}
      {videoMedia.length > 0 && (
        <section className="mb-16">
          <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              🎬
            </span>
            Video talks
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {videoMedia.map((media) => (
              <MediaCard key={media.url} media={media} />
            ))}
          </div>
        </section>
      )}

      {/* Podcasts */}
      {podcastMedia.length > 0 && (
        <section className="mb-16">
          <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              🎙️
            </span>
            Podcast appearances
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {podcastMedia.map((media) => (
              <MediaCard key={media.url} media={media} />
            ))}
          </div>
        </section>
      )}

      {/* Series */}
      {seriesMedia.length > 0 && (
        <section className="mb-16">
          <h2 className="text-heading-lg font-bold text-foreground mb-6 flex items-center gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              📚
            </span>
            Educational series
          </h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {seriesMedia.map((media) => (
              <MediaCard key={media.url} media={media} />
            ))}
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h3 className="text-heading font-semibold text-foreground mb-3">
          Want Dr. Musnick on your show?
        </h3>
        <p className="text-body text-foreground-muted mb-6 max-w-lg mx-auto">
          For interview requests, media features, or collaboration opportunities, 
          reach out through our contact form.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-body font-semibold text-background hover:bg-primary-hover transition-all duration-200"
        >
          Get in touch
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </section>
    </div>
  );
}

function MediaCard({ media }: { media: typeof MEDIA_FEATURES[number] }) {
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 hover:shadow-glow-sm transition-all duration-300"
    >
      {/* Thumbnail */}
      {media.thumbnailUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-surface-elevated">
          <Image
            src={media.thumbnailUrl}
            alt={media.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 backdrop-blur text-background group-hover:bg-primary group-hover:scale-110 transition-all duration-300">
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </div>
          </div>
        </div>
      ) : (
        <div className="aspect-video bg-gradient-to-br from-surface-elevated to-surface flex items-center justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:bg-primary group-hover:text-background transition-all duration-300">
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      )}
      <div className="p-5 flex-1 flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="rounded-full bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
            {media.type}
          </span>
          <span className="text-caption text-foreground-subtle">
            {media.platform}
          </span>
        </div>
        <p className="text-caption font-semibold text-foreground-muted mb-1">
          {media.show}
        </p>
        <h3 className="text-body font-semibold text-foreground group-hover:text-primary transition-colors duration-200 mb-2 line-clamp-2">
          {media.title}
        </h3>
        <p className="text-body-sm text-foreground-muted line-clamp-2 flex-1">
          {media.summary}
        </p>
        <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
          <span className="text-body-sm font-medium text-primary group-hover:text-primary-hover transition-colors duration-200">
            {media.type === "Podcast" ? "Listen" : "Watch"}
          </span>
          <svg
            className="h-4 w-4 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </div>
      </div>
    </a>
  );
}
