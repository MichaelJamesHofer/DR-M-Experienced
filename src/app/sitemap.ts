import type { MetadataRoute } from "next";
import { getContentCatalog } from "@/data/content-catalog";

const siteUrl = "https://drmexperienced.com";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { episodes, blogPosts } = await getContentCatalog();
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/episodes/`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/blogs/`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/affiliates/`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${siteUrl}/media/`, changeFrequency: "weekly", priority: 0.7 },
    { url: `${siteUrl}/about/`, changeFrequency: "yearly", priority: 0.6 },
    { url: `${siteUrl}/contact/`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/legal/privacy/`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${siteUrl}/legal/disclaimer/`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${siteUrl}/legal/copyright/`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const episodeRoutes: MetadataRoute.Sitemap = episodes.map((episode) => ({
    url: `${siteUrl}/episodes/${episode.slug}/`,
    lastModified: new Date(`${episode.publishDate}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.8,
  }));

  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${siteUrl}/blogs/${post.slug}/`,
    lastModified: new Date(`${post.updatedDate ?? post.publishDate}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...episodeRoutes, ...blogRoutes];
}
