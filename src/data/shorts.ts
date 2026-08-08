import shortFormCatalog from "../../publishing/short-form-catalog.json";

export type ShortContentType = "educational_clip" | "recipe";

export type ShortFormContent = {
  id: string;
  slug: string;
  contentType: ShortContentType;
  recordedOn: string;
  title: string;
  summary: string;
  body: string[];
  topics: string[];
  relatedEpisodeNumbers: number[];
  ingredients?: string[];
  durationSeconds: number;
  posterUrl: string;
  posterWidth: number;
  posterHeight: number;
  instagram: {
    mediaId: string;
    shortcode: string;
    url: string;
    publishedAt: string;
  };
  vimeo?: {
    id: string;
    url: string;
  };
  websitePath: string;
};

type CatalogItem = {
  id: string;
  slug: string;
  contentType: ShortContentType;
  recordedOn: string;
  title: string;
  summary: string;
  body: string[];
  topics: string[];
  relatedEpisodeNumbers: number[];
  ingredients?: string[];
  master: { durationSeconds: number };
  poster: { websitePath: string; width: number; height: number };
  destinations: {
    instagram: {
      mediaId: string;
      shortcode: string;
      url: string;
      publishedAt: string;
    };
    vimeo: {
      state: "published" | "not_published_as_short";
      id: string | null;
      url: string | null;
    };
    website: { path: string };
  };
};

function projectShort(item: CatalogItem): ShortFormContent {
  const vimeo =
    item.destinations.vimeo.state === "published" &&
    item.destinations.vimeo.id &&
    item.destinations.vimeo.url
      ? { id: item.destinations.vimeo.id, url: item.destinations.vimeo.url }
      : undefined;

  return {
    id: item.id,
    slug: item.slug,
    contentType: item.contentType,
    recordedOn: item.recordedOn,
    title: item.title,
    summary: item.summary,
    body: item.body,
    topics: item.topics,
    relatedEpisodeNumbers: item.relatedEpisodeNumbers,
    ingredients: item.ingredients,
    durationSeconds: item.master.durationSeconds,
    posterUrl: item.poster.websitePath,
    posterWidth: item.poster.width,
    posterHeight: item.poster.height,
    instagram: item.destinations.instagram,
    vimeo,
    websitePath: item.destinations.website.path,
  };
}

export const SHORTS: ShortFormContent[] = (shortFormCatalog.items as CatalogItem[]).map(projectShort);

export function shortDurationLabel(durationSeconds: number): string {
  const rounded = Math.round(durationSeconds);
  const minutes = Math.floor(rounded / 60);
  const seconds = rounded % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
