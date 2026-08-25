'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  ArrowUpDown,
  Clock3,
  LayoutGrid,
  List,
  Play,
  Search,
  SlidersHorizontal,
} from "lucide-react";
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

function episodeTopicLabel(topic: string) {
  return topic
    .split("-")
    .map((word) => (word.toLowerCase() === "emf" ? "EMF" : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join(" ");
}

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
          map.set(value, episodeTopicLabel(label));
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

  const activeTopicLabel = topics.find((topicOption) => topicOption.value === topic)?.label;
  const hasActiveFilters = query !== "" || topic !== "all";

  const resetAll = () => {
    setQuery("");
    updateTopic("all");
  };

  return (
    <div className="min-w-0 space-y-6 sm:space-y-8">
      <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-surface p-3 sm:p-4">
        <div className="grid min-w-0 gap-3 min-[900px]:grid-cols-[minmax(0,1fr)_minmax(10rem,12rem)_minmax(10rem,12rem)_10rem] min-[900px]:items-end">
          <div className="min-w-0">
            <label
              htmlFor="episode-search"
              className="mb-1.5 block text-body-sm font-semibold text-foreground"
            >
              Search episodes
            </label>
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-subtle"
              />
              <input
                id="episode-search"
                type="search"
                placeholder="Search episodes..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-12 w-full min-w-0 rounded-md border border-border bg-background pl-11 pr-4 text-body text-foreground placeholder:text-foreground-subtle transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="hidden min-w-0 min-[900px]:block">
            <TopicSelect
              id="episode-topic-wide"
              value={topic}
              allCount={episodes.length}
              options={topics.map((topicOption) => ({
                ...topicOption,
                count: topicCounts.get(topicOption.value) ?? 0,
              }))}
              onChange={updateTopic}
            />
          </div>

          <div className="hidden min-w-0 min-[900px]:block">
            <label
              htmlFor="episode-sort-wide"
              className="mb-1.5 block text-body-sm font-semibold text-foreground"
            >
              Sort
            </label>
            <select
              id="episode-sort-wide"
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as EpisodeSortKey)}
              className="h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 text-body-sm font-medium text-foreground-muted transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="episode-number">Original order</option>
              <option value="title">Title A-Z</option>
              <option value="product-linked">Most product-linked</option>
            </select>
          </div>

          <div
            role="group"
            aria-label="Episode view"
            className="hidden min-w-0 min-[900px]:block"
          >
            <p className="mb-1.5 text-body-sm font-semibold text-foreground">View</p>
            <div className="grid h-12 min-w-0 grid-cols-2 rounded-lg border border-border bg-background p-1">
              {(["cards", "list"] as EpisodeViewMode[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  aria-pressed={viewMode === mode}
                  className={`flex items-center justify-center gap-1.5 rounded-md px-2 text-caption font-semibold transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 ${
                    viewMode === mode
                      ? "bg-primary text-background"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {mode === "cards" ? (
                    <LayoutGrid aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <List aria-hidden="true" className="h-4 w-4" />
                  )}
                  {mode === "cards" ? "Cards" : "List"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MobileEpisodeCommandBar
          topic={topic}
          topicOptions={topics.map((topicOption) => ({
            ...topicOption,
            count: topicCounts.get(topicOption.value) ?? 0,
          }))}
          onTopicChange={updateTopic}
          sortKey={sortKey}
          onSortChange={setSortKey}
          viewMode={viewMode}
          onToggleView={() => setViewMode(viewMode === "cards" ? "list" : "cards")}
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p aria-live="polite" aria-atomic="true" className="text-body-sm text-foreground-muted">
          {filtered.length} episode{filtered.length !== 1 ? "s" : ""}
          {topic !== "all" && ` in "${activeTopicLabel ?? topic}"`}
          {query && ` matching "${query}"`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="flex min-h-11 items-center self-start text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {filtered.length > 0 ? (
        <div className={viewMode === "cards" ? "grid gap-4 sm:gap-6 md:grid-cols-2" : "space-y-3 sm:space-y-5"}>
          {filtered.map((episode, index) => (
            <EpisodeCard
              key={episode.slug}
              episode={episode}
              relatedProducts={affiliateProductsByEpisodeSlug[episode.slug] ?? []}
              variant={viewMode}
              priority={index < 2}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center sm:p-12">
          <p className="text-body text-foreground-muted mb-2">No episodes match your criteria</p>
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function TopicSelect({
  id,
  value,
  allCount,
  options,
  onChange,
}: {
  id: string;
  value: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-body-sm font-semibold text-foreground">
        Topic
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 w-full min-w-0 rounded-md border border-border bg-background px-3 text-body-sm font-medium text-foreground-muted transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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

function MobileEpisodeCommandBar({
  topic,
  topicOptions,
  onTopicChange,
  sortKey,
  onSortChange,
  viewMode,
  onToggleView,
}: {
  topic: string;
  topicOptions: Array<{ value: string; label: string; count: number }>;
  onTopicChange: (value: string) => void;
  sortKey: EpisodeSortKey;
  onSortChange: (value: EpisodeSortKey) => void;
  viewMode: EpisodeViewMode;
  onToggleView: () => void;
}) {
  return (
    <div className="mt-3 grid min-w-0 grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_3rem] gap-1.5 border-t border-border pt-3 min-[900px]:hidden">
      <label className="relative min-w-0">
        <span className="sr-only">Filter episodes by topic</span>
        <SlidersHorizontal
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
        />
        <select
          value={topic}
          onChange={(event) => onTopicChange(event.target.value)}
          className="h-12 w-full min-w-0 appearance-none rounded-md border border-border bg-background pl-8 pr-3 text-caption font-semibold text-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="all">All topics</option>
          {topicOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} ({option.count})
            </option>
          ))}
        </select>
      </label>
      <label className="relative min-w-0">
        <span className="sr-only">Sort episodes</span>
        <ArrowUpDown
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
        />
        <select
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as EpisodeSortKey)}
          className="h-12 w-full min-w-0 appearance-none rounded-md border border-border bg-background pl-8 pr-4 text-caption font-semibold text-foreground-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="episode-number">Order</option>
          <option value="title">Title</option>
          <option value="product-linked">Products</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleView}
        aria-label={viewMode === "cards" ? "Switch to list view" : "Switch to card view"}
        title={viewMode === "cards" ? "List view" : "Card view"}
        className="flex h-12 w-12 items-center justify-center rounded-md border border-border bg-background text-foreground-muted transition-colors duration-200 hover:border-primary/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        {viewMode === "cards" ? (
          <List aria-hidden="true" className="h-5 w-5" />
        ) : (
          <LayoutGrid aria-hidden="true" className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

function EpisodeCard({
  episode,
  relatedProducts,
  variant,
  priority,
}: {
  episode: Episode;
  relatedProducts: EpisodeProductReference[];
  variant: EpisodeViewMode;
  priority: boolean;
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
      className={`group flex min-w-0 overflow-hidden rounded-lg border border-border bg-surface transition-[border-color,box-shadow] duration-300 hover:border-primary/50 hover:shadow-glow-sm focus-visible:border-primary/60 focus-visible:shadow-glow-sm ${
        variant === "list" ? "flex-row" : "flex-col"
      }`}
    >
      {/* Thumbnail */}
      {episode.thumbnailUrl && (
        <div
          className={`relative overflow-hidden bg-surface-elevated ${
            variant === "list"
              ? "min-h-36 w-28 shrink-0 self-stretch sm:w-40 md:min-h-64 md:w-72"
              : "aspect-video w-full"
          }`}
        >
          <Image
            src={episode.thumbnailUrl}
            alt={episodeDisplayTitle(episode)}
            fill
            priority={priority}
            className={`object-cover transition-transform duration-300 ${
              !hasEmbeddableVideo ? "opacity-50" : "group-hover:scale-105"
            }`}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
          {!hasEmbeddableVideo && (
            <div className="absolute inset-0 bg-gradient-to-t from-surface/90 via-surface/50 to-transparent" />
          )}
          {!hasEmbeddableVideo ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 px-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-primary/30 bg-primary/20 text-primary backdrop-blur-sm sm:h-12 sm:w-12">
                  <Clock3 aria-hidden="true" className="h-5 w-5 sm:h-6 sm:w-6" />
                </div>
                <p
                  className={`text-center text-caption font-semibold text-background drop-shadow-lg ${
                    variant === "list" ? "hidden sm:block" : ""
                  }`}
                >
                  Video Coming Soon
                </p>
              </div>
            </div>
          ) : (
            <div className="absolute bottom-2 right-2 flex items-center gap-1.5 rounded-md bg-black/60 px-2 py-1 text-caption text-background backdrop-blur sm:bottom-4 sm:right-4 sm:px-3 sm:py-1.5">
              {episode.durationMinutes && (
                <>
                  <Play aria-hidden="true" className="h-3 w-3 fill-current" />
                  <span>{episode.durationMinutes} min</span>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div
        className={`flex min-w-0 flex-1 flex-col ${
          variant === "list" ? "p-3 sm:p-5 md:p-6" : "p-4 sm:p-6"
        }`}
      >
        {/* Date and duration for episodes without a thumbnail */}
        {!episode.thumbnailUrl && (
          <div className="mb-4 flex min-h-11 items-center justify-between">
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
        <h3
          className={`mb-2 break-words font-semibold text-foreground transition-colors duration-200 group-hover:text-primary ${
            variant === "list" ? "line-clamp-3 text-body-sm sm:text-heading" : "text-heading"
          }`}
        >
          {episodeDisplayTitle(episode)}
        </h3>
        <p
          className={`mb-4 flex-1 text-body-sm text-foreground-muted ${
            variant === "list" ? "hidden sm:line-clamp-2" : "line-clamp-2"
          }`}
        >
          {episode.summary}
        </p>

        {/* Topics */}
        <div
          className={`mb-4 flex-wrap gap-2 ${variant === "list" ? "hidden sm:flex" : "flex"}`}
        >
          {episode.topics.map((topic) => (
            <span
              key={topic}
              className="rounded-sm bg-surface-elevated px-2.5 py-1 text-caption text-foreground-subtle"
            >
              {episodeTopicLabel(topic)}
            </span>
          ))}
        </div>

        {relatedProducts.length > 0 && (
          <div
            className={`mb-4 rounded-lg border border-border bg-background p-3 ${
              variant === "list" ? "hidden sm:block" : ""
            }`}
          >
            <p className="mb-2 text-caption font-semibold uppercase text-primary">
              Products mentioned
            </p>
            <div className="flex flex-wrap gap-2">
              {relatedProducts.slice(0, 3).map((product) => (
                <span
                  key={product.slug}
                  className="rounded-sm bg-surface-elevated px-2.5 py-1 text-caption text-foreground-subtle"
                >
                  {product.displayName}
                </span>
              ))}
              {relatedProducts.length > 3 && (
                <span className="rounded-sm bg-surface-elevated px-2.5 py-1 text-caption text-foreground-subtle">
                  +{relatedProducts.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-auto flex min-h-11 items-center justify-between border-t border-border pt-3 sm:pt-4">
          <span className="text-body-sm font-medium text-primary group-hover:text-primary-hover transition-colors duration-200">
            {variant === "list" ? (
              <>
                <span className="sm:hidden">Open</span>
                <span className="hidden sm:inline">Listen &amp; read notes</span>
              </>
            ) : (
              "Listen & read notes"
            )}
          </span>
          <ArrowRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-foreground-muted transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary"
          />
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
