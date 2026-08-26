import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { coreEpisodePlatformProblems } from "../../src/data/episode-platform-validation.mjs";
import {
  episodePlatformForUrl,
  groupEpisodeReferences,
} from "../../src/data/episode-reference-groups.mjs";
import { requiredEpisodeReferencePlatforms } from "./catalog-platform-policy.mjs";

const episodeEnrichment = JSON.parse(
  fs.readFileSync(new URL("../../src/data/episodes-enrichment.json", import.meta.url), "utf8"),
);
const episode8References = episodeEnrichment["1221293570"].references;

const expectedOlderAffiliateReferences = new Map([
  ["1156414707", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
    ["Related product guide: DesBio / DBscript", "https://drmexperienced.com/affiliates/#desbio-dbscript"],
    ["Related product guide: Best365Labs", "https://drmexperienced.com/affiliates/#best365labs"],
  ]],
  ["1159441883", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
    ["Related product guide: DesBio / DBscript", "https://drmexperienced.com/affiliates/#desbio-dbscript"],
    ["Related product guide: Best365Labs", "https://drmexperienced.com/affiliates/#best365labs"],
  ]],
  ["1179740758", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
    ["Mentioned product guide: BlockBlueLight", "https://drmexperienced.com/affiliates/#block-blue-light"],
    ["Mentioned product guide: DesBio / DBscript", "https://drmexperienced.com/affiliates/#desbio-dbscript"],
  ]],
  ["1179956166", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
    ["Mentioned product guide: Airestech", "https://drmexperienced.com/affiliates/#airestech"],
    ["Related product guide: BlockBlueLight", "https://drmexperienced.com/affiliates/#block-blue-light"],
    ["Related product guide: Safe Living Technologies", "https://drmexperienced.com/affiliates/#safe-living-technologies"],
  ]],
  ["1204939658", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
    ["Related product guide: Best365Labs", "https://drmexperienced.com/affiliates/#best365labs"],
  ]],
  ["1204939692", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
  ]],
  ["1205004739", [
    ["Affiliate and product guide", "https://drmexperienced.com/affiliates/"],
  ]],
]);

test("older episode resources distinguish mentioned products from related guide material", () => {
  for (const [vimeoId, expected] of expectedOlderAffiliateReferences) {
    const actual = episodeEnrichment[vimeoId].references
      .filter(({ url }) => url.startsWith("https://drmexperienced.com/affiliates/"))
      .map(({ label, url }) => [label, url]);
    assert.deepEqual(actual, expected, `affiliate references drifted for Vimeo ${vimeoId}`);
  }
});

test("older website notes do not direct listeners to stale pinned comments", () => {
  for (const [vimeoId] of expectedOlderAffiliateReferences) {
    assert.doesNotMatch(
      JSON.stringify(episodeEnrichment[vimeoId]),
      /pinned comment|coming soon|FMI Center for Optimal Health/i,
      `stale editorial note remains for Vimeo ${vimeoId}`,
    );
  }
});

test("Episode 8 references group into their intended presentation regions", () => {
  const grouped = groupEpisodeReferences(
    episode8References,
    new Set([
      "episode-6-concussion-and-pathophysiology",
      "episode-7-the-brain-on-fire",
      "episode-8-food-and-the-brain",
    ]),
  );

  assert.deepEqual(
    grouped.platformReferences.map(({ platform }) => platform),
    ["Vimeo", "Spotify", "YouTube"],
  );
  assert.deepEqual(
    grouped.relatedEpisodeReferences.map(({ episodeSlug }) => episodeSlug),
    ["episode-7-the-brain-on-fire", "episode-6-concussion-and-pathophysiology"],
  );
  assert.equal(grouped.affiliateReferences.length, 5);
  assert.deepEqual(
    grouped.resourceReferences.map(({ label }) => label),
    ["Request the Healthy Brain Diet handout", "Purity laboratory information"],
  );
  assert.equal(
    grouped.platformReferences.length +
      grouped.relatedEpisodeReferences.length +
      grouped.affiliateReferences.length +
      grouped.resourceReferences.length,
    episode8References.length,
  );
});

test("platform hostname matching includes existing channels and rejects deceptive hosts", () => {
  assert.equal(episodePlatformForUrl("https://player.vimeo.com/video/1"), "Vimeo");
  assert.equal(episodePlatformForUrl("https://www.youtube.com/watch?v=1"), "YouTube");
  assert.equal(episodePlatformForUrl("https://rumble.com/v1-example.html"), "Rumble");
  assert.equal(episodePlatformForUrl("https://youtube.com.evil.test/watch?v=1"), null);
  assert.equal(episodePlatformForUrl("not a url"), null);
});

test("unknown and deceptive same-site episode paths remain visible as resources", () => {
  const grouped = groupEpisodeReferences(
    [
      { label: "Unknown episode", url: "https://drmexperienced.com/episodes/not-published/" },
      { label: "External lookalike", url: "https://drmexperienced.com.evil.test/episodes/episode-7-the-brain-on-fire/" },
      { label: "Supporting interview", url: "https://youtu.be/research-video" },
    ],
    new Set(["episode-7-the-brain-on-fire"]),
  );

  assert.equal(grouped.relatedEpisodeReferences.length, 0);
  assert.equal(grouped.resourceReferences.length, 3);
});

test("published reference requirements follow non-null master-catalog destinations", () => {
  const platforms = requiredEpisodeReferencePlatforms({
    destinations: {
      spotify: { id: "spotify-1", url: "https://open.spotify.com/episode/spotify-1" },
      youtube: { id: "youtube-1", url: "https://youtu.be/youtube-1" },
      vimeo: { id: "vimeo-1", url: "https://vimeo.com/vimeo-1" },
      rumble: null,
    },
  });

  assert.deepEqual(platforms, ["Spotify", "YouTube", "Vimeo"]);
});

test("an existing Rumble binding remains a required exact website reference", () => {
  const platforms = requiredEpisodeReferencePlatforms({
    destinations: {
      spotify: null,
      youtube: null,
      vimeo: null,
      rumble: { id: "rumble-1", url: "https://rumble.com/rumble-1" },
    },
  });

  assert.deepEqual(platforms, ["Rumble"]);
});

test("an unknown bound platform fails closed", () => {
  assert.throws(
    () => requiredEpisodeReferencePlatforms({ destinations: { unknown: { id: "1" } } }),
    /No website reference mapping exists for unknown/,
  );
});

test("Supabase episode validation rejects a missing core identity even when other refs exist", () => {
  assert.deepEqual(
    coreEpisodePlatformProblems(
      {
        slug: "episode-8-food-and-the-brain",
        vimeoId: "1221293570",
        spotifyId: "7oYwjErc5TXpocbRFgzvH0",
        youtubeId: undefined,
      },
      new Set(["Vimeo", "Spotify", "YouTube", "Rumble"]),
    ),
    ["episode-8-food-and-the-brain is missing a published YouTube identity."],
  );
});

test("Supabase episode validation requires active refs for every core identity and omits Rumble", () => {
  assert.deepEqual(
    coreEpisodePlatformProblems(
      {
        slug: "episode-8-food-and-the-brain",
        vimeoId: "1221293570",
        spotifyId: "7oYwjErc5TXpocbRFgzvH0",
        youtubeId: "ax5BSELnBbo",
      },
      new Set(["Vimeo", "YouTube"]),
    ),
    ["episode-8-food-and-the-brain is missing a published Spotify reference."],
  );
});
