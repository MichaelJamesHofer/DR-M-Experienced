'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Episode, episodeDisplayTitle } from "@/data/episodes";

type EpisodeBrowserProps = {
  episodes: Episode[];
  initialTopic?: string;
  affiliateProductsByEpisodeSlug?: Record<string, EpisodeProductReference[]>;
};

type EpisodeProductReference = {
  slug: string;
  displayName: string;
  category: string;
};

type EpisodeSortKey = "newest" | "oldest" | "episode-number" | "title" | "product-linked";
type EpisodeViewMode = "cards" | "list";

export function EpisodeBrowser({
  episodes,
  initialTopic = "all",
  affiliateProductsByEpisodeSlug = {},
}: EpisodeBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedDefault = initialTopic.toLowerCase();

  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(normalizedDefault);
  const [sortKey, setSortKey] = useState<EpisodeSortKey>("newest");
  const [viewMode, setViewMode] = useState<EpisodeViewMode>("cards");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const paramTopic = (searchParams.get("topic") ?? normalizedDefault).toLowerCase();
    if (paramTopic !== topic) {
      setTopic(paramTopic);
    }
  }, [searchParams, normalizedDefault, topic]);

  const topics = useMemo(() => {
    const map = new Map<string, string>();
    episodes.forEach((episode) => {
      episode.topics.forEach((label) => {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      });
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [episodes]);

  const updateTopic = useCallback(
    (nextTopic: string) => {
      setTopic(nextTopic);
      const params = new URLSearchParams(searchParams.toString());
      if (nextTopic === normalizedDefault) {
        params.delete("topic");
      } else {
        params.set("topic", nextTopic);
      }
      const queryString = params.toString();
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    },
    [normalizedDefault, pathname, router, searchParams]
  );

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    episodes.forEach((episode) => {
      episode.topics.forEach((episodeTopic) => {
        const value = episodeTopic.toLowerCase();
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    });
    return counts;
  }, [episodes]);

  const filtered = useMemo(() => {
    return episodes
      .filter((episode) => {
        const relatedProducts = affiliateProductsByEpisodeSlug[episode.slug] ?? [];
        const matchesTopic =
          topic === "all" ||
          episode.topics.some((episodeTopic) => episodeTopic.toLowerCase() === topic);
        const text = [
          episodeDisplayTitle(episode),
          episode.title,
          episode.summary,
          ...episode.topics,
          ...relatedProducts.map((product) => product.displayName),
          ...relatedProducts.map((product) => product.category),
        ]
          .join(" ")
          .toLowerCase();
        const matchesQuery = text.includes(query.toLowerCase());
        return matchesTopic && matchesQuery;
      })
      .sort((a, b) => compareEpisodes(a, b, sortKey, affiliateProductsByEpisodeSlug));
  }, [affiliateProductsByEpisodeSlug, episodes, query, sortKey, topic]);

  const activeFacetCount = topic === "all" ? 0 : 1;
  const activeTopicLabel = topics.find((topicOption) => topicOption.value === topic)?.label;
  const hasActiveFilters = query !== "" || topic !== "all";

  const resetAll = () => {
    setQuery("");
    updateTopic("all");
  };

  const toggleFilterPanel = () => {
    const shouldOpen = !filterPanelOpen;
    setFilterPanelOpen(shouldOpen);
    if (shouldOpen) {
      window.setTimeout(() => {
        controlsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);
    }
  };

  return (
    <div className="min-w-0 space-y-8">
      <div
        ref={controlsRef}
        className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label className="text-body-sm font-semibold text-foreground mb-2 block">
              Search episodes
            </label>
            <div className="relative min-w-0">
              <svg
                className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-foreground-subtle"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="search"
                placeholder="Search titles, topics, summaries, or products..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="w-full rounded-xl border border-border bg-background pl-12 pr-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
              />
            </div>
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-2 text-body-sm font-semibold text-foreground">Filters</p>
            <button
              type="button"
              onClick={toggleFilterPanel}
              aria-expanded={filterPanelOpen}
              className={`flex h-[50px] min-w-36 items-center justify-center gap-2 rounded-xl border px-4 text-body-sm font-semibold transition-all duration-200 ${
                filterPanelOpen || activeFacetCount > 0
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground-muted hover:border-primary/50 hover:text-foreground"
              }`}
            >
              Refine
              <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-caption text-foreground-subtle">
                {activeFacetCount}
              </span>
            </button>
          </div>

          <div className="hidden min-w-0 sm:block">
            <label className="text-body-sm font-semibold text-foreground mb-2 block">Sort</label>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as EpisodeSortKey)}
              className="h-[50px] w-full min-w-0 rounded-xl border border-border bg-background px-4 text-body-sm font-medium text-foreground-muted transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-52 lg:w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="episode-number">Episode number</option>
              <option value="title">Title A-Z</option>
              <option value="product-linked">Most product-linked</option>
            </select>
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-2 text-body-sm font-semibold text-foreground">View</p>
            <div className="grid h-[50px] min-w-0 grid-cols-2 rounded-xl border border-border bg-background p-1">
              {(["cards", "list"] as EpisodeViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`rounded-lg px-4 text-body-sm font-semibold transition-all duration-200 ${
                    viewMode === mode
                      ? "bg-primary text-background"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {mode === "cards" ? "Cards" : "List"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MobileEpisodeCommandBar
          activeFacetCount={activeFacetCount}
          filterPanelOpen={filterPanelOpen}
          onToggleFilters={toggleFilterPanel}
          sortKey={sortKey}
          onSortChange={setSortKey}
          viewMode={viewMode}
          onToggleView={() => setViewMode(viewMode === "cards" ? "list" : "cards")}
        />

        {(activeTopicLabel || filterPanelOpen) && (
          <div className="mt-5 border-t border-border pt-5">
            {activeTopicLabel && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-caption font-semibold uppercase tracking-wider text-foreground-subtle">
                  Applied
                </span>
                <AppliedTopicChip label={activeTopicLabel} onRemove={() => updateTopic("all")} />
                <button
                  type="button"
                  onClick={() => updateTopic("all")}
                  className="rounded-full border border-border bg-background px-3 py-1.5 text-caption font-semibold text-foreground-subtle transition-all duration-200 hover:border-primary/50 hover:text-foreground"
                >
                  Clear topic
                </button>
              </div>
            )}

            {filterPanelOpen && (
              <div className="rounded-2xl border border-border bg-background p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-body-sm font-semibold text-foreground">Refine episodes</p>
                    <p className="text-body-sm text-foreground-muted">
                      Narrow by topic without turning the page into a full tag wall.
                    </p>
                  </div>
                  <p className="text-body-sm text-foreground-muted">
                    {filtered.length} of {episodes.length} episodes
                  </p>
                </div>

                <TopicSelect
                  value={topic}
                  allCount={episodes.length}
                  options={topics.map((topicOption) => ({
                    ...topicOption,
                    count: topicCounts.get(topicOption.value) ?? 0,
                  }))}
                  onChange={updateTopic}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-foreground-muted">
          {filtered.length} episode{filtered.length !== 1 ? "s" : ""}
          {topic !== "all" && ` in "${activeTopicLabel ?? topic}"`}
          {query && ` matching "${query}"`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="self-start text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200 sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className={viewMode === "cards" ? "grid gap-6 md:grid-cols-2" : "space-y-5"}>
          {filtered.map((episode) => (
            <EpisodeCard
              key={episode.slug}
              episode={episode}
              relatedProducts={affiliateProductsByEpisodeSlug[episode.slug] ?? []}
              variant={viewMode}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-body text-foreground-muted mb-2">No episodes match your criteria</p>
          <button
            type="button"
            onClick={resetAll}
            className="text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function TopicSelect({
  value,
  allCount,
  options,
  onChange,
}: {
  value: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-body-sm font-semibold text-foreground">Topic</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[50px] w-full rounded-xl border border-border bg-surface px-4 text-body-sm font-medium text-foreground-muted transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="all">All topics ({allCount})</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </div>
  );
}

function AppliedTopicChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex max-w-full items-center gap-2 rounded-full border border-primary bg-primary/10 px-3 py-1.5 text-caption font-semibold text-primary transition-all duration-200 hover:bg-primary/15"
    >
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden="true">x</span>
    </button>
  );
}

function MobileEpisodeCommandBar({
  activeFacetCount,
  filterPanelOpen,
  onToggleFilters,
  sortKey,
  onSortChange,
  viewMode,
  onToggleView,
}: {
  activeFacetCount: number;
  filterPanelOpen: boolean;
  onToggleFilters: () => void;
  sortKey: EpisodeSortKey;
  onSortChange: (value: EpisodeSortKey) => void;
  viewMode: EpisodeViewMode;
  onToggleView: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-border bg-background p-2 sm:hidden">
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filterPanelOpen}
        className={`rounded-xl px-2 py-3 text-caption font-bold transition-all duration-200 ${
          filterPanelOpen || activeFacetCount > 0
            ? "bg-primary text-background"
            : "bg-surface text-foreground-muted"
        }`}
      >
        Filters {activeFacetCount}
      </button>
      <label className="relative">
        <span className="sr-only">Sort episodes</span>
        <select
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as EpisodeSortKey)}
          className="h-full w-full appearance-none rounded-xl border-0 bg-surface px-2 py-3 text-center text-caption font-bold text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="episode-number">Number</option>
          <option value="title">Title</option>
          <option value="product-linked">Products</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleView}
        className="rounded-xl bg-surface px-2 py-3 text-caption font-bold text-foreground-muted transition-all duration-200 hover:text-foreground"
      >
        {viewMode === "cards" ? "Cards" : "List"}
      </button>
    </div>
  );
}

function EpisodeCard({
  episode,
  relatedProducts,
  variant,
}: {
  episode: Episode;
  relatedProducts: EpisodeProductReference[];
  variant: EpisodeViewMode;
}) {
  const dateFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const publishDate = dateFormatter.format(new Date(episode.publishDate));
  const hasEmbeddableVideo = !!episode.vimeoId;

  return (
    <Link
      href={`/episodes/${episode.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm ${
        variant === "list" ? "md:flex-row" : ""
      }`}
    >
      {/* Thumbnail */}
      {episode.thumbnailUrl && (
        <div
          className={`relative aspect-video w-full overflow-hidden bg-surface-elevated ${
            variant === "list" ? "md:min-h-64 md:w-72 md:shrink-0 md:aspect-auto" : ""
          }`}
        >
          <Image
            src={episode.thumbnailUrl}
            alt={episodeDisplayTitle(episode)}
            fill
            className={`object-cover transition-transform duration-300 ${
              !hasEmbeddableVideo ? "opacity-50" : "group-hover:scale-105"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
          {!hasEmbeddableVideo && (
            <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent" />
          )}
          <div className="absolute top-4 left-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/90 backdrop-blur text-body-sm font-bold text-background">
              {episode.number.toString().padStart(2, "0")}
            </span>
          </div>
          {!hasEmbeddableVideo ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 px-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 backdrop-blur-sm border-2 border-primary/30 text-primary">
                  <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-caption font-semibold text-background drop-shadow-lg text-center">
                  Video Coming Soon
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 text-caption text-background bg-black/50 backdrop-blur rounded-full px-3 py-1.5">
              {episode.durationMinutes && (
                <>
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                  <span>{episode.durationMinutes} min</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Header - only show if no thumbnail */}
        {!episode.thumbnailUrl && (
          <div className="flex items-center justify-between mb-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-body-sm font-bold text-primary group-hover:bg-primary group-hover:text-background transition-all duration-200">
              {episode.number.toString().padStart(2, "0")}
            </span>
            <div className="flex items-center gap-3 text-caption text-foreground-subtle">
              <span>{publishDate}</span>
              {episode.durationMinutes && (
                <>
                  <span>•</span>
                  <span>{episode.durationMinutes} min</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* Date for thumbnailed episodes */}
        {episode.thumbnailUrl && (
          <div className="mb-2">
            <span className="text-caption text-foreground-subtle">{publishDate}</span>
          </div>
        )}

        {/* Content */}
        <h3 className="text-heading font-semibold text-foreground group-hover:text-primary transition-colors duration-200 mb-2">
          {episodeDisplayTitle(episode)}
        </h3>
        <p className="text-body-sm text-foreground-muted line-clamp-2 mb-4 flex-1">
          {episode.summary}
        </p>

        {/* Topics */}
        <div className="flex flex-wrap gap-2 mb-4">
          {episode.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
            >
              {topic}
            </span>
          ))}
        </div>

        {relatedProducts.length > 0 && (
          <div className="mb-4 rounded-xl border border-border bg-background p-3">
            <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
              Products mentioned
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedProducts.slice(0, 3).map((product) => (
                <span
                  key={product.slug}
                  className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
                >
                  {product.displayName}
                </span>
              ))}
              {relatedProducts.length > 3 && (
                <span className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle">
                  +{relatedProducts.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <span className="text-body-sm font-medium text-primary group-hover:text-primary-hover transition-colors duration-200">
            Listen & read notes
          </span>
          <svg
            className="h-4 w-4 text-foreground-muted group-hover:text-primary group-hover:translate-x-1 transition-all duration-200"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}

function compareEpisodes(
  a: Episode,
  b: Episode,
  sortKey: EpisodeSortKey,
  affiliateProductsByEpisodeSlug: Record<string, EpisodeProductReference[]>
) {
  if (sortKey === "oldest") {
    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    if (dateA !== dateB) return dateA - dateB;
    return a.number - b.number;
  }

  if (sortKey === "episode-number") {
    return a.number - b.number;
  }

  if (sortKey === "title") {
    return episodeDisplayTitle(a).localeCompare(episodeDisplayTitle(b));
  }

  if (sortKey === "product-linked") {
    const countA = affiliateProductsByEpisodeSlug[a.slug]?.length ?? 0;
    const countB = affiliateProductsByEpisodeSlug[b.slug]?.length ?? 0;
    if (countA !== countB) return countB - countA;
  }

  const dateA = new Date(a.publishDate).getTime();
  const dateB = new Date(b.publishDate).getTime();
  if (dateA !== dateB) return dateB - dateA;
  return b.number - a.number;
}
