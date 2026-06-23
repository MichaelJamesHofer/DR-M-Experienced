"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type BlogPost, blogTopicLabel } from "@/data/blogs";
import { siteImageSrc } from "@/lib/site-images";

type BlogBrowserProps = {
  posts: BlogPost[];
  initialTopic?: string;
};

type BlogSortKey = "newest" | "oldest" | "title" | "reading-time";
type BlogViewMode = "cards" | "list";

const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function BlogBrowser({ posts, initialTopic = "all" }: BlogBrowserProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedDefault = initialTopic.toLowerCase();

  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState(normalizedDefault);
  const [sortKey, setSortKey] = useState<BlogSortKey>("newest");
  const [viewMode, setViewMode] = useState<BlogViewMode>("cards");
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
    posts.forEach((post) => {
      post.topics.forEach((label) => {
        const value = label.toLowerCase();
        if (!map.has(value)) {
          map.set(value, label);
        }
      });
    });
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label: blogTopicLabel(label) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [posts]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    posts.forEach((post) => {
      post.topics.forEach((postTopic) => {
        const value = postTopic.toLowerCase();
        counts.set(value, (counts.get(value) ?? 0) + 1);
      });
    });
    return counts;
  }, [posts]);

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

  const filteredPosts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return posts
      .filter((post) => {
        const matchesTopic =
          topic === "all" || post.topics.some((postTopic) => postTopic.toLowerCase() === topic);
        const text = [
          post.title,
          post.subtitle,
          post.excerpt,
          post.authorName,
          ...post.topics,
          ...post.sections.map((section) => section.title),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const matchesQuery = normalizedQuery === "" || text.includes(normalizedQuery);
        return matchesTopic && matchesQuery;
      })
      .sort(comparePosts(sortKey));
  }, [posts, query, sortKey, topic]);

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

  if (posts.length === 0) {
    return <EmptyBlogLibrary />;
  }

  return (
    <div className="min-w-0 space-y-8">
      <section
        ref={controlsRef}
        className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label className="mb-2 block text-body-sm font-semibold text-foreground">
              Search blog notes
            </label>
            <div className="relative min-w-0">
              <svg
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-subtle"
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
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search titles, topics, summaries, or notes..."
                className="w-full rounded-xl border border-border bg-background py-3 pl-12 pr-4 text-body text-foreground placeholder:text-foreground-subtle transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
            <label className="mb-2 block text-body-sm font-semibold text-foreground">Sort</label>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as BlogSortKey)}
              className="h-[50px] w-full min-w-0 rounded-xl border border-border bg-background px-4 text-body-sm font-medium text-foreground-muted transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-48 lg:w-auto"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="title">Title A-Z</option>
              <option value="reading-time">Shortest read</option>
            </select>
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-2 text-body-sm font-semibold text-foreground">View</p>
            <div className="grid h-[50px] min-w-0 grid-cols-2 rounded-xl border border-border bg-background p-1">
              {(["cards", "list"] as BlogViewMode[]).map((mode) => (
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

        <MobileBlogCommandBar
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
                    <p className="text-body-sm font-semibold text-foreground">Refine blog notes</p>
                    <p className="text-body-sm text-foreground-muted">
                      Keep browsing stable while narrowing by topic.
                    </p>
                  </div>
                  <p className="text-body-sm text-foreground-muted">
                    {filteredPosts.length} of {posts.length} posts
                  </p>
                </div>

                <TopicSelect
                  value={topic}
                  allCount={posts.length}
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
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-foreground-muted">
          {filteredPosts.length} post{filteredPosts.length === 1 ? "" : "s"}
          {activeTopicLabel && ` tagged ${activeTopicLabel}`}
          {query && ` matching "${query}"`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="self-start text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredPosts.length === 0 ? (
        <EmptyBlogResults onClear={resetAll} />
      ) : (
        <div className={viewMode === "cards" ? "grid gap-6 md:grid-cols-2" : "space-y-6"}>
          {filteredPosts.map((post) => (
            <BlogCard key={post.slug} post={post} variant={viewMode} />
          ))}
        </div>
      )}
    </div>
  );
}

function BlogCard({ post, variant }: { post: BlogPost; variant: BlogViewMode }) {
  const publishDate = dateFormatter.format(new Date(post.publishDate));
  const heroImageSrc = siteImageSrc(post.heroImageUrl);

  return (
    <Link
      href={`/blogs/${post.slug}`}
      className={`group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface transition-all duration-300 hover:border-primary/50 hover:shadow-glow-sm ${
        variant === "list" ? "md:flex-row" : ""
      }`}
    >
      {heroImageSrc && (
        <div
          className={`relative aspect-video w-full overflow-hidden bg-surface-elevated ${
            variant === "list" ? "md:min-h-64 md:w-72 md:shrink-0 md:aspect-auto" : ""
          }`}
        >
          <Image
            src={heroImageSrc}
            alt={post.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 via-transparent to-transparent" />
        </div>
      )}

      <div className="flex flex-1 flex-col p-6">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-caption text-foreground-subtle">
          <span>{publishDate}</span>
          {post.readingMinutes && (
            <>
              <span>•</span>
              <span>{post.readingMinutes} min read</span>
            </>
          )}
        </div>
        <h3 className="mb-2 text-heading font-semibold text-foreground transition-colors duration-200 group-hover:text-primary">
          {post.title}
        </h3>
        {post.subtitle && (
          <p className="mb-2 text-body-sm font-semibold text-foreground-muted line-clamp-2">
            {post.subtitle}
          </p>
        )}
        <p className="mb-4 flex-1 text-body-sm text-foreground-muted line-clamp-3">
          {post.excerpt}
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          {post.topics.slice(0, 3).map((topic) => (
            <span
              key={topic}
              className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
            >
              {blogTopicLabel(topic)}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-border pt-4">
          <span className="text-body-sm font-medium text-primary transition-colors duration-200 group-hover:text-primary-hover">
            Read note
          </span>
          <svg
            className="h-4 w-4 text-foreground-muted transition-all duration-200 group-hover:translate-x-1 group-hover:text-primary"
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

function AppliedTopicChip({ label, onRemove }: { label: string; onRemove: () => void }) {
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

function MobileBlogCommandBar({
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
  sortKey: BlogSortKey;
  onSortChange: (value: BlogSortKey) => void;
  viewMode: BlogViewMode;
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
        <span className="sr-only">Sort blog notes</span>
        <select
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as BlogSortKey)}
          className="h-full w-full appearance-none rounded-xl border-0 bg-surface px-2 py-3 text-center text-caption font-bold text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="title">Title</option>
          <option value="reading-time">Short</option>
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

function EmptyBlogLibrary() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-8 sm:p-10">
      <div className="mx-auto max-w-2xl text-center">
        <p className="mb-2 text-heading font-semibold text-foreground">Blog notes are ready for content.</p>
        <p className="mb-6 text-body text-foreground-muted">
          The blog section is wired for long-form notes, episode expansions, and clinic-style explainers. Published posts will appear here after they are added to the content database.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            href="/episodes"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-background px-5 py-3 text-body-sm font-semibold text-foreground-muted transition-all duration-200 hover:border-primary hover:text-primary"
          >
            Browse episodes
          </Link>
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-body-sm font-semibold text-background transition-all duration-200 hover:bg-primary-hover"
          >
            Suggest a topic
          </Link>
        </div>
      </div>
    </section>
  );
}

function EmptyBlogResults({ onClear }: { onClear: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="mb-2 text-body font-semibold text-foreground">No blog notes match.</p>
      <p className="mb-5 text-body-sm text-foreground-muted">
        Try another topic, title, or search term.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover"
      >
        Clear filters
      </button>
    </section>
  );
}

function comparePosts(sortKey: BlogSortKey) {
  return (a: BlogPost, b: BlogPost) => {
    if (sortKey === "oldest") {
      const dateA = new Date(a.publishDate).getTime();
      const dateB = new Date(b.publishDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.title.localeCompare(b.title);
    }

    if (sortKey === "title") {
      return a.title.localeCompare(b.title);
    }

    if (sortKey === "reading-time") {
      const timeA = a.readingMinutes ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.readingMinutes ?? Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      return a.title.localeCompare(b.title);
    }

    const dateA = new Date(a.publishDate).getTime();
    const dateB = new Date(b.publishDate).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return a.title.localeCompare(b.title);
  };
}
