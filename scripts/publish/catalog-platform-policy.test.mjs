import assert from "node:assert/strict";
import test from "node:test";
import { requiredEpisodeReferencePlatforms } from "./catalog-platform-policy.mjs";

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
