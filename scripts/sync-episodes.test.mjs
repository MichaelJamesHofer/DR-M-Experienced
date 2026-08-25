import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { loadEpisodeRegistry } from "./episode-identity.mjs";
import {
  fetchVimeo,
  loadPublishedCatalogSeeds,
  mergeAndSort,
  syncEpisodes,
} from "./sync-episodes.mjs";
import { buildEpisodeList } from "./sync-vimeo-episodes.mjs";

const registry = loadEpisodeRegistry();

const expectedPublishedEpisodes = [
  [1, "brain-fog-part-1", "Brain Fog, Part 1 - Is Your Brain in a Fog?"],
  [2, "brain-fog-part-2", "Brain Fog, Part 2 - Testing and Basic Solutions"],
  [3, "episode-3-insomnia", "Insomnia - Causes and Practical Sleep Strategies"],
  [4, "episode-4-emf", "Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure"],
  [5, "episode-5-energy", "Energy - Understanding Fatigue and Mitochondrial Health"],
  [6, "episode-6-concussion-and-pathophysiology", "Concussion - What Happens in the Brain"],
  [7, "episode-7-the-brain-on-fire", "The Brain on Fire - Neuroinflammation After Concussion"],
];

const expectedRegistryEpisodes = [
  ...expectedPublishedEpisodes,
  [8, "episode-8-food-and-the-brain", "Food and the Brain - Eating for Brain Health and Concussion Recovery"],
];

test("episode registry preserves published identities and reserves draft Episode 8", () => {
  assert.deepEqual(
    registry.entries.map(({ number, slug, title }) => [number, slug, title]),
    expectedRegistryEpisodes,
  );

  for (const episode of registry.entries.filter(({ number }) => number <= 7)) {
    assert.ok(episode.guid, `episode ${episode.number} is missing its RSS GUID`);
    assert.ok(episode.vimeoId, `episode ${episode.number} is missing its Vimeo ID`);
    assert.ok(episode.spotifyId, `episode ${episode.number} is missing its Spotify ID`);
    assert.ok(episode.youtubeId, `episode ${episode.number} is missing its YouTube ID`);
  }

  const draft = registry.entries.find(({ number }) => number === 8);
  assert.deepEqual(
    [draft.guid, draft.vimeoId, draft.spotifyId, draft.youtubeId],
    [null, null, null, null],
  );
  assert.equal(registry.maxNumber, 8);
});

test("multi-platform sync deduplicates punctuation variants and orders same-date episodes by identity", () => {
  const vimeo = [
    { vimeoId: "1205004739", title: "Episode 7... The Brain on Fire", publishDate: "2026-06-26" },
    { vimeoId: "1179956166", title: "Electro.Magnetic.Frequencies", publishDate: "2026-04-03" },
    { vimeoId: "1204939692", title: "Concussion & Pathophysiology", publishDate: "2026-06-26" },
    { vimeoId: "1204939658", title: "ENERGY!", publishDate: "2026-06-26" },
  ];
  const spotify = [
    { spotifyId: "6fQAClcR4AAuueHjBNlrJC", title: "Energy - fatigue & mitochondrial health", publishDate: "2026-06-26" },
    { spotifyId: "5QJlHSE6JhP3ymSCNzbWxv", title: "The Brain on Fire: Neuroinflammation After Concussion", publishDate: "2026-06-26" },
    { spotifyId: "0aDVuIwrRlDKxEylMj2dyw", title: "Electromagnetic Frequencies (EMF)", publishDate: "2026-04-03" },
    { spotifyId: "7MbKWgPZN40KEyN5j123JC", title: "Concussion - What Happens in the Brain", publishDate: "2026-06-26" },
  ];
  const youtube = [
    { youtubeId: "8u1Ps_mCpO4", title: "Episode 6: Concussion -- What Happens in the Brain", publishDate: "2026-06-26" },
    { youtubeId: "binbLcb3f_s", title: "Episode 4: Electro / Magnetic / Frequencies", publishDate: "2026-04-03" },
    { youtubeId: "5UOEvs59hBA", title: "Episode 7:  The Brain on Fire", publishDate: "2026-06-26" },
    { youtubeId: "N_F0hhHkIQ4", title: "Episode 5 - Energy", publishDate: "2026-06-26" },
  ];

  const episodes = mergeAndSort(vimeo, spotify, youtube, registry);

  assert.equal(episodes.length, 4);
  assert.deepEqual(episodes.map(({ number }) => number), [4, 5, 6, 7]);
  assert.deepEqual(
    episodes.map(({ number, slug, title }) => [number, slug, title]),
    expectedPublishedEpisodes.slice(3),
  );
  assert.equal(episodes[0].vimeoId, "1179956166");
  assert.equal(episodes[0].spotifyId, "0aDVuIwrRlDKxEylMj2dyw");
  assert.equal(episodes[0].spotifyUrl, "https://open.spotify.com/episode/0aDVuIwrRlDKxEylMj2dyw");
  assert.equal(episodes[0].youtubeId, "binbLcb3f_s");
});

test("stable IDs take precedence over a misleading title", () => {
  const episodes = mergeAndSort(
    [{ vimeoId: "1204939658", title: "Concussion - What Happens in the Brain", publishDate: "2026-06-26" }],
    [],
    [],
    registry,
  );

  assert.equal(episodes.length, 1);
  assert.deepEqual(
    [episodes[0].number, episodes[0].slug, episodes[0].title],
    expectedPublishedEpisodes[4],
  );
});

test("registered punctuation aliases work when an input has no stable ID", () => {
  const episodes = mergeAndSort(
    [{
      title: "Episode 4 - Electromagnetic Frequencies (EMF): Practical Ways to Reduce Exposure",
      publishDate: "2026-04-03",
    }],
    [],
    [],
    registry,
  );

  assert.deepEqual(
    episodes.map(({ number, slug, title }) => [number, slug, title]),
    [expectedPublishedEpisodes[3]],
  );
});

test("empty platform responses retain every published master-catalog episode", () => {
  const episodes = mergeAndSort(
    [],
    [],
    [],
    registry,
    loadPublishedCatalogSeeds(),
  );

  assert.deepEqual(
    episodes.map(({ number, slug, title }) => [number, slug, title]),
    expectedPublishedEpisodes,
  );
});

test("sync leaves the last known-good projection untouched when any API fails", async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "drm-sync-"));
  const outPath = path.join(directory, "episodes-from-platforms.json");
  const previous = '[{"number":1,"title":"last known good"}]\n';
  fs.writeFileSync(outPath, previous, "utf8");
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));

  await assert.rejects(
    syncEpisodes({
      registry,
      catalogSeeds: loadPublishedCatalogSeeds(),
      outPath,
      fetchVimeoEpisodes: async () => [{
        vimeoId: "1156414707",
        title: "Brain Fog, Part 1",
        publishDate: "2026-01-20",
      }],
      fetchSpotifyEpisodes: async () => {
        throw new Error("Spotify API error 503 Service Unavailable");
      },
      fetchYouTubeEpisodes: async () => [],
    }),
    /Spotify API error 503/,
  );

  assert.equal(fs.readFileSync(outPath, "utf8"), previous);
});

test("a later Vimeo page failure rejects instead of returning a partial result", async () => {
  let requests = 0;
  const firstPage = Array.from({ length: 100 }, (_, index) => ({
    uri: `/videos/${index + 1}`,
    name: `Video ${index + 1}`,
    created_time: "2026-01-01T00:00:00Z",
  }));

  await assert.rejects(
    fetchVimeo({
      token: "test-token",
      fetchImpl: async () => {
        requests += 1;
        if (requests === 1) {
          return {
            ok: true,
            json: async () => ({ data: firstPage, total: 101 }),
          };
        }
        return { ok: false, status: 503, statusText: "Service Unavailable" };
      },
    }),
    /Vimeo API error 503 Service Unavailable/,
  );

  assert.equal(requests, 2);
});

test("Vimeo sync ignores API order and reserves numbers one through eight", () => {
  const videos = [
    { uri: "/videos/9999999999", name: "A New Unnumbered Episode", created_time: "2026-07-10T12:00:00Z" },
    { uri: "/videos/1205004739", name: "The Brain on Fire", created_time: "2026-06-26T12:00:00Z" },
    { uri: "/videos/1204939658", name: "Energy", created_time: "2026-06-26T10:00:00Z" },
    { uri: "/videos/1204939692", name: "Concussion and Pathophysiology", created_time: "2026-06-26T11:00:00Z" },
    { uri: "/videos/1179956166", name: "Electro.Magnetic.Frequencies", created_time: "2026-04-03T10:00:00Z" },
  ];

  const episodes = buildEpisodeList(videos, registry);

  assert.deepEqual(episodes.map(({ number }) => number), [4, 5, 6, 7, 9]);
  assert.deepEqual(
    episodes.slice(0, 4).map(({ number, slug, title }) => [number, slug, title]),
    expectedPublishedEpisodes.slice(3),
  );
  assert.equal(episodes[4].slug, "a-new-unnumbered-episode");
  assert.equal(episodes[4].title, "A New Unnumbered Episode");
});
