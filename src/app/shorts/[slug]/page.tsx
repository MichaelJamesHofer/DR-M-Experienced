import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { VimeoPlayer } from "@/components/vimeo-player";
import { getContentCatalog } from "@/data/content-catalog";
import { episodeDisplayTitle } from "@/data/episodes";
import { SHORTS, shortDurationLabel, type ShortFormContent } from "@/data/shorts";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export const dynamicParams = false;

export function generateStaticParams() {
  return SHORTS.map((item) => ({ slug: item.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const item = SHORTS.find((short) => short.slug === slug);
  if (!item) return { title: "Short not found" };

  return {
    title: item.title,
    description: item.summary,
    alternates: { canonical: item.websitePath },
    openGraph: {
      title: item.title,
      description: item.summary,
      url: item.websitePath,
      type: "video.other",
      images: [{ url: item.posterUrl, width: item.posterWidth, height: item.posterHeight, alt: item.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: item.title,
      description: item.summary,
      images: [item.posterUrl],
    },
  };
}

export default async function ShortDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = SHORTS.find((short) => short.slug === slug);
  if (!item) notFound();

  const { episodes } = await getContentCatalog();
  const relatedEpisodes = episodes.filter((episode) =>
    item.relatedEpisodeNumbers.includes(episode.number)
  );
  const publishedDate = dateFormatter.format(new Date(item.instagram.publishedAt));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <nav className="mb-8 flex min-w-0 items-center gap-2 text-body-sm text-foreground-muted">
        <Link href="/" className="shrink-0 transition-colors duration-200 hover:text-foreground">
          Home
        </Link>
        <span className="shrink-0">/</span>
        <Link href="/media" className="shrink-0 transition-colors duration-200 hover:text-foreground">
          Media
        </Link>
        <span className="shrink-0">/</span>
        <span className="line-clamp-1 min-w-0 text-foreground">{item.title}</span>
      </nav>

      <div className="grid min-w-0 items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:gap-14">
        <article className="min-w-0">
          <header className="mb-8">
            <div className="mb-4 flex flex-wrap items-center gap-3 text-body-sm text-foreground-muted">
              <span>{item.contentType === "recipe" ? "Recipe" : "Short"}</span>
              <span aria-hidden="true">•</span>
              <span>{shortDurationLabel(item.durationSeconds)}</span>
              <span aria-hidden="true">•</span>
              <span>{publishedDate}</span>
            </div>
            <h1 className="mb-4 break-words text-heading-xl font-bold !tracking-normal text-foreground sm:text-display">
              {item.title}
            </h1>
            <p className="text-body-lg text-foreground-muted">{item.summary}</p>
            <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
              {item.topics.map((topic) => (
                <span
                  key={topic}
                  className="shrink-0 rounded-full border border-border bg-surface px-4 py-2 text-body-sm text-foreground-muted"
                >
                  {topic.replaceAll("-", " ")}
                </span>
              ))}
            </div>
          </header>

          <div className="mb-8 lg:hidden">
            <ShortPlayback item={item} />
          </div>

          <div className="space-y-4 text-body text-foreground-muted">
            {item.body.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>

          {item.ingredients && item.ingredients.length > 0 && (
            <section className="mt-8 border-t border-border pt-8">
              <h2 className="mb-4 text-heading font-semibold text-foreground">Ingredients shown</h2>
              <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
                {item.ingredients.map((ingredient) => (
                  <li key={ingredient} className="flex items-center gap-3 text-body text-foreground-muted">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    {ingredient}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {relatedEpisodes.length > 0 && (
            <section className="mt-8 border-t border-border pt-8">
              <h2 className="mb-4 text-heading font-semibold text-foreground">Continue with the full episode</h2>
              {relatedEpisodes.map((episode) => (
                <Link
                  key={episode.slug}
                  href={`/episodes/${episode.slug}`}
                  className="flex items-center justify-between gap-4 border-b border-border py-4 text-body font-medium text-foreground transition-colors hover:text-primary"
                >
                  <span>{episodeDisplayTitle(episode)}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              ))}
            </section>
          )}
        </article>

        <aside className="hidden min-w-0 lg:sticky lg:top-24 lg:block">
          <ShortPlayback item={item} />
        </aside>
      </div>
    </div>
  );
}

function ShortPlayback({ item }: { item: ShortFormContent }) {
  const isPortrait = item.posterHeight > item.posterWidth;

  return (
    <div className={`mx-auto overflow-hidden rounded-lg border border-border bg-surface ${isPortrait ? "max-w-sm" : "max-w-lg"}`}>
      {item.vimeo ? (
        <VimeoPlayer
          videoId={item.vimeo.id}
          title={item.title}
          thumbnailUrl={item.posterUrl}
          aspectClassName={isPortrait ? "aspect-[9/16]" : "aspect-video"}
          analyticsContext={{
            contentType: "media",
            mediaType: item.contentType,
            platform: "vimeo",
          }}
        />
      ) : (
        <div className={`relative ${isPortrait ? "aspect-[9/16]" : "aspect-video"}`}>
          <Image src={item.posterUrl} alt={item.title} fill className="object-cover" />
        </div>
      )}
      <div className="flex flex-wrap gap-3 border-t border-border p-4">
        <a
          href={item.instagram.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-background transition-colors hover:bg-primary-hover"
        >
          Watch on Instagram
        </a>
        {item.vimeo && (
          <a
            href={item.vimeo.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-lg border border-border px-4 py-2 text-body-sm font-semibold text-foreground transition-colors hover:border-primary hover:text-primary"
          >
            Open on Vimeo
          </a>
        )}
      </div>
    </div>
  );
}
