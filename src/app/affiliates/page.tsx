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
    <div className="mx-auto min-w-0 max-w-6xl px-4 py-6 lg:px-6 lg:py-14">
      <section className="mb-6">
        <p className="mb-2 text-caption font-semibold uppercase tracking-wider text-primary">
          Affiliate guide
        </p>
        <h1 className="mb-3 text-[2.25rem] font-bold leading-tight text-foreground sm:text-display">
          Products Dr. M references
        </h1>
        <p className="max-w-3xl text-body text-foreground-muted sm:text-body-lg">
          Products Dr. M discusses, why he uses them, and the episodes where each appears.
        </p>
      </section>

      <section className="mb-6 border-y border-border py-3">
        <p className="text-body-sm leading-6 text-foreground-muted">
          <span className="font-semibold text-foreground">Affiliate disclosure: </span>
          {AFFILIATE_DISCLOSURE}
        </p>
      </section>

      <AffiliateBrowser
        products={affiliateProducts}
        categories={affiliateCategories}
        episodes={episodes}
      />
    </div>
  );
}
