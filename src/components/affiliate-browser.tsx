"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AffiliateCategory,
  AffiliateProduct,
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
  const [viewMode, setViewMode] = useState<ViewMode>("grouped");

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

  return (
    <div className="min-w-0 space-y-8">
      <section className="min-w-0 overflow-hidden rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:items-end">
          <div className="min-w-0">
            <label className="mb-2 block text-body-sm font-semibold text-foreground">
              Search affiliate guide
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
                placeholder="Search brands, products, codes, topics..."
                className="w-full rounded-xl border border-border bg-background py-3 pl-12 pr-4 text-body text-foreground placeholder:text-foreground-subtle transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-body-sm font-semibold text-foreground">Sort</label>
            <select
              value={sortKey}
              onChange={(event) => setSortKey(event.target.value as SortKey)}
              className="h-[50px] w-full min-w-0 rounded-xl border border-border bg-background px-4 text-body-sm font-medium text-foreground-muted transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:min-w-48 lg:w-auto"
            >
              <option value="recommended">Recommended order</option>
              <option value="name">Name A-Z</option>
              <option value="category">Category</option>
              <option value="newest">Newest added</option>
              <option value="episode-count">Most episode-linked</option>
            </select>
          </div>

          <div className="min-w-0">
            <p className="mb-2 text-body-sm font-semibold text-foreground">View</p>
            <div className="grid h-[50px] min-w-0 grid-cols-2 rounded-xl border border-border bg-background p-1">
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

        <div className="mt-6 space-y-4 border-t border-border pt-5">
          <FacetRow
            label="Category"
            allLabel="All categories"
            activeValue={categorySlug}
            allCount={products.length}
            options={sortedCategories.map((category) => ({
              value: category.slug,
              label: category.label,
              count: categoryCounts.get(category.slug) ?? 0,
            }))}
            onChange={setCategorySlug}
          />
          <FacetRow
            label="Related topic"
            allLabel="All topics"
            activeValue={topicSlug}
            allCount={products.length}
            options={topicOptions}
            onChange={setTopicSlug}
          />
        </div>
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
            onClick={() => {
              setQuery("");
              setCategorySlug("all");
              setTopicSlug("all");
            }}
            className="self-start text-body-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover sm:self-auto"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredProducts.length === 0 ? (
        <EmptyAffiliateResults onClear={() => {
          setQuery("");
          setCategorySlug("all");
          setTopicSlug("all");
        }} />
      ) : viewMode === "grouped" ? (
        <div className="space-y-14">
          {groupedProducts.map(({ category, products: groupProducts }) => (
            <section key={category.slug}>
              <div className="mb-6">
                <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
                  {groupProducts.length} resource{groupProducts.length === 1 ? "" : "s"}
                </p>
                <h2 className="text-heading-lg font-bold text-foreground sm:text-heading-xl">
                  {category.label}
                </h2>
                <p className="mt-2 max-w-3xl text-body-sm text-foreground-muted">
                  {category.description}
                </p>
              </div>
              <div className="space-y-6">
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
        <div className="space-y-6">
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

function FacetRow({
  label,
  allLabel,
  activeValue,
  allCount,
  options,
  onChange,
}: {
  label: string;
  allLabel: string;
  activeValue: string;
  allCount: number;
  options: Array<{ value: string; label: string; count: number }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-body-sm font-semibold text-foreground">{label}</p>
      <div className="flex flex-wrap gap-2">
        <FacetButton
          label={allLabel}
          count={allCount}
          active={activeValue === "all"}
          onClick={() => onChange("all")}
        />
        {options.map((option) => (
          <FacetButton
            key={option.value}
            label={option.label}
            count={option.count}
            active={activeValue === option.value}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
    </div>
  );
}

function FacetButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex max-w-full items-center gap-2 rounded-full border px-4 py-2 text-body-sm font-medium transition-all duration-200 ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-background text-foreground-muted hover:border-primary/50 hover:text-foreground"
      }`}
    >
      <span className="min-w-0 truncate">{label}</span>
      <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-caption text-foreground-subtle">
        {count}
      </span>
    </button>
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

  return (
    <article
      id={product.slug}
      className="scroll-mt-28 flex flex-col overflow-hidden rounded-2xl border border-border bg-surface"
    >
      {product.imageUrl && (
        <div className="relative aspect-video bg-surface-elevated">
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 50vw, 100vw"
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <div className="mb-6 border-b border-border pb-5">
          <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
            {product.category}
          </p>
          <h3 className="text-heading-lg font-bold text-foreground">{companyName}</h3>
          {product.brand && (
            <p className="mt-2 text-heading-sm font-semibold text-foreground-muted">
              {product.name}
            </p>
          )}
          <p className="mt-3 text-body-sm text-foreground-muted">{product.summary}</p>
        </div>

        <div className="space-y-5">
          <InfoBlock title="Dr. M's take" body={product.drmThoughts} />
          <BulletBlock title="Why he likes it" items={product.reasonsToLike} />
          <BulletBlock title="Could be used for" items={product.usedFor} />
          <FeaturedProductsBlock items={product.featuredProducts ?? []} />
          {product.cautionNote && <CautionBlock body={product.cautionNote} />}
        </div>

        {(product.tags?.length ?? 0) > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {product.tags!.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-surface-elevated px-3 py-1 text-caption text-foreground-subtle"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {relatedEpisodes.length > 0 && (
          <div className="mt-6 border-t border-border pt-5">
            <p className="mb-3 text-body-sm font-semibold text-foreground">Referenced in</p>
            <div className="space-y-2">
              {relatedEpisodes.map((episode) => (
                <Link
                  key={episode.slug}
                  href={`/episodes/${episode.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-body-sm text-foreground-muted transition-all duration-200 hover:border-primary hover:text-primary"
                >
                  <span className="line-clamp-2">{episodeDisplayTitle(episode)}</span>
                  <svg
                    className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {(product.couponCode || product.discountNote || product.purchaseNote) && (
            <div className="space-y-1 text-body-sm text-foreground-muted">
              {product.couponCode && (
                <p>
                  Code: <span className="font-semibold text-foreground">{product.couponCode}</span>
                </p>
              )}
              {product.discountNote && <p>{product.discountNote}</p>}
              {product.purchaseNote && <p>{product.purchaseNote}</p>}
            </div>
          )}
          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-background transition-all duration-200 hover:bg-primary-hover"
            >
              View product
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                />
              </svg>
            </a>
          )}
        </div>
      </div>
    </article>
  );
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

function FeaturedProductsBlock({ items }: { items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="mb-2 text-body-sm font-semibold text-foreground">Products Dr. M mentioned</p>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-caption font-medium text-foreground-muted"
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function CautionBlock({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-warning/30 bg-warning/5 p-4">
      <p className="mb-2 text-body-sm font-semibold text-foreground">Clinical boundary</p>
      <p className="text-body-sm text-foreground-muted">{body}</p>
    </div>
  );
}

function EmptyAffiliateResults({ onClear }: { onClear: () => void }) {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
      <p className="mb-2 text-body font-semibold text-foreground">No affiliate resources match.</p>
      <p className="mb-5 text-body-sm text-foreground-muted">
        Try another category, topic, brand, product, or episode search term.
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
