const REFERENCE_PLATFORM_LABELS = Object.freeze({
  spotify: "Spotify",
  youtube: "YouTube",
  vimeo: "Vimeo",
  rumble: "Rumble",
});

export function requiredEpisodeReferencePlatforms(episode) {
  if (!episode?.destinations || typeof episode.destinations !== "object") return [];

  return Object.entries(episode.destinations)
    .filter(([, destination]) => destination != null)
    .map(([platformId]) => {
      const label = REFERENCE_PLATFORM_LABELS[platformId];
      if (!label) throw new Error(`No website reference mapping exists for ${platformId}.`);
      return label;
    });
}
