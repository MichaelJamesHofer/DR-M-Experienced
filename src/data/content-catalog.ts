import { cache } from "react";
import {
  AFFILIATE_CATEGORIES,
  AFFILIATE_PRODUCTS,
  type AffiliateCategory,
  type AffiliateProduct,
} from "./affiliates";
import { EPISODES, type Episode, type EpisodeReference, type EpisodeSection } from "./episodes";

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

type EpisodeOrderedBodyRow = {
  episode_slug: string;
  display_order: number;
  body: string;
};

type EpisodeSectionRow = {
  episode_slug: string;
  display_order: number;
  title: string;
};

type EpisodeSectionParagraphRow = {
  episode_slug: string;
  section_display_order: number;
  display_order: number;
  body: string;
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

const strictContentCatalog = process.env.CONTENT_CATALOG_STRICT === "true";

export const getContentCatalog = cache(async (): Promise<ContentCatalog> => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey =
    process.env.SUPABASE_CATALOG_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (strictContentCatalog) {
      throw new Error(
        "CONTENT_CATALOG_STRICT requires NEXT_PUBLIC_SUPABASE_URL plus SUPABASE_CATALOG_KEY, SUPABASE_ANON_KEY, or NEXT_PUBLIC_SUPABASE_ANON_KEY."
      );
    }

    return fallbackCatalog;
  }

  try {
    const [
      episodeRows,
      episodeTopicRows,
      episodeReferenceRows,
      episodeTakeawayRows,
      episodeChecklistRows,
      episodeSectionRows,
      episodeSectionParagraphRows,
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
      fetchRows<EpisodeOrderedBodyRow>(supabaseUrl, supabaseAnonKey, "episode_key_takeaways", {
        select: "*",
      }),
      fetchRows<EpisodeOrderedBodyRow>(supabaseUrl, supabaseAnonKey, "episode_checklist_items", {
        select: "*",
      }),
      fetchRows<EpisodeSectionRow>(supabaseUrl, supabaseAnonKey, "episode_sections", {
        select: "*",
      }),
      fetchRows<EpisodeSectionParagraphRow>(
        supabaseUrl,
        supabaseAnonKey,
        "episode_section_paragraphs",
        { select: "*" }
      ),
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

    const catalog: ContentCatalog = {
      episodes: mapEpisodes(
        episodeRows,
        episodeTopicRows,
        episodeReferenceRows,
        episodeTakeawayRows,
        episodeChecklistRows,
        episodeSectionRows,
        episodeSectionParagraphRows
      ),
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

    if (strictContentCatalog) {
      validateSupabaseCatalog(catalog);
    }

    return catalog;
  } catch (error) {
    if (strictContentCatalog) {
      throw error;
    }

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
  referenceRows: EpisodeReferenceRow[],
  takeawayRows: EpisodeOrderedBodyRow[],
  checklistRows: EpisodeOrderedBodyRow[],
  sectionRows: EpisodeSectionRow[],
  sectionParagraphRows: EpisodeSectionParagraphRow[]
) {
  const topicsByEpisode = groupValues(topicRows, "episode_slug", "topic_slug");
  const referencesByEpisode = groupRows(referenceRows, "episode_slug");
  const keyTakeawaysByEpisode = groupEpisodeOrderedBodies(takeawayRows);
  const checklistByEpisode = groupEpisodeOrderedBodies(checklistRows);
  const sectionsByEpisode = groupEpisodeSections(sectionRows, sectionParagraphRows);

  return rows
    .map((row): Episode => {
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
        topics: topicsByEpisode.get(row.slug) ?? [],
        audioUrl: row.audio_url ?? undefined,
        vimeoId: row.vimeo_id ?? undefined,
        spotifyId: row.spotify_id ?? undefined,
        thumbnailUrl: row.thumbnail_url ?? undefined,
        transcriptUrl: row.transcript_url ?? undefined,
        references,
        keyTakeaways: keyTakeawaysByEpisode.get(row.slug) ?? [],
        checklist: checklistByEpisode.get(row.slug) ?? [],
        sections: sectionsByEpisode.get(row.slug) ?? [],
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
  const categoryLabelBySlug = new Map(categoryRows.map((category) => [category.slug, category.label]));
  const reasonsByProduct = groupOrderedBodies(reasonRows);
  const useCasesByProduct = groupOrderedBodies(useCaseRows);
  const featuredByProduct = groupOrderedLabels(featuredRows);
  const episodesByProduct = groupValues(episodeLinkRows, "product_slug", "episode_slug");
  const autoTopicsByProduct = groupValues(autoTopicRows, "product_slug", "topic_slug");
  const tagsByProduct = groupValues(tagRows, "product_slug", "tag_slug");

  return productRows
    .map((row): AffiliateProduct => {
      return {
        slug: row.slug,
        name: row.name,
        brand: row.brand ?? undefined,
        categorySlug: row.category_slug,
        category: categoryLabelBySlug.get(row.category_slug) ?? row.category_slug,
        summary: row.summary,
        drmThoughts: row.drm_thoughts,
        reasonsToLike: reasonsByProduct.get(row.slug) ?? [],
        usedFor: useCasesByProduct.get(row.slug) ?? [],
        featuredProducts: featuredByProduct.get(row.slug),
        purchaseNote: row.purchase_note ?? undefined,
        cautionNote: row.caution_note ?? undefined,
        affiliateUrl: row.affiliate_url ?? undefined,
        directUrl: row.direct_url ?? undefined,
        imageUrl: row.image_url ?? undefined,
        couponCode: row.coupon_code ?? undefined,
        discountNote: row.discount_note ?? undefined,
        episodeSlugs: episodesByProduct.get(row.slug) ?? undefined,
        autoLinkTopicSlugs: autoTopicsByProduct.get(row.slug) ?? undefined,
        tags: tagsByProduct.get(row.slug),
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

function groupEpisodeOrderedBodies(rows: EpisodeOrderedBodyRow[]) {
  const groups = groupRows(rows, "episode_slug");
  return new Map(
    Array.from(groups.entries()).map(([episodeSlug, episodeRows]) => [
      episodeSlug,
      episodeRows.sort((a, b) => a.display_order - b.display_order).map((row) => row.body),
    ])
  );
}

function groupEpisodeSections(
  sectionRows: EpisodeSectionRow[],
  paragraphRows: EpisodeSectionParagraphRow[]
) {
  const paragraphsBySection = new Map<string, EpisodeSectionParagraphRow[]>();
  paragraphRows.forEach((row) => {
    const key = `${row.episode_slug}:${row.section_display_order}`;
    paragraphsBySection.set(key, [...(paragraphsBySection.get(key) ?? []), row]);
  });

  const sectionsByEpisode = groupRows(sectionRows, "episode_slug");
  return new Map(
    Array.from(sectionsByEpisode.entries()).map(([episodeSlug, episodeRows]) => [
      episodeSlug,
      episodeRows
        .sort((a, b) => a.display_order - b.display_order)
        .map((section): EpisodeSection => {
          const paragraphs = paragraphsBySection.get(`${episodeSlug}:${section.display_order}`) ?? [];
          return {
            title: section.title,
            content: paragraphs
              .sort((a, b) => a.display_order - b.display_order)
              .map((paragraph) => paragraph.body),
          };
        }),
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

function validateSupabaseCatalog(catalog: ContentCatalog) {
  const problems: string[] = [];
  const categorySlugs = new Set(catalog.affiliateCategories.map((category) => category.slug));

  if (catalog.episodes.length === 0) problems.push("No published episodes returned from Supabase.");
  if (catalog.affiliateCategories.length === 0) {
    problems.push("No affiliate categories returned from Supabase.");
  }
  if (catalog.affiliateProducts.length === 0) {
    problems.push("No published affiliate products returned from Supabase.");
  }

  catalog.episodes.forEach((episode) => {
    if (episode.topics.length === 0) problems.push(`${episode.slug} has no topic rows.`);
    if ((episode.references ?? []).length === 0) problems.push(`${episode.slug} has no reference rows.`);
    if (episode.keyTakeaways.length === 0) {
      problems.push(`${episode.slug} has no key takeaway rows.`);
    }
    if (episode.sections.length === 0) problems.push(`${episode.slug} has no section rows.`);

    episode.sections.forEach((section) => {
      if (section.content.length === 0) {
        problems.push(`${episode.slug} section "${section.title}" has no paragraph rows.`);
      }
    });
  });

  catalog.affiliateProducts.forEach((product) => {
    if (!categorySlugs.has(product.categorySlug)) {
      problems.push(`${product.slug} points to missing category ${product.categorySlug}.`);
    }
    if (!product.summary.trim()) problems.push(`${product.slug} has no summary.`);
    if (!product.drmThoughts.trim()) problems.push(`${product.slug} has no Dr. M thoughts.`);
    if (product.reasonsToLike.length === 0) problems.push(`${product.slug} has no reason rows.`);
    if (product.usedFor.length === 0) problems.push(`${product.slug} has no use-case rows.`);
    if (!product.affiliateUrl && !product.directUrl) problems.push(`${product.slug} has no URL.`);
  });

  if (problems.length > 0) {
    throw new Error(`Supabase catalog failed validation:\n- ${problems.join("\n- ")}`);
  }
}
