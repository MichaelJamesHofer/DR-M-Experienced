import { Suspense } from "react";
import {
  affiliateDisplayName,
  affiliateProductsForEpisode,
} from "@/data/affiliates";
import { getContentCatalog } from "@/data/content-catalog";
import { EpisodeBrowser } from "@/components/episode-browser";

export const metadata = {
  title: "Episodes",
  description: "Browse all Dr. M Experienced, with Dr. David Musnick episodes. Search by topic, skim summaries, and dive into detailed show notes.",
};

export default async function EpisodesPage() {
  const { episodes, affiliateProducts } = await getContentCatalog();
  const episodesNewestFirst = [...episodes].sort((a, b) => {
    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    if (dateB !== dateA) return dateB - dateA;
    return b.number - a.number;
  });

  const affiliateProductsByEpisodeSlug = Object.fromEntries(
    episodesNewestFirst.map((episode) => [
      episode.slug,
      affiliateProductsForEpisode(episode, affiliateProducts).map((product) => ({
        slug: product.slug,
        displayName: affiliateDisplayName(product),
        category: product.category,
      })),
    ])
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-6 lg:py-14">
      {/* Header */}
      <div className="mb-8">
        <p className="mb-2 text-caption font-semibold uppercase text-primary">
          Episode library
        </p>
        <h1 className="mb-3 text-[2.25rem] font-bold leading-tight text-foreground sm:text-display">
          All episodes
        </h1>
        <p className="max-w-2xl text-body text-foreground-muted sm:text-body-lg">
          Search by topic, skim summaries, and jump into detailed show notes with 
          timestamps, references, and actionable checklists.
        </p>
      </div>

      {/* Episode Browser */}
      <Suspense fallback={<EpisodeBrowserSkeleton />}>
        <EpisodeBrowser
          episodes={episodesNewestFirst}
          affiliateProductsByEpisodeSlug={affiliateProductsByEpisodeSlug}
        />
      </Suspense>
    </div>
  );
}

function EpisodeBrowserSkeleton() {
  return (
    <div className="space-y-6">
      {/* Filter skeleton */}
      <div className="rounded-lg border border-border bg-surface p-6">
        <div className="h-12 rounded-lg bg-surface-elevated animate-pulse mb-4" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-10 w-24 rounded-full bg-surface-elevated animate-pulse" />
          ))}
        </div>
      </div>
      {/* Episode cards skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-lg border border-border bg-surface p-6">
            <div className="h-6 w-20 rounded bg-surface-elevated animate-pulse mb-4" />
            <div className="h-7 w-3/4 rounded bg-surface-elevated animate-pulse mb-3" />
            <div className="h-16 rounded bg-surface-elevated animate-pulse mb-4" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
              <div className="h-6 w-16 rounded-full bg-surface-elevated animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
