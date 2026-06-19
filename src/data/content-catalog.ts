import { cache } from "react";
import {
  AFFILIATE_CATEGORIES,
  AFFILIATE_PRODUCTS,
  type AffiliateCategory,
  type AffiliateProduct,
} from "./affiliates";
import { EPISODES, type Episode, type EpisodeReference } from "./episodes";

export type ContentCatalog = {
  episodes: Episode[];
  affiliateCategories: AffiliateCategory[];
  affiliateProducts: AffiliateProduct[];
  source: "supabase" | "fallback";
};

type EpisodeRow = {
  slug: string;
  episode_number: number;
  title: string;
  publish_date: string;
  duration_minutes: number | null;
  summary: string;
  audio_url: string | null;
  vimeo_id: string | null;
  spotify_id: string | null;
  thumbnail_url: string | null;
  transcript_url: string | null;
};

type EpisodeTopicRow = {
  episode_slug: string;
  topic_slug: string;
};

type EpisodeReferenceRow = {
  episode_slug: string;
  label: string;
  url: string;
  coming_soon: boolean;
  display_order: number;
};

type AffiliateCategoryRow = {
  slug: string;
  label: string;
  description: string;
  display_order: number;
};

type AffiliateProductRow = {
  slug: string;
  category_slug: string;
  brand: string | null;
  name: string;
  summary: string;
  drm_thoughts: string;
  purchase_note: string | null;
  caution_note: string | null;
  affiliate_url: string | null;
  direct_url: string | null;
  image_url: string | null;
  coupon_code: string | null;
  discount_note: string | null;
  sort_order: number;
  date_added: string;
  last_reviewed: string;
  source_note: string;
};

type OrderedBodyRow = {
  product_slug: string;
  display_order: number;
  body: string;
};

type OrderedLabelRow = {
  product_slug: string;
  display_order: number;
  label: string;
};

type ProductEpisodeLinkRow = {
  product_slug: string;
  episode_slug: string;
};

type ProductTopicRow = {
  product_slug: string;
  topic_slug: string;
};

type ProductTagRow = {
  product_slug: string;
  tag_slug: string;
};

const fallbackCatalog: ContentCatalog = {
  episodes: EPISODES,
  affiliateCategories: AFFILIATE_CATEGORIES,
  affiliateProducts: AFFILIATE_PRODUCTS,
  source: "fallback",
};

export const getContentCatalog = cache(async (): Promise<ContentCatalog> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return fallbackCatalog;
  }

  try {
    const [
      episodeRows,
      episodeTopicRows,
      episodeReferenceRows,
      categoryRows,
      productRows,
      reasonRows,
      useCaseRows,
      featuredRows,
      episodeLinkRows,
      autoTopicRows,
      tagRows,
    ] = await Promise.all([
      fetchRows<EpisodeRow>(supabaseUrl, supabaseAnonKey, "episodes", {
        select: "*",
        status: "eq.published",
      }),
      fetchRows<EpisodeTopicRow>(supabaseUrl, supabaseAnonKey, "episode_topics", {
        select: "*",
      }),
      fetchRows<EpisodeReferenceRow>(supabaseUrl, supabaseAnonKey, "episode_references", {
        select: "*",
      }),
      fetchRows<AffiliateCategoryRow>(supabaseUrl, supabaseAnonKey, "affiliate_categories", {
        select: "*",
      }),
      fetchRows<AffiliateProductRow>(supabaseUrl, supabaseAnonKey, "affiliate_products", {
        select: "*",
        status: "eq.published",
      }),
      fetchRows<OrderedBodyRow>(supabaseUrl, supabaseAnonKey, "affiliate_product_reasons", {
        select: "*",
      }),
      fetchRows<OrderedBodyRow>(supabaseUrl, supabaseAnonKey, "affiliate_product_use_cases", {
        select: "*",
      }),
      fetchRows<OrderedLabelRow>(supabaseUrl, supabaseAnonKey, "affiliate_product_featured_items", {
        select: "*",
      }),
      fetchRows<ProductEpisodeLinkRow>(
        supabaseUrl,
        supabaseAnonKey,
        "affiliate_product_episode_links",
        { select: "product_slug,episode_slug" }
      ),
      fetchRows<ProductTopicRow>(supabaseUrl, supabaseAnonKey, "affiliate_product_auto_topics", {
        select: "*",
      }),
      fetchRows<ProductTagRow>(supabaseUrl, supabaseAnonKey, "affiliate_product_tags", {
        select: "*",
      }),
    ]);

    return {
      episodes: mapEpisodes(episodeRows, episodeTopicRows, episodeReferenceRows),
      affiliateCategories: mapCategories(categoryRows),
      affiliateProducts: mapAffiliateProducts(
        productRows,
        categoryRows,
        reasonRows,
        useCaseRows,
        featuredRows,
        episodeLinkRows,
        autoTopicRows,
        tagRows
      ),
      source: "supabase",
    };
  } catch (error) {
    console.warn(
      `Supabase content catalog unavailable; using checked-in fallback. ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return fallbackCatalog;
  }
});

async function fetchRows<T>(
  supabaseUrl: string,
  supabaseAnonKey: string,
  table: string,
  params: Record<string, string>
): Promise<T[]> {
  const url = new URL(`/rest/v1/${table}`, supabaseUrl);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    cache: "force-cache",
  });

  if (!response.ok) {
    throw new Error(`${table} returned ${response.status}`);
  }

  return response.json() as Promise<T[]>;
}

function mapEpisodes(
  rows: EpisodeRow[],
  topicRows: EpisodeTopicRow[],
  referenceRows: EpisodeReferenceRow[]
) {
  const fallbackBySlug = new Map(EPISODES.map((episode) => [episode.slug, episode]));
  const topicsByEpisode = groupValues(topicRows, "episode_slug", "topic_slug");
  const referencesByEpisode = groupRows(referenceRows, "episode_slug");

  return rows
    .map((row): Episode => {
      const fallback = fallbackBySlug.get(row.slug);
      const references = (referencesByEpisode.get(row.slug) ?? [])
        .sort((a, b) => a.display_order - b.display_order)
        .map(
          (reference): EpisodeReference => ({
            label: reference.label,
            url: reference.url,
            comingSoon: reference.coming_soon,
          })
        );

      return {
        slug: row.slug,
        number: row.episode_number,
        title: row.title,
        publishDate: row.publish_date,
        durationMinutes: row.duration_minutes ?? undefined,
        summary: row.summary,
        topics: topicsByEpisode.get(row.slug) ?? fallback?.topics ?? ["functional-medicine"],
        audioUrl: row.audio_url ?? fallback?.audioUrl,
        vimeoId: row.vimeo_id ?? undefined,
        spotifyId: row.spotify_id ?? undefined,
        thumbnailUrl: row.thumbnail_url ?? undefined,
        transcriptUrl: row.transcript_url ?? fallback?.transcriptUrl,
        references: references.length > 0 ? references : fallback?.references ?? [],
        keyTakeaways: fallback?.keyTakeaways ?? [],
        checklist: fallback?.checklist ?? [],
        sections: fallback?.sections ?? [],
      };
    })
    .sort((a, b) => {
      const dateA = new Date(a.publishDate).getTime();
      const dateB = new Date(b.publishDate).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.number - b.number;
    });
}

function mapCategories(rows: AffiliateCategoryRow[]) {
  return rows
    .map(
      (row): AffiliateCategory => ({
        slug: row.slug,
        label: row.label,
        description: row.description,
        displayOrder: row.display_order,
      })
    )
    .sort((a, b) => a.displayOrder - b.displayOrder);
}

function mapAffiliateProducts(
  productRows: AffiliateProductRow[],
  categoryRows: AffiliateCategoryRow[],
  reasonRows: OrderedBodyRow[],
  useCaseRows: OrderedBodyRow[],
  featuredRows: OrderedLabelRow[],
  episodeLinkRows: ProductEpisodeLinkRow[],
  autoTopicRows: ProductTopicRow[],
  tagRows: ProductTagRow[]
) {
  const fallbackBySlug = new Map(AFFILIATE_PRODUCTS.map((product) => [product.slug, product]));
  const categoryLabelBySlug = new Map(categoryRows.map((category) => [category.slug, category.label]));
  const reasonsByProduct = groupOrderedBodies(reasonRows);
  const useCasesByProduct = groupOrderedBodies(useCaseRows);
  const featuredByProduct = groupOrderedLabels(featuredRows);
  const episodesByProduct = groupValues(episodeLinkRows, "product_slug", "episode_slug");
  const autoTopicsByProduct = groupValues(autoTopicRows, "product_slug", "topic_slug");
  const tagsByProduct = groupValues(tagRows, "product_slug", "tag_slug");

  return productRows
    .map((row): AffiliateProduct => {
      const fallback = fallbackBySlug.get(row.slug);
      return {
        slug: row.slug,
        name: row.name,
        brand: row.brand ?? undefined,
        categorySlug: row.category_slug,
        category: categoryLabelBySlug.get(row.category_slug) ?? fallback?.category ?? row.category_slug,
        summary: row.summary,
        drmThoughts: row.drm_thoughts,
        reasonsToLike: reasonsByProduct.get(row.slug) ?? fallback?.reasonsToLike ?? [],
        usedFor: useCasesByProduct.get(row.slug) ?? fallback?.usedFor ?? [],
        featuredProducts: featuredByProduct.get(row.slug) ?? fallback?.featuredProducts,
        purchaseNote: row.purchase_note ?? undefined,
        cautionNote: row.caution_note ?? undefined,
        affiliateUrl: row.affiliate_url ?? undefined,
        directUrl: row.direct_url ?? undefined,
        imageUrl: row.image_url ?? undefined,
        couponCode: row.coupon_code ?? undefined,
        discountNote: row.discount_note ?? undefined,
        episodeSlugs: episodesByProduct.get(row.slug) ?? undefined,
        autoLinkTopicSlugs: autoTopicsByProduct.get(row.slug) ?? undefined,
        tags: tagsByProduct.get(row.slug) ?? fallback?.tags,
        sortOrder: row.sort_order,
        dateAdded: row.date_added,
        lastReviewed: row.last_reviewed,
        sourceNote: row.source_note,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function groupRows<T extends Record<K, string>, K extends keyof T>(rows: T[], key: K) {
  const groups = new Map<string, T[]>();
  rows.forEach((row) => {
    const groupKey = row[key];
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), row]);
  });
  return groups;
}

function groupValues<
  T extends Record<GroupKey, string> & Record<ValueKey, string>,
  GroupKey extends keyof T,
  ValueKey extends keyof T,
>(rows: T[], groupKey: GroupKey, valueKey: ValueKey) {
  const groups = new Map<string, string[]>();
  rows.forEach((row) => {
    const key = row[groupKey];
    groups.set(key, [...(groups.get(key) ?? []), row[valueKey]]);
  });
  return groups;
}

function groupOrderedBodies(rows: OrderedBodyRow[]) {
  const groups = groupRows(rows, "product_slug");
  return new Map(
    Array.from(groups.entries()).map(([productSlug, productRows]) => [
      productSlug,
      productRows.sort((a, b) => a.display_order - b.display_order).map((row) => row.body),
    ])
  );
}

function groupOrderedLabels(rows: OrderedLabelRow[]) {
  const groups = groupRows(rows, "product_slug");
  return new Map(
    Array.from(groups.entries()).map(([productSlug, productRows]) => [
      productSlug,
      productRows.sort((a, b) => a.display_order - b.display_order).map((row) => row.label),
    ])
  );
}
