import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildSiteBrandProjection,
  DEFAULT_SITE_BRAND_PATH,
  renderSiteBrandProjection,
} from "../generate-site-brand.mjs";

import {
  catalogAssetBindingProblems,
  catalogHash,
  comparePublishedCatalogFeed,
  DEFAULT_CATALOG_PATH,
  episodeHash,
  findEpisode,
  htmlDescriptionToPlainText,
  loadCatalog,
  manifestCatalogProblems,
  normalizeDescriptionForComparison,
  resolveCatalogAsset,
  resolveSourceRef,
  validateCatalog,
  youtubeDescriptionFromHtml,
} from "./catalog.mjs";

const expectedIdentities = [
  [1, "7cAdb8GE4khC9EYKAjmYuc", "5IMYaqnQsFY", "1156414707", "v74kzcw"],
  [2, "19Pct0ClX3j1EOwJ3ySVd7", "DJe0fPmTf8k", "1159441883", "v74l0km"],
  [3, "07OHz4sfbefOORcNi9xaUK", "r5JYtE8Vm9I", "1179740758", "v77zlls"],
  [4, "0aDVuIwrRlDKxEylMj2dyw", "binbLcb3f_s", "1179956166", "v780pxq"],
  [5, "6fQAClcR4AAuueHjBNlrJC", "N_F0hhHkIQ4", "1204939658", "v7bvj32"],
  [6, "7MbKWgPZN40KEyN5j123JC", "8u1Ps_mCpO4", "1204939692", "v7bvk8i"],
  [7, "5QJlHSE6JhP3ymSCNzbWxv", "5UOEvs59hBA", "1205004739", "v7bvtu4"],
];

const expectedArchivedYouTubeIdentities = [
  [1, "LXASEw-WFq8"],
  [2, "s740_XVTaAY"],
  [3, "59r5XFynaDo"],
  [4, "X8WChChyh9c"],
  [5, "JyBK6KtOo_k"],
  [6, "odNrtPEuong"],
  [7, "3IVDJqwT2yY"],
];

const expectedPodcastAudio = [
  ["brain-fog-part-1", "1156414707", "https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3"],
  ["brain-fog-part-2", "1159441883", "https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_07_05_41_20_c5dc584a-9799-404f-96e5-66fd2958ad94.mp3"],
  ["episode-3-insomnia", "1179740758", "https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_07_05_42_30_c6bd9b48-095f-4ee9-9eda-ebb0d7956d09.mp3"],
  ["episode-4-emf", "1179956166", "https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_07_05_43_51_32e2ccc6-04c8-4592-9e50-aa8d48eb9cb8.mp3"],
  ["episode-5-energy", "1204939658", "https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_07_05_46_23_1de2f4f3-aeab-457a-a02d-2bf61108132d.mp3"],
  ["episode-6-concussion-and-pathophysiology", "1204939692", "https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_07_05_55_46_4806f336-163e-4ffb-b446-e4e03bb81013.mp3"],
  ["episode-7-the-brain-on-fire", "1205004739", "https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_07_05_56_36_52e27ebd-6648-4ff7-adf3-f9f7731c1b86.mp3"],
];

async function temporarySources() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-catalog-"));
  const root = path.join(temporary, "project-source");
  await fs.mkdir(root);
  const configPath = path.join(temporary, "sources.json");
  await fs.writeFile(configPath, `${JSON.stringify({ schemaVersion: 1, roots: { dropbox: root } }, null, 2)}\n`);
  return { temporary, root, configPath };
}

test("master catalog validates and has a deterministic hash", async () => {
  const catalog = await loadCatalog();
  const result = validateCatalog(catalog);
  assert.deepEqual(result, { valid: true, errors: [] });
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.revision, 13);
  assert.equal(catalog.episodes.length, 7);
  assert.match(catalogHash(catalog), /^[a-f0-9]{64}$/);
  assert.equal(catalogHash(catalog), catalogHash(structuredClone(catalog)));
  assert.ok(Object.values(catalog.assetRegistry).every((asset) => asset.uri.startsWith("dropbox:")));
  assert.ok(
    Object.values(catalog.assetRegistry)
      .filter((asset) => asset.status === "unmounted")
      .every((asset) => asset.sha256 === null && asset.sizeBytes === null)
  );
  assert.ok(
    Object.values(catalog.assetRegistry)
      .filter((asset) => asset.status === "verified")
      .every((asset) => /^[a-f0-9]{64}$/.test(asset.sha256) && Number.isInteger(asset.sizeBytes))
  );
});

test("HTML descriptions have a deterministic readable plain-text projection", () => {
  const html = [
    "<h2>What you will learn</h2>",
    "<p>Hello <strong>world</strong> &amp; friends.<br>Next line.</p>",
    "<ul><li>First&nbsp;point</li><li>Second <em>point</em></li></ul>",
    "<ol><li>Check one</li><li>Check two</li></ol>",
    "<p>2 < 3 &mdash; still visible.</p>",
    "<script>not visible</script><style>.hidden { display: none }</style>",
  ].join("");
  const expected = [
    "What you will learn",
    "",
    "Hello world & friends.",
    "Next line.",
    "",
    "- First point",
    "- Second point",
    "",
    "1. Check one",
    "2. Check two",
    "",
    "2 < 3 — still visible.",
  ].join("\n");

  assert.equal(htmlDescriptionToPlainText(html), expected);
  assert.equal(htmlDescriptionToPlainText(html), htmlDescriptionToPlainText(html));
  assert.equal(htmlDescriptionToPlainText("Plain description"), "Plain description");
  assert.equal(htmlDescriptionToPlainText(""), "");
  assert.throws(() => htmlDescriptionToPlainText(null), /must be a string/);
});

test("doctor accepts RSS.com single-paragraph markup for the canonical show description", () => {
  const canonical =
    "Dr. M Experienced, with Dr. David Musnick. Practical insights from decades in sports, regenerative, internal, and functional medicine.";
  const rssCom = `<p>${canonical}</p>`;

  assert.equal(
    normalizeDescriptionForComparison(rssCom),
    normalizeDescriptionForComparison(canonical)
  );
});

test("YouTube projection replaces forbidden angle brackets without losing comparison meaning", () => {
  assert.equal(
    youtubeDescriptionFromHtml("<p>Episodes &gt;15 minutes and values &lt; 2.</p>"),
    "Episodes greater than 15 minutes and values less than 2."
  );
  assert.doesNotMatch(youtubeDescriptionFromHtml("<p>2 &lt; 3 &gt; 1</p>"), /[<>]/);
});

test("every catalog HTML description projects without markup", async () => {
  const catalog = await loadCatalog();
  for (const episode of catalog.episodes) {
    const projected = htmlDescriptionToPlainText(episode.description.full);
    assert.ok(projected.length > 0, `episode ${episode.number} projected to empty copy`);
    assert.doesNotMatch(projected, /<\/?[A-Za-z][^>]*>/, `episode ${episode.number} retained markup`);
    assert.equal(projected, htmlDescriptionToPlainText(episode.description.full));
  }
});

test("checked-in site brand projection exactly matches the master catalog", async () => {
  const catalog = await loadCatalog();
  const generated = await fs.readFile(DEFAULT_SITE_BRAND_PATH, "utf8");
  assert.equal(generated, renderSiteBrandProjection(catalog));
  assert.deepEqual(JSON.parse(generated), buildSiteBrandProjection(catalog));
  assert.equal(JSON.parse(generated).podcastFeedUrl, catalog.show.canonicalPodcastFeed.url);
});

test("published podcast enclosures bind the website and Supabase seed projections", async () => {
  const catalog = await loadCatalog();
  const enrichment = JSON.parse(
    await fs.readFile(new URL("../../src/data/episodes-enrichment.json", import.meta.url), "utf8")
  );
  const seed = await fs.readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
  const insertStart = seed.indexOf("insert into public.episodes (");
  const insertEnd = seed.indexOf("on conflict (slug) do update set", insertStart);
  assert.ok(insertStart >= 0 && insertEnd > insertStart, "could not isolate the episode seed projection");
  const episodeSeed = seed.slice(insertStart, insertEnd);

  const catalogProjection = catalog.episodes
    .filter((episode) => episode.publicationState === "published")
    .map((episode) => {
      const audio = catalog.assetRegistry[episode.assetRefs.podcastAudio];
      assert.equal(audio?.kind, "audio", `${episode.slug} podcastAudio must reference an audio asset`);
      assert.equal(audio?.role, "podcastAudio", `${episode.slug} podcastAudio role drifted`);
      return [episode.slug, episode.destinations.vimeo?.id, audio?.publishedUrl];
    });
  assert.deepEqual(catalogProjection, expectedPodcastAudio);

  assert.deepEqual(
    expectedPodcastAudio.map(([slug, vimeoId]) => [slug, vimeoId, enrichment[vimeoId]?.audioUrl]),
    expectedPodcastAudio
  );

  for (const [index, [slug, , audioUrl]] of expectedPodcastAudio.entries()) {
    const rowStart = episodeSeed.indexOf(`    '${slug}',`);
    const nextSlug = expectedPodcastAudio[index + 1]?.[0];
    const rowEnd = nextSlug ? episodeSeed.indexOf(`    '${nextSlug}',`, rowStart + 1) : episodeSeed.length;
    assert.ok(rowStart >= 0 && rowEnd > rowStart, `${slug} is missing from the episode seed projection`);
    assert.ok(
      episodeSeed.slice(rowStart, rowEnd).includes(`    '${audioUrl}',`),
      `${slug} seed audio_url does not match the master catalog`
    );
  }

  assert.equal((episodeSeed.match(/https:\/\/content\.rss\.com\/episodes\//g) ?? []).length, 7);
  assert.doesNotMatch(episodeSeed, /https:\/\/anchor\.fm\/s\/10e1b0328\/podcast\/play\//);
});

test("checked-in episode summaries project exactly from the master catalog", async () => {
  const catalog = await loadCatalog();
  const projection = JSON.parse(
    await fs.readFile(new URL("../../src/data/episodes-from-platforms.json", import.meta.url), "utf8")
  );

  for (const episode of catalog.episodes) {
    const projected = projection.find((item) => item.number === episode.number);
    assert.ok(projected, `episode ${episode.number} is missing from the checked-in site projection`);
    assert.equal(projected.summary, episode.websiteSummary, `episode ${episode.number} summary drifted`);
  }
});

test("semantic validation rejects duplicate immutable episode identities", async () => {
  const catalog = await loadCatalog();
  const cases = [
    ["number", "Duplicate episode number"],
    ["slug", "Duplicate episode slug"],
    ["rssGuid", "Duplicate RSS GUID"],
  ];
  for (const [property, expected] of cases) {
    const changed = structuredClone(catalog);
    changed.episodes[1][property] = changed.episodes[0][property];
    const result = validateCatalog(changed);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.includes(expected)), result.errors.join("\n"));
  }

  const duplicateDestination = structuredClone(catalog);
  duplicateDestination.episodes[1].destinations.spotify = structuredClone(
    duplicateDestination.episodes[0].destinations.spotify
  );
  const result = validateCatalog(duplicateDestination);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("Duplicate destination ID spotify:")), result.errors.join("\n"));
});

test("semantic validation rejects duplicate visible episode descriptions", async () => {
  const catalog = await loadCatalog();
  assert.notEqual(
    normalizeDescriptionForComparison(catalog.episodes[5].description.full),
    normalizeDescriptionForComparison(catalog.episodes[6].description.full),
    "Episodes 6 and 7 regressed to the same visible description"
  );
  const changed = structuredClone(catalog);
  changed.episodes[1].description.full = `<section>\n${changed.episodes[0].description.full}\n</section>`;

  const result = validateCatalog(changed);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes("Duplicate normalized episode description")),
    result.errors.join("\n")
  );
});

test("published episodes require a hosted podcast enclosure", async () => {
  const catalog = await loadCatalog();
  const changed = structuredClone(catalog);
  const assetId = changed.episodes[0].assetRefs.podcastAudio;
  delete changed.assetRegistry[assetId].publishedUrl;

  const result = validateCatalog(changed);
  assert.equal(result.valid, false);
  assert.ok(
    result.errors.some((error) => error.includes("must reference a hosted asset with publishedUrl")),
    result.errors.join("\n")
  );
});

test("catalog scales beyond the initial seven episodes with contiguous identities", async () => {
  const catalog = await loadCatalog();
  const expanded = structuredClone(catalog);
  const episode = structuredClone(expanded.episodes.at(-1));
  episode.number = 8;
  episode.slug = "future-episode";
  episode.rssGuid = "00000000-0000-4000-8000-000000000008";
  episode.title = "A Future Episode - Ready for Distribution";
  episode.description.full = "<p>A unique approved description for the future distributed episode.</p>";
  episode.websiteSummary = "A unique website summary for the future distributed episode.";
  episode.aliases = { titles: [], slugs: [] };
  episode.destinationArchives = [];
  episode.destinations = {
    spotify: { id: "AAAAAAAAAAAAAAAAAAAAA8", url: "https://open.spotify.com/episode/AAAAAAAAAAAAAAAAAAAAA8" },
    youtube: { id: "ep000000008", url: "https://www.youtube.com/watch?v=ep000000008" },
    vimeo: { id: "9999999998", url: "https://vimeo.com/9999999998" },
    rumble: { id: "vfuture8", url: "https://rumble.com/vfuture8-a-future-episode.html" },
  };
  expanded.episodes.push(episode);

  assert.deepEqual(validateCatalog(expanded), { valid: true, errors: [] });
  assert.equal(findEpisode(expanded, 8)?.slug, "future-episode");
});

test("catalog supports draft episodes before hosts assign remote identities", async () => {
  const catalog = await loadCatalog();
  const expanded = structuredClone(catalog);
  const episode = structuredClone(expanded.episodes.at(-1));
  episode.publicationState = "draft";
  episode.number = 8;
  episode.slug = "future-draft";
  episode.rssGuid = null;
  episode.title = "A Future Draft - Approved Before Distribution";
  episode.description.full = "<p>A unique approved description for the future draft episode.</p>";
  episode.websiteSummary = "A unique website summary for the future draft episode.";
  episode.durationMinutes = null;
  episode.publishDate = null;
  episode.feedPublishedAt = null;
  episode.aliases = { titles: [], slugs: [] };
  episode.destinationArchives = [];
  episode.destinations = { spotify: null, youtube: null, vimeo: null, rumble: null };
  expanded.episodes.push(episode);

  assert.deepEqual(validateCatalog(expanded), { valid: true, errors: [] });
  assert.equal(findEpisode(expanded, 8)?.slug, "future-draft");
  assert.equal(findEpisode(expanded, { platform: "spotify", id: "not-created" }), null);
  assert.throws(
    () => findEpisode(expanded, { platform: "spotify" }),
    /selector id must be a non-empty string/
  );

  const invalidPublished = structuredClone(expanded);
  invalidPublished.episodes.at(-1).publicationState = "published";
  const result = validateCatalog(invalidPublished);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes("rssGuid")), result.errors.join("\n"));
  assert.ok(result.errors.some((error) => error.includes("durationMinutes")), result.errors.join("\n"));
});

function parsedFeedFromCatalog(catalog) {
  return {
    episodes: catalog.episodes
      .filter((episode) => episode.publicationState === "published")
      .map((episode) => ({
        guid: episode.rssGuid,
        title: episode.title,
        description: episode.description.full,
        episodeNumber: String(episode.number),
        seasonNumber: null,
      }))
      .reverse(),
  };
}

test("published catalog feed comparison passes exact metadata in reverse episode-number order", async () => {
  const catalog = await loadCatalog();
  const result = comparePublishedCatalogFeed(catalog, parsedFeedFromCatalog(catalog));

  assert.deepEqual(result, {
    ok: true,
    expectedEpisodeCount: 7,
    actualEpisodeCount: 7,
    episodeCountMatches: true,
    guidSetMatches: true,
    uniqueGuids: true,
    titleMatches: true,
    structuredNumbersMatch: true,
    descriptionsMatch: true,
    noSeasonMetadata: true,
    feedOrderMatches: true,
    noLegacyTitlePrefixes: true,
    expectedStructuredEpisodeNumbers: [1, 2, 3, 4, 5, 6, 7],
    actualStructuredEpisodeNumbers: [1, 2, 3, 4, 5, 6, 7],
    expectedFeedOrder: [7, 6, 5, 4, 3, 2, 1],
    actualFeedOrder: [7, 6, 5, 4, 3, 2, 1],
    missingGuids: [],
    extraGuids: [],
    duplicateGuids: [],
    missingGuidIndexes: [],
    titleMismatches: [],
    episodeNumberMismatches: [],
    descriptionMismatches: [],
    seasonMetadataEpisodes: [],
    legacyTitleEpisodes: [],
  });
});

test("published catalog feed comparison derives its expectations dynamically and ignores drafts", async () => {
  const catalog = await loadCatalog();
  const expanded = structuredClone(catalog);
  const draft = structuredClone(expanded.episodes.at(-1));
  draft.publicationState = "draft";
  draft.number = 8;
  draft.rssGuid = null;
  draft.title = "Future Draft - Not Yet in the Feed";
  expanded.episodes.push(draft);

  assert.equal(comparePublishedCatalogFeed(expanded, parsedFeedFromCatalog(expanded)).ok, true);

  const published = structuredClone(draft);
  published.publicationState = "published";
  published.rssGuid = "00000000-0000-4000-8000-000000000008";
  expanded.episodes[expanded.episodes.length - 1] = published;
  const result = comparePublishedCatalogFeed(expanded, parsedFeedFromCatalog(expanded));

  assert.equal(result.ok, true);
  assert.equal(result.expectedEpisodeCount, 8);
  assert.deepEqual(result.expectedStructuredEpisodeNumbers, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("published catalog feed comparison rejects count, GUID, and GUID uniqueness drift independently", async () => {
  const catalog = await loadCatalog();
  const feed = parsedFeedFromCatalog(catalog);
  feed.episodes.push(structuredClone(feed.episodes[0]));

  const duplicate = comparePublishedCatalogFeed(catalog, feed);
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.episodeCountMatches, false);
  assert.equal(duplicate.guidSetMatches, true);
  assert.equal(duplicate.uniqueGuids, false);
  assert.deepEqual(duplicate.duplicateGuids, [{ guid: feed.episodes[0].guid, count: 2 }]);

  const changedGuidFeed = parsedFeedFromCatalog(catalog);
  const removedGuid = changedGuidFeed.episodes[0].guid;
  changedGuidFeed.episodes[0].guid = "00000000-0000-4000-8000-000000000099";
  const changedGuid = comparePublishedCatalogFeed(catalog, changedGuidFeed);
  assert.equal(changedGuid.episodeCountMatches, true);
  assert.equal(changedGuid.guidSetMatches, false);
  assert.equal(changedGuid.uniqueGuids, true);
  assert.deepEqual(changedGuid.missingGuids, [removedGuid]);
  assert.deepEqual(changedGuid.extraGuids, ["00000000-0000-4000-8000-000000000099"]);

  const missingGuidFeed = parsedFeedFromCatalog(catalog);
  missingGuidFeed.episodes[0].guid = null;
  const missingGuid = comparePublishedCatalogFeed(catalog, missingGuidFeed);
  assert.equal(missingGuid.uniqueGuids, false);
  assert.deepEqual(missingGuid.missingGuidIndexes, [0]);
});

test("published catalog feed comparison binds exact titles and structured numbers to GUIDs", async () => {
  const catalog = await loadCatalog();
  const changed = parsedFeedFromCatalog(catalog);
  [changed.episodes[0].title, changed.episodes[1].title] = [
    changed.episodes[1].title,
    changed.episodes[0].title,
  ];
  [changed.episodes[0].episodeNumber, changed.episodes[1].episodeNumber] = [
    changed.episodes[1].episodeNumber,
    changed.episodes[0].episodeNumber,
  ];

  const result = comparePublishedCatalogFeed(catalog, changed);
  assert.equal(result.episodeCountMatches, true);
  assert.equal(result.guidSetMatches, true);
  assert.equal(result.uniqueGuids, true);
  assert.equal(result.titleMatches, false);
  assert.equal(result.structuredNumbersMatch, false);
  assert.equal(result.titleMismatches.length, 2);
  assert.equal(result.episodeNumberMismatches.length, 2);
  assert.deepEqual(result.actualStructuredEpisodeNumbers, [1, 2, 3, 4, 5, 6, 7]);
});

test("published catalog feed comparison rejects missing structured numbers and legacy title prefixes", async () => {
  const catalog = await loadCatalog();
  const changed = parsedFeedFromCatalog(catalog);
  changed.episodes[0].episodeNumber = null;
  changed.episodes[1].title = `Episode ${changed.episodes[1].episodeNumber}: ${changed.episodes[1].title}`;

  const result = comparePublishedCatalogFeed(catalog, changed);
  assert.equal(result.ok, false);
  assert.equal(result.structuredNumbersMatch, false);
  assert.equal(result.noLegacyTitlePrefixes, false);
  assert.equal(result.episodeNumberMismatches.length, 1);
  assert.deepEqual(result.legacyTitleEpisodes, [
    {
      index: 1,
      guid: changed.episodes[1].guid,
      title: changed.episodes[1].title,
    },
  ]);
});

test("published catalog feed comparison normalizes HTML/plain descriptions and rejects visible drift", async () => {
  const catalog = await loadCatalog();
  const equivalent = parsedFeedFromCatalog(catalog);
  for (const episode of equivalent.episodes) {
    episode.description = normalizeDescriptionForComparison(episode.description);
  }

  assert.equal(comparePublishedCatalogFeed(catalog, equivalent).descriptionsMatch, true);

  equivalent.episodes[0].description += " Changed.";
  const drifted = comparePublishedCatalogFeed(catalog, equivalent);
  assert.equal(drifted.ok, false);
  assert.equal(drifted.descriptionsMatch, false);
  assert.deepEqual(drifted.descriptionMismatches, [
    {
      guid: equivalent.episodes[0].guid,
      title: equivalent.episodes[0].title,
      actualCount: 1,
    },
  ]);
});

test("published catalog feed comparison rejects season metadata and noncanonical feed order", async () => {
  const catalog = await loadCatalog();
  const seasonDrift = parsedFeedFromCatalog(catalog);
  seasonDrift.episodes[0].seasonNumber = "1";
  const seasonResult = comparePublishedCatalogFeed(catalog, seasonDrift);
  assert.equal(seasonResult.ok, false);
  assert.equal(seasonResult.noSeasonMetadata, false);
  assert.deepEqual(seasonResult.seasonMetadataEpisodes, [
    {
      index: 0,
      guid: seasonDrift.episodes[0].guid,
      title: seasonDrift.episodes[0].title,
      seasonNumber: "1",
    },
  ]);

  const orderDrift = parsedFeedFromCatalog(catalog);
  [orderDrift.episodes[0], orderDrift.episodes[1]] = [
    orderDrift.episodes[1],
    orderDrift.episodes[0],
  ];
  const orderResult = comparePublishedCatalogFeed(catalog, orderDrift);
  assert.equal(orderResult.ok, false);
  assert.equal(orderResult.feedOrderMatches, false);
  assert.deepEqual(orderResult.expectedFeedOrder, [7, 6, 5, 4, 3, 2, 1]);
  assert.deepEqual(orderResult.actualFeedOrder, [6, 7, 5, 4, 3, 2, 1]);
});

test("published catalog feed comparison validates its collection inputs", () => {
  assert.throws(
    () => comparePublishedCatalogFeed({}, { episodes: [] }),
    /catalog must contain an episodes array/i
  );
  assert.throws(
    () => comparePublishedCatalogFeed({ episodes: [] }, {}),
    /feed must contain an episodes array/i
  );
});

test("manifest binding accepts exact master copy and reports catalog-owned drift", async () => {
  const catalog = await loadCatalog();
  const episode = findEpisode(catalog, 1);
  const manifest = {
    episodeNumber: episode.number,
    slug: episode.slug,
    title: episode.title,
    description: episode.description.full,
    explicit: episode.contentFlags.explicit,
    madeForKids: true,
    containsSyntheticMedia: false,
    paidPromotion: false,
  };

  assert.deepEqual(manifestCatalogProblems(manifest, episode), []);
  assert.equal(episodeHash(episode), episodeHash(structuredClone(episode)));

  const changed = {
    ...manifest,
    slug: "different-slug",
    description: "Different copy",
    explicit: true,
    madeForKids: false,
  };
  const problems = manifestCatalogProblems(changed, episode);
  assert.equal(problems.length, 3, problems.join("\n"));
  assert.ok(problems.some((problem) => problem.startsWith("slug ")));
  assert.ok(problems.some((problem) => problem.startsWith("description ")));
  assert.ok(problems.some((problem) => problem.startsWith("explicit ")));
  assert.notEqual(episodeHash(episode), episodeHash({ ...episode, title: "Changed" }));

  const knownOptionalFlag = structuredClone(episode);
  knownOptionalFlag.contentFlags.madeForKids = false;
  const optionalFlagProblems = manifestCatalogProblems(manifest, knownOptionalFlag);
  assert.ok(optionalFlagProblems.some((problem) => problem.startsWith("madeForKids ")));
});

test("catalog asset binding enforces registered roles and verified fingerprints", async () => {
  const catalog = await loadCatalog();
  const episode = findEpisode(catalog, 1);
  const assetId = episode.assetRefs.fullVideo;
  const inspected = {
    fullVideo: { sha256: "a".repeat(64), sizeBytes: 1234 },
    podcastAudio: null,
  };

  const pendingCatalog = structuredClone(catalog);
  pendingCatalog.assetRegistry[assetId] = {
    ...pendingCatalog.assetRegistry[assetId],
    status: "unmounted",
    sha256: null,
    sizeBytes: null,
  };
  const pending = catalogAssetBindingProblems(
    pendingCatalog,
    findEpisode(pendingCatalog, 1),
    inspected
  );
  assert.deepEqual(pending.errors, []);
  assert.ok(pending.warnings.some((warning) => warning.includes(assetId)));

  const verifiedCatalog = structuredClone(pendingCatalog);
  verifiedCatalog.assetRegistry[assetId] = {
    ...verifiedCatalog.assetRegistry[assetId],
    status: "verified",
    sha256: inspected.fullVideo.sha256,
    sizeBytes: inspected.fullVideo.sizeBytes,
  };
  assert.deepEqual(
    catalogAssetBindingProblems(verifiedCatalog, findEpisode(verifiedCatalog, 1), inspected),
    { errors: [], warnings: [] }
  );

  const changed = structuredClone(inspected);
  changed.fullVideo.sha256 = "b".repeat(64);
  changed.fullVideo.sizeBytes += 1;
  const mismatched = catalogAssetBindingProblems(
    verifiedCatalog,
    findEpisode(verifiedCatalog, 1),
    changed
  );
  assert.equal(mismatched.errors.length, 2);

  const unregisteredRole = catalogAssetBindingProblems(catalog, episode, {
    instagramReel: inspected.fullVideo,
  });
  assert.ok(unregisteredRole.errors.some((error) => error.includes("no asset reference")));
});

test("all stable destination identities are explicit and support lookup", async () => {
  const catalog = await loadCatalog();
  for (const [number, spotify, youtube, vimeo, rumble] of expectedIdentities) {
    const episode = findEpisode(catalog, number);
    assert.ok(episode);
    assert.deepEqual(
      [
        episode.destinations.spotify.id,
        episode.destinations.youtube.id,
        episode.destinations.vimeo.id,
        episode.destinations.rumble.id,
      ],
      [spotify, youtube, vimeo, rumble]
    );
    for (const [platform, id] of Object.entries({ spotify, youtube, vimeo, rumble })) {
      assert.equal(findEpisode(catalog, { platform, id })?.number, number);
      assert.equal(findEpisode(catalog, id)?.number, number);
    }
    assert.equal(findEpisode(catalog, episode.slug)?.number, number);
    assert.equal(findEpisode(catalog, episode.rssGuid)?.number, number);
  }
});

test("YouTube cutover projects normalized public IDs and retains the prior uploads as rollback archives", async () => {
  const catalog = await loadCatalog();
  const platformProjection = JSON.parse(
    await fs.readFile(new URL("../../src/data/episodes-from-platforms.json", import.meta.url), "utf8")
  );
  const enrichment = JSON.parse(
    await fs.readFile(new URL("../../src/data/episodes-enrichment.json", import.meta.url), "utf8")
  );
  const seed = await fs.readFile(new URL("../../supabase/seed.sql", import.meta.url), "utf8");
  const audit = JSON.parse(
    await fs.readFile(new URL("../../publishing/audio-replacement-audit.json", import.meta.url), "utf8")
  );
  const titleReceipt = JSON.parse(
    await fs.readFile(new URL("../../publishing/episode-title-migration.json", import.meta.url), "utf8")
  );
  const thumbnailReceipt = JSON.parse(
    await fs.readFile(new URL("../../publishing/episode-thumbnail-rollout.json", import.meta.url), "utf8")
  );
  const platforms = JSON.parse(
    await fs.readFile(new URL("../../publishing/platforms.json", import.meta.url), "utf8")
  );
  const migration = await fs.readFile(
    new URL("../../supabase/migrations/20260807074632_publish_normalized_youtube_destinations.sql", import.meta.url),
    "utf8"
  );

  for (const [number, , currentYouTubeId, vimeoId] of expectedIdentities) {
    const episode = findEpisode(catalog, number);
    const [, archivedYouTubeId] = expectedArchivedYouTubeIdentities.find(([candidate]) => candidate === number);
    const archives = episode.destinationArchives.filter((archive) => archive.platform === "youtube");

    assert.deepEqual(archives, [{
      platform: "youtube",
      id: archivedYouTubeId,
      url: `https://www.youtube.com/watch?v=${archivedYouTubeId}`,
      status: "unlisted",
      archivedAt: "2026-08-07T07:46:32Z",
      reason: "normalized_video_cutover",
      supersededById: currentYouTubeId,
      rollbackEligible: true,
    }]);
    assert.equal(findEpisode(catalog, { platform: "youtube", id: archivedYouTubeId }), null);
    assert.equal(platformProjection.find((item) => item.number === number)?.youtubeId, currentYouTubeId);
    assert.ok(
      enrichment[vimeoId].references.some(
        (reference) => reference.label === "Watch on YouTube" &&
          reference.url === `https://www.youtube.com/watch?v=${currentYouTubeId}`
      ),
      `episode ${number} enrichment did not project the current YouTube URL`
    );
    assert.match(seed, new RegExp(`['"]${currentYouTubeId}['"]`));
    assert.doesNotMatch(seed, new RegExp(archivedYouTubeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));

    const auditTarget = audit.episodes
      .find((item) => item.number === number)
      .remoteReplacementTargets.find((target) => target.platform === "youtube");
    assert.equal(auditTarget.status, "verified_public_cutover");
    assert.equal(auditTarget.existingId, currentYouTubeId);
    assert.deepEqual(
      [auditTarget.cutover.currentId, auditTarget.cutover.priorId],
      [currentYouTubeId, archivedYouTubeId]
    );
    assert.equal(auditTarget.cutover.priorVisibility, "unlisted");
    assert.equal(auditTarget.cutover.deletePerformed, false);
    assert.equal(auditTarget.cutover.rollbackEligible, true);

    const titleEpisode = titleReceipt.episodes.find((item) => item.episodeNumber === number);
    const thumbnailEpisode = thumbnailReceipt.episodes.find((item) => item.episodeNumber === number);
    assert.deepEqual(
      [titleEpisode.remoteIds.youtube, titleEpisode.archivedRemoteIds.youtube],
      [currentYouTubeId, archivedYouTubeId]
    );
    assert.deepEqual(
      [thumbnailEpisode.remoteIds.youtube, thumbnailEpisode.archivedRemoteIds.youtube],
      [currentYouTubeId, archivedYouTubeId]
    );
    assert.match(migration, new RegExp(currentYouTubeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(migration, new RegExp(archivedYouTubeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.equal(platforms.platforms.youtube.currentPublicVideoCount, 7);
  assert.equal(platforms.platforms.youtube.priorVideoCount, 7);
  assert.equal(platforms.platforms.youtube.priorVideosDeleted, false);
  assert.equal(thumbnailReceipt.catalog.revision, 10);
  assert.ok(thumbnailReceipt.catalog.revision < catalog.revision);
  assert.match(thumbnailReceipt.catalog.publisherHash, /^[a-f0-9]{64}$/);
  assert.match(thumbnailReceipt.catalog.fileSha256, /^[a-f0-9]{64}$/);
});

test("catalog validation rejects a YouTube archive that is active or points at the wrong successor", async () => {
  const catalog = await loadCatalog();

  const activeArchive = structuredClone(catalog);
  activeArchive.episodes[0].destinationArchives[0].id = activeArchive.episodes[0].destinations.youtube.id;
  activeArchive.episodes[0].destinationArchives[0].url = activeArchive.episodes[0].destinations.youtube.url;
  const activeResult = validateCatalog(activeArchive);
  assert.equal(activeResult.valid, false);
  assert.ok(activeResult.errors.some((error) => error.includes("is still active")), activeResult.errors.join("\n"));

  const wrongSuccessor = structuredClone(catalog);
  wrongSuccessor.episodes[0].destinationArchives[0].supersededById = wrongSuccessor.episodes[1].destinations.youtube.id;
  const successorResult = validateCatalog(wrongSuccessor);
  assert.equal(successorResult.valid, false);
  assert.ok(
    successorResult.errors.some((error) => error.includes("must match the active youtube destination")),
    successorResult.errors.join("\n")
  );
});

test("content-correction YouTube archives are non-rollback private or pending-unlisted records", async () => {
  const catalog = await loadCatalog();
  const changed = structuredClone(catalog);
  const episode = changed.episodes.find((candidate) => candidate.number === 5);
  const contaminatedCurrent = episode.destinations.youtube;
  const correctedId = "Ep5Fix2026A";
  const correctedUrl = `https://www.youtube.com/watch?v=${correctedId}`;

  episode.destinations.youtube = { id: correctedId, url: correctedUrl };
  episode.destinationArchives = [
    ...episode.destinationArchives.map((archive) => ({
      ...archive,
      status: "private",
      reason: "content_correction",
      supersededById: correctedId,
      rollbackEligible: false,
    })),
    {
      platform: "youtube",
      id: contaminatedCurrent.id,
      url: contaminatedCurrent.url,
      status: "unlisted",
      archivedAt: "2026-08-22T19:00:00Z",
      reason: "content_correction",
      supersededById: correctedId,
      rollbackEligible: false,
    },
  ];

  assert.deepEqual(validateCatalog(changed), { valid: true, errors: [] });

  const invalidRollback = structuredClone(changed);
  invalidRollback.episodes[4].destinationArchives.at(-1).rollbackEligible = true;
  const invalidRollbackResult = validateCatalog(invalidRollback);
  assert.equal(invalidRollbackResult.valid, false);
  assert.ok(
    invalidRollbackResult.errors.some(
      (error) => error.includes("rollbackEligible") && error.includes("equal to constant"),
    ),
    invalidRollbackResult.errors.join("\n"),
  );

  const invalidNormalizedArchive = structuredClone(catalog);
  invalidNormalizedArchive.episodes[0].destinationArchives[0].status = "private";
  const invalidNormalizedResult = validateCatalog(invalidNormalizedArchive);
  assert.equal(invalidNormalizedResult.valid, false);
  assert.ok(
    invalidNormalizedResult.errors.some(
      (error) => error.includes("status") && error.includes("equal to constant"),
    ),
    invalidNormalizedResult.errors.join("\n"),
  );
});

test("checked-in catalog projection migrations are transaction-wrapped and contain no patch artifacts", async () => {
  for (const relativePath of [
    "../../supabase/migrations/20260807061500_publish_normalized_rss_audio.sql",
    "../../supabase/migrations/20260807074632_publish_normalized_youtube_destinations.sql",
  ]) {
    const sql = await fs.readFile(new URL(relativePath, import.meta.url), "utf8");
    assert.doesNotMatch(sql, /^\+/m, `${relativePath} contains a literal patch-marker prefix`);
    assert.doesNotMatch(sql, /^(?:<{7}|={7}|>{7})/m, `${relativePath} contains a merge-conflict marker`);
    assert.match(sql, /^begin;$/m, `${relativePath} is not transaction-wrapped`);
    assert.match(sql, /^commit;$/m, `${relativePath} is not transaction-wrapped`);
  }
});

test("source resolver accepts project-relative Dropbox references", async (context) => {
  const { temporary, root, configPath } = await temporarySources();
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "brand"));
  await fs.writeFile(path.join(root, "brand", "cover.jpg"), "cover");

  assert.equal(
    await resolveSourceRef("dropbox:brand/cover.jpg", { configPath }),
    path.join(root, "brand", "cover.jpg")
  );
  assert.equal(
    await resolveSourceRef("dropbox:episodes/008/new-master.mp4", { configPath }),
    path.join(root, "episodes", "008", "new-master.mp4")
  );

  const catalog = await loadCatalog();
  assert.equal(
    await resolveCatalogAsset(catalog, "show-podcast-cover", { configPath }),
    path.join(root, "brand", "masters", "podcast-cover-3000x3000.jpg")
  );
});

test("source resolver rejects absolute paths and traversal", async (context) => {
  const { temporary, configPath } = await temporarySources();
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));

  for (const ref of [
    "/etc/passwd",
    "C:\\Windows\\system.ini",
    "dropbox:/etc/passwd",
    "dropbox:../outside",
    "dropbox:episodes/../outside",
    "dropbox:episodes\\outside",
  ]) {
    await assert.rejects(resolveSourceRef(ref, { configPath }), /Absolute asset|portable and relative|unsafe path segment/);
  }
});

test("source resolver rejects a symlink escape from the configured project root", async (context) => {
  const { temporary, root, configPath } = await temporarySources();
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const outside = path.join(temporary, "outside");
  await fs.mkdir(outside);
  await fs.symlink(outside, path.join(root, "escaped"));

  await assert.rejects(
    resolveSourceRef("dropbox:escaped/future-file.mp4", { configPath }),
    /escapes configured source root through a symlink/
  );
});
