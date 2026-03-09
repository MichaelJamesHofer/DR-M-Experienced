'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Episode } from "@/data/episodes";

type EpisodeBrowserProps = {
  episodes: Episode[];
  initialTopic?: string;
};

export function EpisodeBrowser({ episodes, initialTopic = "all" }: EpisodeBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedDefault = initialTopic.toLowerCase();

  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(normalizedDefault);

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

  const filtered = episodes.filter((episode) => {
    const matchesTopic =
      topic === "all" || episode.topics.some((episodeTopic) => episodeTopic.toLowerCase() === topic);
    const text = `${episode.title} ${episode.summary}`.toLowerCase();
    const matchesQuery = text.includes(query.toLowerCase());
    return matchesTopic && matchesQuery;
  });

  return (
    <div className="space-y-8">
      {/* Filters */}
      <div className="rounded-2xl border border-border bg-surface p-6">
        {/* Search */}
        <div className="mb-6">
          <label className="text-body-sm font-medium text-foreground mb-2 block">
            Search episodes
          </label>
          <div className="relative">
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
              placeholder="Search by title or summary..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="w-full rounded-xl border border-border bg-background pl-12 pr-4 py-3 text-body text-foreground placeholder:text-foreground-subtle focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all duration-200"
            />
          </div>
        </div>

        {/* Topic filters */}
        <div>
          <p className="text-body-sm font-medium text-foreground mb-3">Filter by topic</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => updateTopic("all")}
              className={`rounded-full border px-4 py-2 text-body-sm font-medium transition-all duration-200 ${
                topic === "all"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-foreground-muted hover:border-primary/50 hover:text-foreground"
              }`}
            >
              All topics
            </button>
            {topics.map((topicOption) => (
              <button
                key={topicOption.value}
                type="button"
                onClick={() => updateTopic(topicOption.value)}
                className={`rounded-full border px-4 py-2 text-body-sm font-medium transition-all duration-200 ${
                  topic === topicOption.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-foreground-muted hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {topicOption.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-body-sm text-foreground-muted">
          {filtered.length} episode{filtered.length !== 1 ? "s" : ""}
          {topic !== "all" && ` in "${topics.find((t) => t.value === topic)?.label}"`}
          {query && ` matching "${query}"`}
        </p>
      </div>

      {/* Episode grid */}
      {filtered.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2">
          {filtered.map((episode) => (
            <EpisodeCard key={episode.slug} episode={episode} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <p className="text-body text-foreground-muted mb-2">No episodes match your criteria</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              updateTopic("all");
            }}
            className="text-body-sm font-semibold text-primary hover:text-primary-hover transition-colors duration-200"
          >
            Clear filters
          </button>
        </div>
      )}
    </div>
  );
}

function EpisodeCard({ episode }: { episode: Episode }) {
  const dateFormatter = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const publishDate = dateFormatter.format(new Date(episode.publishDate));
  const hasEmbeddableVideo = !!episode.vimeoId;

  return (
    <Link
      href={`/episodes/${episode.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-surface overflow-hidden hover:border-primary/50 hover:shadow-glow-sm transition-all duration-300"
    >
      {/* Thumbnail */}
      {episode.thumbnailUrl && (
        <div className="relative aspect-video w-full overflow-hidden bg-surface-elevated">
          <Image
            src={episode.thumbnailUrl}
            alt={episode.title}
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
          {episode.title}
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
