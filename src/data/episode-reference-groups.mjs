const SITE_HOSTNAME = "drmexperienced.com";

/**
 * Resolve the publishing platform represented by an outbound episode link.
 * Hostnames are matched exactly (or as true subdomains) so deceptive suffixes
 * such as `youtube.com.example.test` cannot be treated as destinations.
 *
 * @param {string} value
 * @returns {"Vimeo" | "Spotify" | "YouTube" | "Rumble" | null}
 */
export function episodePlatformForUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    if (hostname === "vimeo.com" || hostname.endsWith(".vimeo.com")) return "Vimeo";
    if (hostname === "open.spotify.com") return "Spotify";
    if (
      hostname === "youtu.be" ||
      hostname === "youtube.com" ||
      hostname.endsWith(".youtube.com")
    ) {
      return "YouTube";
    }
    if (hostname === "rumble.com" || hostname.endsWith(".rumble.com")) return "Rumble";
  } catch {
    return null;
  }

  return null;
}

/**
 * @typedef {{ label: string, url: string, comingSoon?: boolean }} EpisodeReference
 * @typedef {{ reference: EpisodeReference, platform: "Vimeo" | "Spotify" | "YouTube" | "Rumble" }} PlatformReference
 * @typedef {{ reference: EpisodeReference, episodeSlug: string }} RelatedEpisodeReference
 * @typedef {{ reference: EpisodeReference, productSlug: string | null }} AffiliateReference
 */

/**
 * Classify episode references by their intended presentation region. This is a
 * display policy only: it preserves every reference and does not rewrite the
 * Supabase catalog.
 *
 * @param {EpisodeReference[]} references
 * @param {Set<string>} knownEpisodeSlugs
 * @returns {{
 *   platformReferences: PlatformReference[],
 *   relatedEpisodeReferences: RelatedEpisodeReference[],
 *   affiliateReferences: AffiliateReference[],
 *   resourceReferences: EpisodeReference[],
 * }}
 */
export function groupEpisodeReferences(references, knownEpisodeSlugs) {
  /** @type {PlatformReference[]} */
  const platformReferences = [];
  /** @type {RelatedEpisodeReference[]} */
  const relatedEpisodeReferences = [];
  /** @type {AffiliateReference[]} */
  const affiliateReferences = [];
  /** @type {EpisodeReference[]} */
  const resourceReferences = [];

  for (const reference of references) {
    const platform = episodePlatformForUrl(reference.url);
    const isDestinationLabel = /^(?:listen|watch)\s+on\b/i.test(reference.label.trim());
    if (platform && isDestinationLabel) {
      platformReferences.push({ reference, platform });
      continue;
    }

    const internalUrl = internalSiteUrl(reference.url);
    const episodeSlug = internalUrl
      ? /^\/episodes\/([^/]+)\/?$/.exec(internalUrl.pathname)?.[1]
      : undefined;
    if (episodeSlug && knownEpisodeSlugs.has(episodeSlug)) {
      relatedEpisodeReferences.push({ reference, episodeSlug });
      continue;
    }

    if (internalUrl && /^\/affiliates\/?$/.test(internalUrl.pathname)) {
      const productSlug = internalUrl.hash ? internalUrl.hash.slice(1) : null;
      affiliateReferences.push({ reference, productSlug });
      continue;
    }

    resourceReferences.push(reference);
  }

  return {
    platformReferences,
    relatedEpisodeReferences,
    affiliateReferences,
    resourceReferences,
  };
}

/** @param {string} value */
function internalSiteUrl(value) {
  try {
    const parsed = new URL(value, `https://${SITE_HOSTNAME}`);
    const normalizedHostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return normalizedHostname === SITE_HOSTNAME ? parsed : null;
  } catch {
    return null;
  }
}
