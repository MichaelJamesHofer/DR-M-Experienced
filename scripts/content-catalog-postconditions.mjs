export const PRODUCTION_SUPABASE_PROJECT_REF = "tdbsuzciwotleualdcjf";

export const EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS = Object.freeze([
  {
    episode_slug: "brain-fog-part-1",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "brain-fog-part-1",
    label: "Related product guide: DesBio / DBscript",
    url: "https://drmexperienced.com/affiliates/#desbio-dbscript",
    coming_soon: false,
    display_order: 130,
  },
  {
    episode_slug: "brain-fog-part-1",
    label: "Related product guide: Best365Labs",
    url: "https://drmexperienced.com/affiliates/#best365labs",
    coming_soon: false,
    display_order: 140,
  },
  {
    episode_slug: "brain-fog-part-2",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "brain-fog-part-2",
    label: "Related product guide: DesBio / DBscript",
    url: "https://drmexperienced.com/affiliates/#desbio-dbscript",
    coming_soon: false,
    display_order: 130,
  },
  {
    episode_slug: "brain-fog-part-2",
    label: "Related product guide: Best365Labs",
    url: "https://drmexperienced.com/affiliates/#best365labs",
    coming_soon: false,
    display_order: 140,
  },
  {
    episode_slug: "episode-3-insomnia",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "episode-3-insomnia",
    label: "Mentioned product guide: BlockBlueLight",
    url: "https://drmexperienced.com/affiliates/#block-blue-light",
    coming_soon: false,
    display_order: 130,
  },
  {
    episode_slug: "episode-3-insomnia",
    label: "Mentioned product guide: DesBio / DBscript",
    url: "https://drmexperienced.com/affiliates/#desbio-dbscript",
    coming_soon: false,
    display_order: 140,
  },
  {
    episode_slug: "episode-4-emf",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "episode-4-emf",
    label: "Mentioned product guide: Airestech",
    url: "https://drmexperienced.com/affiliates/#airestech",
    coming_soon: false,
    display_order: 130,
  },
  {
    episode_slug: "episode-4-emf",
    label: "Related product guide: BlockBlueLight",
    url: "https://drmexperienced.com/affiliates/#block-blue-light",
    coming_soon: false,
    display_order: 140,
  },
  {
    episode_slug: "episode-4-emf",
    label: "Related product guide: Safe Living Technologies",
    url: "https://drmexperienced.com/affiliates/#safe-living-technologies",
    coming_soon: false,
    display_order: 150,
  },
  {
    episode_slug: "episode-5-energy",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "episode-5-energy",
    label: "Related product guide: Best365Labs",
    url: "https://drmexperienced.com/affiliates/#best365labs",
    coming_soon: false,
    display_order: 130,
  },
  {
    episode_slug: "episode-6-concussion-and-pathophysiology",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
  {
    episode_slug: "episode-7-the-brain-on-fire",
    label: "Affiliate and product guide",
    url: "https://drmexperienced.com/affiliates/",
    coming_soon: false,
    display_order: 120,
  },
]);

export const EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS = Object.freeze([
  {
    episode_slug: "episode-3-insomnia",
    section_display_order: 30,
    display_order: 10,
    body: "Discusses blue-light strategies, evening habits, morning light and daytime exercise, and cautious use of melatonin and homeopathic options, with current product-guide links collected in the episode resources.",
  },
  {
    episode_slug: "episode-4-emf",
    section_display_order: 30,
    display_order: 10,
    body: "Practical reduction strategies: hardwiring, nighttime WiFi habits, meter-based assessment, smart-meter choices, and current links collected in the episode resources and product guide.",
  },
]);

export const EPISODE_PRODUCT_RELATIONSHIP_POSTCONDITION = Object.freeze({
  product_slug: "desbio-dbscript",
  episode_slug: "episode-3-insomnia",
  link_reason: "DesBio sleep-support products named in Episode 3",
});

export function validateProductionSupabaseUrl(value) {
  try {
    const url = new URL(value);
    const expectedHostname = `${PRODUCTION_SUPABASE_PROJECT_REF}.supabase.co`;
    if (
      url.protocol !== "https:" ||
      url.hostname !== expectedHostname ||
      url.port ||
      url.username ||
      url.password
    ) {
      return [
        `Supabase catalog configuration must target production project ${PRODUCTION_SUPABASE_PROJECT_REF}.`,
      ];
    }
  } catch {
    return ["Supabase catalog configuration is not a valid production project URL."];
  }

  return [];
}

export function validateEpisodeAffiliatePostconditions(tables) {
  const problems = [];
  const references = tables.episode_references ?? [];
  const relationships = tables.affiliate_product_episode_links ?? [];
  const paragraphs = tables.episode_section_paragraphs ?? [];

  for (const expected of EPISODE_AFFILIATE_REFERENCE_POSTCONDITIONS) {
    if (!references.some((row) => rowMatches(row, expected))) {
      problems.push(
        `${expected.episode_slug}: required affiliate reference is missing or drifted (${expected.url}).`
      );
    }
  }

  if (!relationships.some((row) => rowMatches(row, EPISODE_PRODUCT_RELATIONSHIP_POSTCONDITION))) {
    problems.push("episode-3-insomnia: required DesBio affiliate relationship is missing or drifted.");
  }

  for (const expected of EPISODE_RESOURCE_PARAGRAPH_POSTCONDITIONS) {
    if (!paragraphs.some((row) => rowMatches(row, expected))) {
      problems.push(
        `${expected.episode_slug}: corrected resource paragraph is missing or drifted.`
      );
    }
  }

  return problems;
}

function rowMatches(row, expected) {
  return Object.entries(expected).every(([key, value]) => row?.[key] === value);
}
