"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ArrowRight, ChevronDown, ExternalLink, Search, SlidersHorizontal } from "lucide-react";
import {
  AffiliateCategory,
  AffiliateProduct,
  affiliateBrandProfile,
  affiliateDisplayName,
  productMatchesEpisode,
} from "@/data/affiliates";
import { Episode, episodeDisplayTitle } from "@/data/episodes";

type AffiliateBrowserProps = {
  products: AffiliateProduct[];
  categories: AffiliateCategory[];
  episodes: Episode[];
};

type SortKey = "recommended" | "name" | "category" | "newest" | "episode-count";
type ViewMode = "grouped" | "all";

export function AffiliateBrowser({ products, categories, episodes }: AffiliateBrowserProps) {
  const [query, setQuery] = useState("");
  const [categorySlug, setCategorySlug] = useState("all");
  const [topicSlug, setTopicSlug] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("recommended");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.slug, category])),
    [categories]
  );

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.displayOrder - b.displayOrder),
    [categories]
  );

  const productEpisodeMap = useMemo(() => {
    return new Map(
      products.map((product) => [
        product.slug,
        episodes.filter((episode) => productMatchesEpisode(product, episode)),
      ])
    );
  }, [episodes, products]);

  const topicOptions = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      (product.autoLinkTopicSlugs ?? []).forEach((topic) => {
        counts.set(topic, (counts.get(topic) ?? 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([value, count]) => ({ value, label: readableLabel(value), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    products.forEach((product) => {
      counts.set(product.categorySlug, (counts.get(product.categorySlug) ?? 0) + 1);
    });
    return counts;
  }, [products]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return products
      .filter((product) => {
        const relatedEpisodes = productEpisodeMap.get(product.slug) ?? [];
        const searchableText = [
          affiliateDisplayName(product),
          product.name,
          product.category,
          product.summary,
          product.drmThoughts,
          product.purchaseNote,
          product.cautionNote,
          product.couponCode,
          product.discountNote,
          ...(product.tags ?? []),
          ...(product.featuredProducts ?? []),
          ...relatedEpisodes.map(episodeDisplayTitle),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        const matchesQuery = normalizedQuery === "" || searchableText.includes(normalizedQuery);
        const matchesCategory = categorySlug === "all" || product.categorySlug === categorySlug;
        const matchesTopic =
          topicSlug === "all" ||
          product.autoLinkTopicSlugs?.includes(topicSlug);

        return matchesQuery && matchesCategory && matchesTopic;
      })
      .sort((a, b) => compareProducts(a, b, sortKey, categoryMap, productEpisodeMap));
  }, [categoryMap, categorySlug, productEpisodeMap, products, query, sortKey, topicSlug]);

  const groupedProducts = useMemo(() => {
    return sortedCategories
      .map((category) => ({
        category,
        products: filteredProducts.filter((product) => product.categorySlug === category.slug),
      }))
      .filter((group) => group.products.length > 0);
  }, [filteredProducts, sortedCategories]);

  const hasActiveFilters = query !== "" || categorySlug !== "all" || topicSlug !== "all";
  const activeFacetCount =
    (categorySlug === "all" ? 0 : 1) + (topicSlug === "all" ? 0 : 1);

  const resetAll = () => {
    setQuery("");
    setCategorySlug("all");
    setTopicSlug("all");
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

  const activeFilterChips = [
    ...(categorySlug !== "all"
      ? [
          {
            label: categoryMap.get(categorySlug)?.label ?? readableLabel(categorySlug),
            onRemove: () => setCategorySlug("all"),
          },
        ]
      : []),
    ...(topicSlug !== "all"
      ? [
          {
            label: readableLabel(topicSlug),
            onRemove: () => setTopicSlug("all"),
          },
        ]
      : []),
  ];

  return (
    <div className="min-w-0 space-y-6">
      <section
        ref={controlsRef}
        className="-mx-4 min-w-0 overflow-hidden border-y border-border bg-surface p-4 sm:mx-0 sm:rounded-lg sm:border sm:p-6"
      >
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label className="sr-only mb-2 text-body-sm font-semibold text-foreground sm:not-sr-only sm:block">
              Search affiliate guide
            </label>
            <div className="relative min-w-0">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-foreground-subtle" aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search products..."
                className="min-h-12 w-full rounded-lg border border-border bg-background py-3 pl-12 pr-4 text-body text-foreground placeholder:text-foreground-subtle transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-2 text-body-sm font-semibold text-foreground">Filters</p>
            <button
              type="button"
              onClick={toggleFilterPanel}
              aria-expanded={filterPanelOpen}
                className={`flex h-[50px] min-w-36 items-center justify-center gap-2 rounded-lg border px-4 text-body-sm font-semibold transition-colors duration-200 ${
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
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[50px] w-full min-w-0 rounded-lg border border-border bg-background px-4 text-body-sm font-medium text-foreground-muted transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-48 lg:w-auto"
            >
              <option value="recommended">Recommended order</option>
              <option value="name">Name A-Z</option>
              <option value="category">Category</option>
              <option value="newest">Newest added</option>
              <option value="episode-count">Most episode-linked</option>
            </select>
          </div>

          <div className="hidden min-w-0 sm:block">
            <p className="mb-2 text-body-sm font-semibold text-foreground">View</p>
            <div className="grid h-[54px] min-w-0 grid-cols-2 rounded-lg border border-border bg-background p-1">
              {(["grouped", "all"] as ViewMode[]).map((mode) => (
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
                  {mode === "grouped" ? "Grouped" : "All"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <MobileCommandBar
          activeFacetCount={activeFacetCount}
          filterPanelOpen={filterPanelOpen}
          onToggleFilters={toggleFilterPanel}
          sortKey={sortKey}
          onSortChange={setSortKey}
          viewMode={viewMode}
          onToggleView={() => setViewMode(viewMode === "grouped" ? "all" : "grouped")}
        />

        {(activeFilterChips.length > 0 || filterPanelOpen) && (
          <div className="mt-5 border-t border-border pt-5">
            {activeFilterChips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="text-caption font-semibold uppercase tracking-wider text-foreground-subtle">
                  Applied
                </span>
                {activeFilterChips.map((chip) => (
                  <AppliedFilterChip
                    key={chip.label}
                    label={chip.label}
                    onRemove={chip.onRemove}
                  />
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setCategorySlug("all");
                    setTopicSlug("all");
                  }}
                  className="inline-flex min-h-11 items-center rounded-lg border border-border bg-background px-3 py-2 text-caption font-semibold text-foreground-subtle transition-colors duration-200 hover:border-primary/50 hover:text-foreground"
                >
                  Clear facets
                </button>
              </div>
            )}

            {filterPanelOpen && (
              <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-body-sm font-semibold text-foreground">Refine catalog</p>
                    <p className="text-body-sm text-foreground-muted">
                      Keep the result list stable while narrowing by category or episode topic.
                    </p>
                  </div>
                  <p className="text-body-sm text-foreground-muted">
                    {filteredProducts.length} of {products.length} resources
                  </p>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <FilterSelect
                    label="Category"
                    value={categorySlug}
                    allLabel="All categories"
                    allCount={products.length}
                    options={sortedCategories.map((category) => ({
                      value: category.slug,
                      label: category.label,
                      count: categoryCounts.get(category.slug) ?? 0,
                    }))}
                    onChange={setCategorySlug}
                  />
                  <FilterSelect
                    label="Related topic"
                    value={topicSlug}
                    allLabel="All topics"
                    allCount={products.length}
                    options={topicOptions}
                    onChange={setTopicSlug}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body-sm text-foreground-muted">
          {filteredProducts.length} resource{filteredProducts.length === 1 ? "" : "s"}
          {categorySlug !== "all" && ` in ${categoryMap.get(categorySlug)?.label ?? categorySlug}`}
          {topicSlug !== "all" && ` tagged ${readableLabel(topicSlug)}`}
          {query && ` matching "${query}"`}
        </p>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetAll}
            className="inline-flex min-h-11 items-center self-start text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyAffiliateResults onClear={() => {
          resetAll();
        }} />
      ) : viewMode === "grouped" ? (
        <div className="space-y-8 sm:space-y-10">
          {groupedProducts.map(({ category, products: groupProducts }) => (
            <section key={category.slug}>
              <div className="mb-4 hidden sm:block">
                <p className="mb-1 text-caption font-semibold uppercase tracking-wider text-primary">
                  {groupProducts.length} resource{groupProducts.length === 1 ? "" : "s"}
                </p>
                <h2 className="text-heading-lg font-bold text-foreground">
                  {category.label}
                </h2>
                <p className="mt-1 max-w-3xl text-body-sm text-foreground-muted">
                  {category.description}
                </p>
              </div>
              <div className="grid items-start gap-4 xl:grid-cols-2">
                {groupProducts.map((product) => (
                  <ProductCard
                    key={product.slug}
                    product={product}
                    relatedEpisodes={productEpisodeMap.get(product.slug) ?? []}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid items-start gap-4 xl:grid-cols-2">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              relatedEpisodes={productEpisodeMap.get(product.slug) ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  allLabel,
  value,
  allCount,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  value: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-body-sm font-semibold text-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-[50px] w-full rounded-lg border border-border bg-surface px-4 text-body-sm font-medium text-foreground-muted transition-colors duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <option value="all">
          {allLabel} ({allCount})
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label} ({option.count})
          </option>
        ))}
      </select>
    </div>
  );
}

function AppliedFilterChip({
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
      className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-lg border border-primary bg-primary/10 px-3 py-2 text-caption font-semibold text-primary transition-colors duration-200 hover:bg-primary/15"
    >
      <span className="min-w-0 truncate">{label}</span>
      <span aria-hidden="true">x</span>
    </button>
  );
}

function MobileCommandBar({
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
  sortKey: SortKey;
  onSortChange: (value: SortKey) => void;
  viewMode: ViewMode;
  onToggleView: () => void;
}) {
  return (
    <div className="mt-4 grid grid-cols-[1fr_1.15fr_0.85fr] gap-1 border-y border-border py-2 sm:hidden">
      <button
        type="button"
        onClick={onToggleFilters}
        aria-expanded={filterPanelOpen}
        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-caption font-bold transition-colors duration-200 ${
          filterPanelOpen || activeFacetCount > 0
            ? "bg-primary text-background"
            : "bg-background text-foreground-muted"
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
        Filters {activeFacetCount}
      </button>
      <label className="relative">
        <span className="sr-only">Sort affiliate resources</span>
        <select
          value={sortKey}
          onChange={(event) => onSortChange(event.target.value as SortKey)}
          className="h-11 w-full appearance-none rounded-lg border-0 bg-background px-2 py-2 text-center text-caption font-bold text-foreground-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="recommended">Recommended</option>
          <option value="name">Name A-Z</option>
          <option value="category">Category</option>
          <option value="newest">Newest</option>
          <option value="episode-count">Most linked</option>
        </select>
      </label>
      <button
        type="button"
        onClick={onToggleView}
        aria-label={viewMode === "grouped" ? "Show all resources without category groups" : "Group resources by category"}
        aria-pressed={viewMode === "all"}
        className="min-h-11 rounded-lg bg-background px-2 py-2 text-caption font-bold text-foreground-muted transition-colors duration-200 hover:text-foreground"
      >
        {viewMode === "grouped" ? "All view" : "Group"}
      </button>
    </div>
  );
}

function ProductCard({
  product,
  relatedEpisodes,
}: {
  product: AffiliateProduct;
  relatedEpisodes: Episode[];
}) {
  const productUrl = product.affiliateUrl ?? product.directUrl;
  const companyName = affiliateDisplayName(product);
  const brandProfile = affiliateBrandProfile(product);
  const cardRef = useRef<HTMLElement>(null);
  const accent = brandProfile?.accent ?? "var(--color-primary)";
  const logoSrc = brandProfile?.logoSrc ?? product.imageUrl;
  const logoAlt = brandProfile?.logoAlt ?? product.name;
  const cardStyle = {
    "--affiliate-shift-x": "0px",
    "--affiliate-shift-y": "0px",
    borderColor: `color-mix(in srgb, ${accent} 34%, var(--color-border))`,
    backgroundColor: `color-mix(in srgb, ${accent} 4%, var(--color-surface))`,
  } as CSSProperties;

  return (
    <article
      ref={cardRef}
      id={product.slug}
      onPointerMove={(event) => updateBrandDepth(event, cardRef.current)}
      onPointerLeave={() => resetBrandDepth(cardRef.current)}
      style={cardStyle}
      className="relative scroll-mt-28 overflow-hidden rounded-lg border bg-surface"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />
      <div className="flex flex-1 flex-col p-4 pl-5 sm:p-5 sm:pl-6">
        <div className={logoSrc ? "grid gap-4 sm:grid-cols-[8.5rem_minmax(0,1fr)]" : ""}>
          {logoSrc && (
            <div
              className="relative mx-auto flex aspect-[16/7] w-full max-w-[13rem] items-center justify-center overflow-hidden rounded-lg border p-3 transition-transform duration-200 ease-out motion-reduce:transform-none motion-reduce:transition-none sm:mx-0 sm:aspect-[4/3] sm:max-w-none"
              style={{
                backgroundColor: brandProfile?.logoSurface ?? "#ffffff",
                borderColor: `color-mix(in srgb, ${accent} 48%, transparent)`,
                boxShadow: `0 12px 28px color-mix(in srgb, ${accent} 14%, transparent)`,
                transform:
                  "translate3d(var(--affiliate-shift-x), var(--affiliate-shift-y), 0)",
              }}
            >
              <Image
                src={logoSrc}
                alt={logoAlt}
                fill
                className="object-contain p-4"
                sizes="(min-width: 640px) 136px, 208px"
                unoptimized={logoSrc.endsWith(".svg")}
              />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
              <div className="min-w-0">
                <p className="mb-1 text-caption font-semibold uppercase text-primary">
                  {product.category}
                </p>
                <h3 className="text-heading font-bold text-foreground">{companyName}</h3>
                {product.brand && (
                  <p className="mt-1 text-body-sm font-semibold text-foreground-muted">
                    {product.name}
                  </p>
                )}
              </div>
              {productUrl && (
                <a
                  href={productUrl}
                  target="_blank"
                  rel="sponsored noopener noreferrer"
                  aria-label={`Visit ${companyName}`}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-body-sm font-semibold text-background transition-colors duration-200 hover:bg-primary-hover"
                >
                  Visit partner
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              )}
            </div>

            <p className="mt-3 text-left text-body-sm leading-6 text-foreground-muted">
              {product.summary}
            </p>

            {(product.couponCode || product.discountNote || product.purchaseNote) && (
              <div className="mt-3 border-y border-border py-2.5 text-left text-body-sm text-foreground-muted">
                {product.couponCode && (
                  <p>
                    Code: <span className="font-bold text-foreground">{product.couponCode}</span>
                  </p>
                )}
                {product.discountNote && <p>{product.discountNote}</p>}
                {product.purchaseNote && <p>{product.purchaseNote}</p>}
              </div>
            )}

            {(product.featuredProducts?.length ?? 0) > 0 && (
              <div className="mt-3 min-w-0 text-left">
                <p className="mb-2 text-caption font-semibold uppercase text-foreground-subtle">
                  Products Dr. M mentioned
                </p>
                <div
                  className="flex gap-2 overflow-x-auto pb-2 [scrollbar-color:var(--color-border-strong)_transparent] [scrollbar-width:thin] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 focus-visible:ring-offset-2 focus-visible:ring-offset-surface [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border-strong [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar]:h-1.5"
                  role="region"
                  aria-label={`${companyName} recommended products`}
                  tabIndex={0}
                >
                  {product.featuredProducts!.map((item) => (
                    <span
                      key={item}
                      className="shrink-0 rounded-lg border border-border bg-background px-2.5 py-1 text-caption font-medium text-foreground-muted"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {relatedEpisodes.length > 0 && (
          <div className="mt-4 border-t border-border pt-3">
            <p className="mb-1 text-caption font-semibold uppercase text-foreground-subtle">
              Referenced in
            </p>
            <div className="divide-y divide-border">
              {relatedEpisodes.map((episode) => (
                <Link
                  key={episode.slug}
                  href={`/episodes/${episode.slug}`}
                  className="group flex min-h-11 items-center justify-between gap-4 py-2 text-body-sm text-foreground-muted transition-colors duration-200 hover:text-primary"
                >
                  <span className="line-clamp-1">{episodeDisplayTitle(episode)}</span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </div>
        )}

        <details className="group mt-2 border-t border-border">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-body-sm font-semibold text-foreground transition-colors hover:text-primary [&::-webkit-details-marker]:hidden">
            Why Dr. M references this
            <ChevronDown
              className="h-4 w-4 shrink-0 text-foreground-subtle transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="space-y-5 border-t border-border py-5">
            <InfoBlock title="Dr. M's take" body={product.drmThoughts} />
            <BulletBlock title="Why he likes it" items={product.reasonsToLike} />
            <BulletBlock title="Could be used for" items={product.usedFor} />
            {product.cautionNote && <CautionBlock body={product.cautionNote} />}
            {(product.tags?.length ?? 0) > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {product.tags!.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg border border-border px-2.5 py-1 text-caption text-foreground-subtle"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </details>
      </div>
    </article>
  );
}

function updateBrandDepth(event: ReactPointerEvent<HTMLElement>, card: HTMLElement | null) {
  if (
    !card ||
    event.pointerType !== "mouse" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }

  const bounds = card.getBoundingClientRect();
  const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 6;
  const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 6;
  card.style.setProperty("--affiliate-shift-x", `${x.toFixed(2)}px`);
  card.style.setProperty("--affiliate-shift-y", `${y.toFixed(2)}px`);
}

function resetBrandDepth(card: HTMLElement | null) {
  card?.style.setProperty("--affiliate-shift-x", "0px");
  card?.style.setProperty("--affiliate-shift-y", "0px");
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="mb-2 text-body-sm font-semibold text-foreground">{title}</p>
      <p className="text-body-sm text-foreground-muted">{body}</p>
    </div>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-body-sm font-semibold text-foreground">{title}</p>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item} className="flex gap-3 text-body-sm text-foreground-muted">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CautionBlock({ body }: { body: string }) {
  return (
    <div className="border-l-2 border-warning/60 pl-4">
      <p className="mb-2 text-body-sm font-semibold text-foreground">Clinical boundary</p>
      <p className="text-body-sm text-foreground-muted">{body}</p>
    </div>
  );
}

function EmptyAffiliateResults({ onClear }: { onClear: () => void }) {
  return (
    <section className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <p className="mb-2 text-body font-semibold text-foreground">No affiliate resources match.</p>
      <p className="mb-5 text-body-sm text-foreground-muted">
        Try another category, topic, brand, product, or episode search term.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="inline-flex min-h-11 items-center text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover"
      >
        Clear filters
      </button>
    </section>
  );
}

function compareProducts(
  a: AffiliateProduct,
  b: AffiliateProduct,
  sortKey: SortKey,
  categoryMap: Map<string, AffiliateCategory>,
  productEpisodeMap: Map<string, Episode[]>
) {
  if (sortKey === "name") {
    return affiliateDisplayName(a).localeCompare(affiliateDisplayName(b));
  }

  if (sortKey === "category") {
    const categoryA = categoryMap.get(a.categorySlug)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    const categoryB = categoryMap.get(b.categorySlug)?.displayOrder ?? Number.MAX_SAFE_INTEGER;
    if (categoryA !== categoryB) return categoryA - categoryB;
    return a.sortOrder - b.sortOrder;
  }

  if (sortKey === "newest") {
    const dateA = new Date(a.dateAdded).getTime();
    const dateB = new Date(b.dateAdded).getTime();
    if (dateA !== dateB) return dateB - dateA;
    return a.sortOrder - b.sortOrder;
  }

  if (sortKey === "episode-count") {
    const countA = productEpisodeMap.get(a.slug)?.length ?? 0;
    const countB = productEpisodeMap.get(b.slug)?.length ?? 0;
    if (countA !== countB) return countB - countA;
    return a.sortOrder - b.sortOrder;
  }

  return a.sortOrder - b.sortOrder;
}

function readableLabel(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
