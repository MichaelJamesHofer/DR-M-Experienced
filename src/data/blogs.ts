export type BlogReference = {
  label: string;
  url: string;
};

export type BlogSection = {
  title: string;
  content: string[];
};

export type BlogPost = {
  slug: string;
  title: string;
  subtitle?: string;
  excerpt: string;
  authorName: string;
  publishDate: string;
  updatedDate?: string;
  readingMinutes?: number;
  heroImageUrl?: string;
  metaDescription?: string;
  topics: string[];
  keyTakeaways?: string[];
  sections: BlogSection[];
  references?: BlogReference[];
  relatedEpisodeSlugs?: string[];
  relatedAffiliateProductSlugs?: string[];
};

export const BLOG_POSTS: BlogPost[] = [];
export const BLOG_EMPTY_STATIC_SLUG = "coming-soon";

export function blogTopicLabel(topic: string) {
  return topic
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
