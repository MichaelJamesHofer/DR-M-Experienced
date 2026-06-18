import { AffiliateBrowser } from "@/components/affiliate-browser";
import { AFFILIATE_DISCLOSURE } from "@/data/affiliates";
import { getContentCatalog } from "@/data/content-catalog";

export const metadata = {
  title: "Affiliate Product Guide",
  description:
    "Browse Dr. M's affiliate product guide with product notes, uses, and related episode links.",
};

export default async function AffiliatesPage() {
  const { affiliateCategories, affiliateProducts, episodes } = await getContentCatalog();

  return (
    <div className="mx-auto min-w-0 max-w-6xl px-4 py-12 lg:px-6 lg:py-16">
      <section className="mb-12">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Affiliate guide
        </p>
        <h1 className="mb-4 text-heading-xl font-bold text-foreground sm:text-display">
          Products Dr. M references
        </h1>
        <p className="max-w-3xl text-body-lg text-foreground-muted">
          A practical catalog for products, tools, and resources Dr. M discusses across episodes,
          including why he likes them, where they may fit, and which episodes mention them.
        </p>
      </section>

      <section className="mb-10 rounded-2xl border border-border bg-surface p-6">
        <p className="mb-2 text-body-sm font-semibold text-foreground">Affiliate disclosure</p>
        <p className="text-body-sm text-foreground-muted">{AFFILIATE_DISCLOSURE}</p>
      </section>

      <AffiliateBrowser
        products={affiliateProducts}
        categories={affiliateCategories}
        episodes={episodes}
      />
    </div>
  );
}
