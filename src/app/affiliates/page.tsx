import Image from "next/image";
import Link from "next/link";
import {
  AFFILIATE_DISCLOSURE,
  AFFILIATE_PRODUCTS,
  AffiliateProduct,
  affiliateDisplayName,
} from "@/data/affiliates";
import { EPISODES, episodeDisplayTitle } from "@/data/episodes";

export const metadata = {
  title: "Affiliate Product Guide",
  description:
    "Browse Dr. M's affiliate product guide with product notes, uses, and related episode links.",
};

const productsByCategory = AFFILIATE_PRODUCTS.reduce<Record<string, AffiliateProduct[]>>(
  (groups, product) => {
    groups[product.category] = groups[product.category] ?? [];
    groups[product.category].push(product);
    return groups;
  },
  {}
);

const categories = Object.keys(productsByCategory).sort((a, b) => a.localeCompare(b));

function getRelatedEpisodes(product: AffiliateProduct) {
  const slugs = new Set(product.episodeSlugs ?? []);
  return EPISODES.filter((episode) => slugs.has(episode.slug));
}

export default function AffiliatesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <section className="mb-12">
        <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
          Affiliate guide
        </p>
        <h1 className="text-display font-bold text-foreground mb-4">
          Products Dr. M references
        </h1>
        <p className="text-body-lg text-foreground-muted max-w-3xl">
          A practical catalog for products, tools, and resources Dr. M discusses across episodes,
          including why he likes them, where they may fit, and which episodes mention them.
        </p>
      </section>

      <section className="mb-12 rounded-2xl border border-border bg-surface p-6">
        <p className="text-body-sm font-semibold text-foreground mb-2">Affiliate disclosure</p>
        <p className="text-body-sm text-foreground-muted">{AFFILIATE_DISCLOSURE}</p>
      </section>

      {AFFILIATE_PRODUCTS.length === 0 ? (
        <EmptyCatalog />
      ) : (
        <div className="space-y-14">
          {categories.map((category) => (
            <section key={category}>
              <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
                    {category}
                  </p>
                  <h2 className="text-heading-lg font-bold text-foreground">
                    {productsByCategory[category].length} product
                    {productsByCategory[category].length === 1 ? "" : "s"}
                  </h2>
                </div>
              </div>
              <div className="space-y-6">
                {productsByCategory[category].map((product) => (
                  <ProductCard key={product.slug} product={product} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyCatalog() {
  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface p-8">
      <div className="max-w-3xl">
        <p className="text-heading font-semibold text-foreground mb-3">
          Product listings are being prepared.
        </p>
        <p className="text-body text-foreground-muted mb-6">
          As affiliate approvals are finalized, each listing will include Dr. M&apos;s notes,
          practical use cases, product links, topic tags, and quick links to the episodes where the
          product is discussed.
        </p>
        <Link
          href="/episodes"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-body-sm font-semibold text-background hover:bg-primary-hover transition-all duration-200"
        >
          Browse episodes
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: AffiliateProduct }) {
  const relatedEpisodes = getRelatedEpisodes(product);
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
          <p className="text-caption font-semibold uppercase tracking-wider text-primary mb-2">
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
            <p className="text-body-sm font-semibold text-foreground mb-3">Referenced in</p>
            <div className="space-y-2">
              {relatedEpisodes.map((episode) => (
                <Link
                  key={episode.slug}
                  href={`/episodes/${episode.slug}`}
                  className="group flex items-center justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-body-sm text-foreground-muted hover:border-primary hover:text-primary transition-all duration-200"
                >
                  <span className="line-clamp-2">{episodeDisplayTitle(episode)}</span>
                  <svg
                    className="h-4 w-4 shrink-0 group-hover:translate-x-1 transition-transform duration-200"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {(product.couponCode || product.discountNote) && (
            <div className="space-y-1 text-body-sm text-foreground-muted">
              {product.couponCode && (
                <p>
                  Code: <span className="font-semibold text-foreground">{product.couponCode}</span>
                </p>
              )}
              {product.discountNote && <p>{product.discountNote}</p>}
            </div>
          )}
          {productUrl && (
            <a
              href={productUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-body-sm font-semibold text-background hover:bg-primary-hover transition-all duration-200"
            >
              View product
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
      <p className="text-body-sm font-semibold text-foreground mb-2">{title}</p>
      <p className="text-body-sm text-foreground-muted">{body}</p>
    </div>
  );
}

function BulletBlock({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <p className="text-body-sm font-semibold text-foreground mb-2">{title}</p>
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
