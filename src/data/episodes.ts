import platformEpisodes from "./episodes-from-platforms.json";
import enrichmentMap from "./episodes-enrichment.json";

export type EpisodeReference = {
  label: string;
  url: string;
  comingSoon?: boolean;
};

export type EpisodeSection = {
  title: string;
  content: string[];
};

export type Episode = {
  slug: string;
  number: number;
  title: string;
  publishDate: string;
  durationMinutes?: number;
  summary: string;
  topics: string[];
  audioUrl?: string;
  videoUrl?: string;
  vimeoId?: string;
  spotifyId?: string;
  thumbnailUrl?: string;
  transcriptUrl?: string;
  references?: EpisodeReference[];
  checklist?: string[];
  keyTakeaways: string[];
  sections: EpisodeSection[];
};

type PlatformEpisode = {
  vimeoId?: string | null;
  spotifyId?: string | null;
  spotifyUrl?: string | null;
  youtubeId?: string | null;
  slug: string;
  number: number;
  title: string;
  publishDate: string;
  durationMinutes?: number;
  summary: string;
  thumbnailUrl?: string;
};

type Enrichment = {
  audioUrl?: string;
  topics?: string[];
  references?: EpisodeReference[];
  keyTakeaways?: string[];
  checklist?: string[];
  sections?: EpisodeSection[];
};

const enrichment = enrichmentMap as Record<string, Enrichment>;

/** Removes a leading "Episode N:" / "Ep. N:" / "Episode N -" label from platform titles so we can format consistently. */
function stripLeadingEpisodeLabel(title: string): string {
  return title.replace(/^(?:Episode|Ep\.)\s*#?\d+\s*[:–-]\s*/i, "").trim();
}

/** Site-wide episode heading: "Episode #: Name" */
export function episodeDisplayTitle(episode: { number: number; title: string }): string {
  const name = stripLeadingEpisodeLabel(episode.title);
  return `Episode ${episode.number}: ${name}`;
}

function getEnrichment(ep: PlatformEpisode): Enrichment {
  const vimeoId = ep.vimeoId ?? undefined;
  const spotifyId = ep.spotifyId ?? undefined;
  const youtubeId = ep.youtubeId ?? undefined;
  const slug = ep.slug ?? undefined;
  return (
    (vimeoId && enrichment[vimeoId]) ||
    (spotifyId && enrichment[spotifyId]) ||
    (youtubeId && enrichment[youtubeId]) ||
    (slug && enrichment[slug]) ||
    ({} as Enrichment)
  );
}

function buildReferences(ep: PlatformEpisode, en: Enrichment): EpisodeReference[] {
  if ((en.references?.length ?? 0) > 0) return en.references!;

  const refs: EpisodeReference[] = [];
  const vimeoId = ep.vimeoId ?? undefined;
  const spotifyUrl = ep.spotifyUrl ?? (ep.spotifyId ? `https://open.spotify.com/episode/${ep.spotifyId}` : undefined);
  const youtubeId = ep.youtubeId ?? undefined;

  if (vimeoId) refs.push({ label: "Watch on Vimeo", url: `https://vimeo.com/${vimeoId}` });
  if (spotifyUrl) refs.push({ label: "Listen on Spotify", url: spotifyUrl });
  if (youtubeId) refs.push({ label: "Watch on YouTube", url: `https://youtu.be/${youtubeId}` });

  return refs.length > 0 ? refs : [];
}

function mergeEpisode(ep: PlatformEpisode): Episode {
  const en = getEnrichment(ep);
  const vimeoId = ep.vimeoId ?? undefined;

  return {
    slug: ep.slug,
    number: ep.number,
    title: ep.title,
    publishDate: ep.publishDate,
    durationMinutes: ep.durationMinutes,
    summary: ep.summary,
    topics: en.topics ?? ["functional-medicine"],
    audioUrl: en.audioUrl,
    vimeoId: vimeoId || undefined,
    spotifyId: ep.spotifyId ?? undefined,
    thumbnailUrl: ep.thumbnailUrl,
    references: buildReferences(ep, en),
    keyTakeaways: en.keyTakeaways ?? [],
    checklist: en.checklist ?? [],
    sections: en.sections ?? [],
  };
}

const EPISODES: Episode[] = (platformEpisodes as PlatformEpisode[]).map(mergeEpisode);

export { EPISODES };
