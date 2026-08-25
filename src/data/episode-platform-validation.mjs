const CORE_EPISODE_PLATFORMS = Object.freeze([
  ["Vimeo", "vimeoId"],
  ["Spotify", "spotifyId"],
  ["YouTube", "youtubeId"],
]);

/**
 * Fail-closed validation for the three core platform identities represented by
 * the public episode model. Rumble remains governed by the master-catalog and
 * human-only release policy because the Supabase episode row has no Rumble ID.
 *
 * @param {{ slug: string, vimeoId?: string, spotifyId?: string, youtubeId?: string }} episode
 * @param {Set<string>} availablePlatforms
 * @returns {string[]}
 */
export function coreEpisodePlatformProblems(episode, availablePlatforms) {
  const problems = [];

  for (const [platform, idField] of CORE_EPISODE_PLATFORMS) {
    const id = episode[idField];
    if (typeof id !== "string" || !id.trim()) {
      problems.push(`${episode.slug} is missing a published ${platform} identity.`);
      continue;
    }
    if (!availablePlatforms.has(platform)) {
      problems.push(`${episode.slug} is missing a published ${platform} reference.`);
    }
  }

  return problems;
}
