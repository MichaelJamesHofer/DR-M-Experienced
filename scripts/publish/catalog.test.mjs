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
  [1, "7cAdb8GE4khC9EYKAjmYuc", "LXASEw-WFq8", "1156414707", "v74kzcw"],
  [2, "19Pct0ClX3j1EOwJ3ySVd7", "s740_XVTaAY", "1159441883", "v74l0km"],
  [3, "07OHz4sfbefOORcNi9xaUK", "59r5XFynaDo", "1179740758", "v77zlls"],
  [4, "0aDVuIwrRlDKxEylMj2dyw", "X8WChChyh9c", "1179956166", "v780pxq"],
  [5, "6fQAClcR4AAuueHjBNlrJC", "JyBK6KtOo_k", "1204939658", "v7bvj32"],
  [6, "7MbKWgPZN40KEyN5j123JC", "odNrtPEuong", "1204939692", "v7bvk8i"],
  [7, "5QJlHSE6JhP3ymSCNzbWxv", "3IVDJqwT2yY", "1205004739", "v7bvtu4"],
];

const expectedPodcastAudio = [
  ["brain-fog-part-1", "1156414707", "https://content.rss.com/episodes/397420/3050766/dr-m-experienced/2026_08_06_08_58_14_5ecd30b1-aef2-4666-ad49-f8c0f210fea2.mp3"],
  ["brain-fog-part-2", "1159441883", "https://content.rss.com/episodes/397420/3050765/dr-m-experienced/2026_08_06_08_58_12_56d5c865-9d3e-4c15-943c-095c535ffe7b.mp3"],
  ["episode-3-insomnia", "1179740758", "https://content.rss.com/episodes/397420/3050764/dr-m-experienced/2026_08_06_08_58_10_29cdf885-f097-4016-91fa-79229beaffe2.mp3"],
  ["episode-4-emf", "1179956166", "https://content.rss.com/episodes/397420/3050763/dr-m-experienced/2026_08_06_08_58_08_299310cb-53c0-4de1-88ca-684a25901bc5.mp3"],
  ["episode-5-energy", "1204939658", "https://content.rss.com/episodes/397420/3050762/dr-m-experienced/2026_08_06_08_58_06_7cc0ba78-000a-4bfe-9360-e2526cf972ab.mp3"],
  ["episode-6-concussion-and-pathophysiology", "1204939692", "https://content.rss.com/episodes/397420/3050761/dr-m-experienced/2026_08_06_08_58_03_e31f1115-3f5b-4192-a929-58eada8d76e1.mp3"],
  ["episode-7-the-brain-on-fire", "1205004739", "https://content.rss.com/episodes/397420/3050760/dr-m-experienced/2026_08_06_08_58_01_2d87eb57-8e98-435a-a59b-509643963942.mp3"],
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
  assert.equal(catalog.revision, 5);
  assert.equal(catalog.episodes.length, 7);
  assert.match(catalogHash(catalog), /^[a-f0-9]{64}$/);
  assert.equal(catalogHash(catalog), catalogHash(structuredClone(catalog)));
  assert.ok(Object.values(catalog.assetRegistry).every((asset) => asset.uri.startsWith("dropbox:")));
  assert.ok(Object.values(catalog.assetRegistry).every((asset) => asset.sha256 === null && asset.sizeBytes === null));
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
  episode.aliases = { titles: [], slugs: [] };
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
  episode.durationMinutes = null;
  episode.publishDate = null;
  episode.feedPublishedAt = null;
  episode.aliases = { titles: [], slugs: [] };
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

  const pending = catalogAssetBindingProblems(catalog, episode, inspected);
  assert.deepEqual(pending.errors, []);
  assert.ok(pending.warnings.some((warning) => warning.includes(assetId)));

  const verifiedCatalog = structuredClone(catalog);
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
