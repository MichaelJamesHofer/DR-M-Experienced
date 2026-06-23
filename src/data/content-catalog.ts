import { cache } from "react";
import {
  AFFILIATE_CATEGORIES,
  AFFILIATE_PRODUCTS,
  type AffiliateCategory,
  type AffiliateProduct,
} from "./affiliates";
import { BLOG_POSTS, type BlogPost, type BlogReference, type BlogSection } from "./blogs";
import { EPISODES, type Episode, type EpisodeReference, type EpisodeSection } from "./episodes";

export type ContentCatalog = {
  episodes: Episode[];
  affiliateCategories: AffiliateCategory[];
  affiliateProducts: AffiliateProduct[];
  blogPosts: BlogPost[];
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

type BlogPostRow = {
  slug: string;
  title: string;
  subtitle: string | null;
  excerpt: string;
  author_name: string;
  publish_date: string;
  updated_date: string | null;
  reading_minutes: number | null;
  hero_image_url: string | null;
  meta_description: string | null;
};

type BlogTopicRow = {
  blog_slug: string;
  topic_slug: string;
};

type BlogSectionRow = {
  blog_slug: string;
  display_order: number;
  title: string;
};

type BlogSectionParagraphRow = {
  blog_slug: string;
  section_display_order: number;
  display_order: number;
  body: string;
};

type BlogReferenceRow = {
  blog_slug: string;
  label: string;
  url: string;
  display_order: number;
};

type BlogRelatedEpisodeRow = {
  blog_slug: string;
  episode_slug: string;
  display_order: number;
};

type BlogRelatedAffiliateProductRow = {
  blog_slug: string;
  product_slug: string;
  display_order: number;
};

const fallbackCatalog: ContentCatalog = {
  episodes: EPISODES,
  affiliateCategories: AFFILIATE_CATEGORIES,
  affiliateProducts: AFFILIATE_PRODUCTS,
  blogPosts: BLOG_POSTS,
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
      blogRows,
      blogTopicRows,
      blogSectionRows,
      blogSectionParagraphRows,
      blogReferenceRows,
      blogRelatedEpisodeRows,
      blogRelatedProductRows,
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
      fetchOptionalRows<BlogPostRow>(supabaseUrl, supabaseAnonKey, "blog_posts", {
        select: "*",
        status: "eq.published",
      }),
      fetchOptionalRows<BlogTopicRow>(supabaseUrl, supabaseAnonKey, "blog_post_topics", {
        select: "*",
      }),
      fetchOptionalRows<BlogSectionRow>(supabaseUrl, supabaseAnonKey, "blog_post_sections", {
        select: "*",
      }),
      fetchOptionalRows<BlogSectionParagraphRow>(
        supabaseUrl,
        supabaseAnonKey,
        "blog_post_section_paragraphs",
        { select: "*" }
      ),
      fetchOptionalRows<BlogReferenceRow>(supabaseUrl, supabaseAnonKey, "blog_post_references", {
        select: "*",
      }),
      fetchOptionalRows<BlogRelatedEpisodeRow>(
        supabaseUrl,
        supabaseAnonKey,
        "blog_post_related_episodes",
        { select: "*" }
      ),
      fetchOptionalRows<BlogRelatedAffiliateProductRow>(
        supabaseUrl,
        supabaseAnonKey,
        "blog_post_related_affiliate_products",
        { select: "*" }
      ),
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
      blogPosts: mapBlogPosts(
        blogRows,
        blogTopicRows,
        blogSectionRows,
        blogSectionParagraphRows,
        blogReferenceRows,
        blogRelatedEpisodeRows,
        blogRelatedProductRows
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

class FetchRowsError extends Error {
  status: number;

  constructor(table: string, status: number, body: string) {
    super(`${table} returned ${status}${body ? `: ${body}` : ""}`);
    this.name = "FetchRowsError";
    this.status = status;
  }
}

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
    const body = await response.text().catch(() => "");
    throw new FetchRowsError(table, response.status, body);
  }

  return response.json() as Promise<T[]>;
}

async function fetchOptionalRows<T>(
  supabaseUrl: string,
  supabaseAnonKey: string,
  table: string,
  params: Record<string, string>
): Promise<T[]> {
  try {
    return await fetchRows<T>(supabaseUrl, supabaseAnonKey, table, params);
  } catch (error) {
    if (error instanceof FetchRowsError && error.status === 404) {
      return [];
    }

    throw error;
  }
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

function mapBlogPosts(
  blogRows: BlogPostRow[],
  topicRows: BlogTopicRow[],
  sectionRows: BlogSectionRow[],
  sectionParagraphRows: BlogSectionParagraphRow[],
  referenceRows: BlogReferenceRow[],
  relatedEpisodeRows: BlogRelatedEpisodeRow[],
  relatedProductRows: BlogRelatedAffiliateProductRow[]
) {
  const topicsByBlog = groupValues(topicRows, "blog_slug", "topic_slug");
  const sectionsByBlog = groupBlogSections(sectionRows, sectionParagraphRows);
  const referencesByBlog = groupRows(referenceRows, "blog_slug");
  const episodesByBlog = groupBlogOrderedValues(relatedEpisodeRows, "episode_slug");
  const productsByBlog = groupBlogOrderedValues(relatedProductRows, "product_slug");

  return blogRows
    .map(
      (row): BlogPost => ({
        slug: row.slug,
        title: row.title,
        subtitle: row.subtitle ?? undefined,
        excerpt: row.excerpt,
        authorName: row.author_name,
        publishDate: row.publish_date,
        updatedDate: row.updated_date ?? undefined,
        readingMinutes: row.reading_minutes ?? undefined,
        heroImageUrl: row.hero_image_url ?? undefined,
        metaDescription: row.meta_description ?? undefined,
        topics: topicsByBlog.get(row.slug) ?? [],
        sections: sectionsByBlog.get(row.slug) ?? [],
        references: (referencesByBlog.get(row.slug) ?? [])
          .sort((a, b) => a.display_order - b.display_order)
          .map(
            (reference): BlogReference => ({
              label: reference.label,
              url: reference.url,
            })
          ),
        relatedEpisodeSlugs: episodesByBlog.get(row.slug) ?? [],
        relatedAffiliateProductSlugs: productsByBlog.get(row.slug) ?? [],
      })
    )
    .sort((a, b) => {
      const dateA = new Date(a.publishDate).getTime();
      const dateB = new Date(b.publishDate).getTime();
      if (dateA !== dateB) return dateB - dateA;
      return a.title.localeCompare(b.title);
    });
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

function groupBlogSections(sectionRows: BlogSectionRow[], paragraphRows: BlogSectionParagraphRow[]) {
  const paragraphsBySection = new Map<string, BlogSectionParagraphRow[]>();
  paragraphRows.forEach((row) => {
    const key = `${row.blog_slug}:${row.section_display_order}`;
    paragraphsBySection.set(key, [...(paragraphsBySection.get(key) ?? []), row]);
  });

  const sectionsByBlog = groupRows(sectionRows, "blog_slug");
  return new Map(
    Array.from(sectionsByBlog.entries()).map(([blogSlug, blogRows]) => [
      blogSlug,
      blogRows
        .sort((a, b) => a.display_order - b.display_order)
        .map((section): BlogSection => {
          const paragraphs = paragraphsBySection.get(`${blogSlug}:${section.display_order}`) ?? [];
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

function groupBlogOrderedValues<
  T extends { blog_slug: string; display_order: number } & Record<ValueKey, string>,
  ValueKey extends keyof T,
>(rows: T[], valueKey: ValueKey) {
  const groups = groupRows(rows, "blog_slug");
  return new Map(
    Array.from(groups.entries()).map(([blogSlug, blogRows]) => [
      blogSlug,
      blogRows.sort((a, b) => a.display_order - b.display_order).map((row) => row[valueKey]),
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
  const episodeSlugs = new Set(catalog.episodes.map((episode) => episode.slug));
  const productSlugs = new Set(catalog.affiliateProducts.map((product) => product.slug));

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

  catalog.blogPosts.forEach((post) => {
    if (!post.excerpt.trim()) problems.push(`${post.slug} has no excerpt.`);
    if (post.topics.length === 0) problems.push(`${post.slug} has no topic rows.`);
    if (post.sections.length === 0) problems.push(`${post.slug} has no section rows.`);

    post.sections.forEach((section) => {
      if (section.content.length === 0) {
        problems.push(`${post.slug} section "${section.title}" has no paragraph rows.`);
      }
    });

    post.relatedEpisodeSlugs?.forEach((episodeSlug) => {
      if (!episodeSlugs.has(episodeSlug)) {
        problems.push(`${post.slug} points to missing episode ${episodeSlug}.`);
      }
    });

    post.relatedAffiliateProductSlugs?.forEach((productSlug) => {
      if (!productSlugs.has(productSlug)) {
        problems.push(`${post.slug} points to missing affiliate product ${productSlug}.`);
      }
    });
  });

  if (problems.length > 0) {
    throw new Error(`Supabase catalog failed validation:\n- ${problems.join("\n- ")}`);
  }
}
