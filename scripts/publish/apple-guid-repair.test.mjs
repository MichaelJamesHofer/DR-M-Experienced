import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const root = new URL("../../", import.meta.url);

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, root), "utf8"));
}

test("Apple GUID repair record is schema-valid and remains fail-closed", async () => {
  const [repair, schema] = await Promise.all([
    readJson("publishing/apple-guid-repair.json"),
    readJson("publishing/apple-guid-repair.schema.json"),
  ]);
  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);

  assert.equal(validate(repair), true, JSON.stringify(validate.errors));
  assert.equal(repair.status, "support_mismatch_confirmed_remote_change_blocked");
  assert.equal(repair.gates.appleTitleMappingIndependentlyVerified, true);
  assert.equal(repair.gates.remoteWritePerformed, false);
  assert.equal(repair.gates.exactRemoteChangeApproved, false);
  assert.equal(repair.gates.rssComInPlaceEditConfirmed, false);
  assert.equal(repair.gates.spotifyIdentityPreservationConfirmed, false);
});

test("pending Apple repair crosswalk matches current catalog identities", async () => {
  const [repair, catalog] = await Promise.all([
    readJson("publishing/apple-guid-repair.json"),
    readJson("publishing/master-catalog.json"),
  ]);
  const currentGuids = new Set();
  const historicalGuids = new Set();

  for (const entry of repair.episodes) {
    const episode = catalog.episodes.find((candidate) => candidate.number === entry.episodeNumber);
    assert.ok(episode, `missing catalog episode ${entry.episodeNumber}`);
    assert.equal(episode.slug, entry.slug);
    assert.equal(episode.title, entry.title);
    assert.equal(episode.rssGuid, entry.currentFeedGuid);
    assert.equal(episode.destinations.spotify.id, entry.spotifyEpisodeId);
    assert.notEqual(entry.currentFeedGuid, entry.appleHistoricalGuid);
    currentGuids.add(entry.currentFeedGuid);
    historicalGuids.add(entry.appleHistoricalGuid);
  }

  assert.equal(currentGuids.size, 2);
  assert.equal(historicalGuids.size, 2);
  assert.equal(
    catalog.episodes.some((episode) => historicalGuids.has(episode.rssGuid)),
    false,
    "blocked historical GUIDs must not become canonical before remote verification",
  );
});
