import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildAppleFeedOverlay,
  fetchAppleFeedSource,
  generateAppleFeedOverlay,
  loadAppleFeedOverlayConfig,
  validateAppleFeedOverlayConfig,
  verifyAppleFeedEnclosures,
} from "./apple-feed-overlay.mjs";

const config = await loadAppleFeedOverlayConfig();
const repairAuthority = JSON.parse(
  await fs.readFile(
    new URL("../../publishing/apple-guid-repair.json", import.meta.url),
    "utf8",
  ),
);

const baselineEpisodes = [
  {
    number: 7,
    title: "The Brain on Fire - Neuroinflammation After Concussion",
    link: "https://rss.com/podcasts/dr-m-experienced/3050760",
    guid: "4a0b3903-b7d1-4ced-967b-079df4004a4e",
  },
  {
    number: 6,
    title: "Concussion - What Happens in the Brain",
    link: "https://rss.com/podcasts/dr-m-experienced/3050761",
    guid: "13a0565e-582c-4969-a57d-9700b7babbe4",
  },
  {
    number: 5,
    title: "Energy - Understanding Fatigue and Mitochondrial Health",
    link: "https://rss.com/podcasts/dr-m-experienced/3050762",
    guid: "e9f7596f-0333-49ca-8946-bc11e96b2091",
  },
  {
    number: 4,
    title: "Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure",
    link: "https://rss.com/podcasts/dr-m-experienced/3050763",
    guid: "9579ff89-9e16-40db-b84a-00cee25c604a",
  },
  {
    number: 3,
    title: "Insomnia - Causes and Practical Sleep Strategies",
    link: "https://rss.com/podcasts/dr-m-experienced/3050764",
    guid: "e4bde82f-54e6-43a2-a50a-4044f9cdbe8e",
  },
  {
    number: 2,
    title: "Brain Fog, Part 2 - Testing and Basic Solutions",
    link: "https://rss.com/podcasts/dr-m-experienced/3050765",
    guid: "1e40e02b-b217-477c-9cc3-4271cb304c23",
  },
  {
    number: 1,
    title: "Brain Fog, Part 1 - Is Your Brain in a Fog?",
    link: "https://rss.com/podcasts/dr-m-experienced/3050766",
    guid: "c9b853b6-a828-4012-9998-217919ff9163",
  },
];

function episodeLength(number) {
  return 10_000 + number;
}

function feedXml({ episodes = baselineEpisodes, selfUrl = config.sourceSelfUrl } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title><![CDATA[Dr. M Experienced, with Dr. David Musnick]]></title>
    <link>https://drmexperienced.com/</link>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>
    <atom:link rel="hub" href="https://pubsubhubbub.appspot.com/"/>
    <description><![CDATA[Exact show description & source metadata.]]></description>
    <itunes:image href="https://media.example.test/show.jpg"/>
    ${episodes
      .map(
        (episode) => `<item>
      <title><![CDATA[${episode.title}]]></title>
      <description><![CDATA[Episode ${episode.number} description & metadata.]]></description>
      <link>${episode.link}</link>
      <enclosure url="https://content.example.test/episode-${episode.number}.mp3" length="${episodeLength(episode.number)}" type="audio/mpeg"/>
      <guid isPermaLink="false">${episode.guid}</guid>
      <itunes:duration>${600 + episode.number}</itunes:duration>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:episode>${episode.number}</itunes:episode>
      <pubDate>Tue, ${String(episode.number).padStart(2, "0")} Jan 2026 08:00:00 GMT</pubDate>
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>`;
}

function restoreApprovedChanges(xml) {
  let restored = xml.replace(config.publicFeedUrl, config.sourceSelfUrl);
  for (const mapping of config.guidMappings) {
    restored = restored.replace(mapping.appleGuid, mapping.sourceGuid);
  }
  return restored;
}

function successfulRangeResponse(totalBytes) {
  return new Response(new Uint8Array([0]), {
    status: 206,
    headers: {
      "content-length": "1",
      "content-range": `bytes 0-0/${totalBytes}`,
      "content-type": "audio/mpeg",
    },
  });
}

test("overlay config pins the Apple show, destination, and exact crosswalk", () => {
  assert.deepEqual(validateAppleFeedOverlayConfig(config), {
    valid: true,
    errors: [],
  });
  assert.equal(config.appleShowId, "1870433419");
  assert.equal(config.appleContentProviderId, "128469457");
  assert.equal(
    config.publicFeedUrl,
    "https://drmexperienced.com/apple-podcasts/feed.xml",
  );
  assert.deepEqual(
    config.guidMappings.map(({ sourceGuid, appleGuid }) => [sourceGuid, appleGuid]),
    [
      [
        "c9b853b6-a828-4012-9998-217919ff9163",
        "59063e08-e4a6-4e56-b7ec-d2a66d69beb8",
      ],
      [
        "1e40e02b-b217-477c-9cc3-4271cb304c23",
        "26896da2-76cf-4865-93f8-f94ddfb24568",
      ],
    ],
  );

  const changed = structuredClone(config);
  changed.publicFeedUrl = "https://example.test/feed.xml";
  const result = validateAppleFeedOverlayConfig(changed);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /publicFeedUrl/.test(error)));

  const changedEpisodeId = structuredClone(config);
  changedEpisodeId.guidMappings[0].rssComEpisodeId = "9999999";
  const changedEpisodeIdResult = validateAppleFeedOverlayConfig(changedEpisodeId);
  assert.equal(changedEpisodeIdResult.valid, false);
  assert.ok(
    changedEpisodeIdResult.errors.some((error) =>
      /guidMappings\.0\.rssComEpisodeId/.test(error),
    ),
  );
});

test("overlay identities remain bound to the Apple repair authority record", () => {
  assert.equal(config.sourceFeedUrl, repairAuthority.feedUrl);
  assert.equal(config.sourceSelfUrl, repairAuthority.feedUrl);
  assert.equal(config.appleShowId, repairAuthority.appleShowId);
  assert.equal(config.guidMappings.length, repairAuthority.episodes.length);

  for (const mapping of config.guidMappings) {
    const authority = repairAuthority.episodes.find(
      (episode) => episode.episodeNumber === mapping.episodeNumber,
    );
    assert.ok(authority, `missing authority for Episode ${mapping.episodeNumber}`);
    assert.equal(mapping.title, authority.title);
    assert.equal(mapping.rssComEpisodeId, authority.rssComEpisodeId);
    assert.equal(
      mapping.link,
      `https://rss.com/podcasts/dr-m-experienced/${authority.rssComEpisodeId}`,
    );
    assert.equal(mapping.sourceGuid, authority.currentFeedGuid);
    assert.equal(mapping.appleGuid, authority.appleHistoricalGuid);
  }

  assert.equal(
    repairAuthority.status,
    "apple_only_overlay_approved_pending_deployment",
  );
  assert.equal(repairAuthority.gates.exactRemoteChangeApproved, true);
  assert.equal(repairAuthority.gates.remoteWritePerformed, false);
  assert.equal(
    repairAuthority.repairMechanism.configPath,
    "publishing/apple-feed-overlay.json",
  );
  assert.equal(config.publicFeedUrl, repairAuthority.repairMechanism.publicFeedUrl);
});

test("overlay changes only the self URL and two Apple-authoritative GUIDs", () => {
  const source = feedXml();
  const result = buildAppleFeedOverlay(source, config);

  assert.equal(result.report.episodeCount, 7);
  assert.equal(result.report.futureEpisodeCount, 0);
  assert.equal(result.report.selfUrl, config.publicFeedUrl);
  assert.equal(result.report.byteIdenticalExceptApprovedChanges, true);
  assert.equal(result.report.itunesNewFeedUrlPresent, false);
  assert.equal(restoreApprovedChanges(result.xml), source);
  assert.equal(result.xml.includes(config.sourceSelfUrl), false);
  assert.equal(result.xml.includes(config.publicFeedUrl), true);
  assert.equal(result.xml.includes("<itunes:new-feed-url"), false);

  for (const mapping of config.guidMappings) {
    assert.equal(result.xml.includes(mapping.sourceGuid), false);
    assert.equal(result.xml.includes(mapping.appleGuid), true);
  }
  for (const assertion of config.preservedGuidAssertions) {
    assert.equal(result.xml.includes(assertion.guid), true);
  }
  for (const episode of baselineEpisodes) {
    assert.equal(
      result.xml.includes(
        `<enclosure url="https://content.example.test/episode-${episode.number}.mp3" length="${episodeLength(episode.number)}" type="audio/mpeg"/>`,
      ),
      true,
    );
  }
});

test("future RSS.com episodes pass through without configuration changes", () => {
  const future = {
    number: 8,
    title: "Future Episode",
    link: "https://rss.com/podcasts/dr-m-experienced/4000000",
    guid: "b22cc5a4-cd95-4ae9-9541-4257ddc78f01",
  };
  const source = feedXml({ episodes: [future, ...baselineEpisodes] });
  const result = buildAppleFeedOverlay(source, config);

  assert.equal(result.report.episodeCount, 8);
  assert.equal(result.report.futureEpisodeCount, 1);
  assert.equal(result.xml.includes(future.guid), true);
  assert.equal(restoreApprovedChanges(result.xml), source);
});

test("target identity drift fails closed before any overlay is produced", async (t) => {
  const cases = [
    {
      label: "title",
      episodes: baselineEpisodes.map((episode) =>
        episode.number === 1 ? { ...episode, title: "Wrong title" } : episode,
      ),
      pattern: /Episode 1 title mismatch/,
    },
    {
      label: "RSS.com link ID",
      episodes: baselineEpisodes.map((episode) =>
        episode.number === 2
          ? {
              ...episode,
              link: "https://rss.com/podcasts/dr-m-experienced/9999999",
            }
          : episode,
      ),
      pattern: /Episode 2 RSS\.com episode ID mismatch/,
    },
    {
      label: "source GUID",
      episodes: baselineEpisodes.map((episode) =>
        episode.number === 1
          ? { ...episode, guid: "5d05c94c-f45d-4994-b72c-4a2169739ba2" }
          : episode,
      ),
      pattern: /Episode 1 source GUID must identify exactly one source item/,
    },
  ];

  for (const fixture of cases) {
    await t.test(fixture.label, () => {
      assert.throws(
        () => buildAppleFeedOverlay(feedXml({ episodes: fixture.episodes }), config),
        fixture.pattern,
      );
    });
  }
});

test("Episodes 3-7 GUID drift and duplicate feed identities fail closed", () => {
  const drifted = baselineEpisodes.map((episode) =>
    episode.number === 5
      ? { ...episode, guid: "a116667f-0523-47fd-9a25-4451ea2bf6cc" }
      : episode,
  );
  assert.throws(
    () => buildAppleFeedOverlay(feedXml({ episodes: drifted }), config),
    /Episode 5 must retain GUID/,
  );

  const duplicated = baselineEpisodes.map((episode) =>
    episode.number === 4
      ? { ...episode, guid: baselineEpisodes[0].guid }
      : episode,
  );
  assert.throws(
    () => buildAppleFeedOverlay(feedXml({ episodes: duplicated }), config),
    /duplicate GUIDs/,
  );
});

test("historical GUID collisions, self-link drift, and migration tags fail closed", () => {
  const historicalCollision = feedXml().replace(
    "Exact show description",
    `Exact show description ${config.guidMappings[0].appleGuid}`,
  );
  assert.throws(
    () => buildAppleFeedOverlay(historicalCollision, config),
    /Apple GUID already occurs in the source feed/,
  );

  assert.throws(
    () =>
      buildAppleFeedOverlay(
        feedXml({ selfUrl: "https://example.test/wrong.xml" }),
        config,
      ),
    /exactly one atom:link rel=self/,
  );

  const migrationTag = feedXml().replace(
    "<description>",
    `<itunes:new-feed-url>${config.publicFeedUrl}</itunes:new-feed-url><description>`,
  );
  assert.throws(
    () => buildAppleFeedOverlay(migrationTag, config),
    /must not contain a new-feed-url element/,
  );

  const alternatePrefixMigrationTag = feedXml().replace(
    "<description>",
    `<x:new-feed-url xmlns:x="http://www.itunes.com/dtds/podcast-1.0.dtd">${config.publicFeedUrl}</x:new-feed-url><description>`,
  );
  assert.throws(
    () => buildAppleFeedOverlay(alternatePrefixMigrationTag, config),
    /must not contain a new-feed-url element/,
  );

  for (const prefix of ["é", "α", "a·b"]) {
    const unicodePrefixMigrationTag = feedXml().replace(
      "<description>",
      `<${prefix}:new-feed-url xmlns:${prefix}="http://www.itunes.com/dtds/podcast-1.0.dtd">${config.publicFeedUrl}</${prefix}:new-feed-url><description>`,
    );
    assert.throws(
      () => buildAppleFeedOverlay(unicodePrefixMigrationTag, config),
      /must not contain a new-feed-url element/,
      `Unicode namespace prefix ${prefix} must fail closed`,
    );
  }
});

test("source fetch is uncached, XML-only, and size bounded", async () => {
  let request = null;
  const source = feedXml();
  const fetched = await fetchAppleFeedSource(config.sourceFeedUrl, {
    cacheBust: "run-123",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return new Response(source, {
        status: 200,
        headers: { "content-type": "application/xml" },
      });
    },
  });
  assert.equal(fetched.xml, source);
  assert.match(request.url, /apple_overlay_build=run-123/);
  assert.equal(request.options.headers["Cache-Control"], "no-cache");

  await assert.rejects(
    fetchAppleFeedSource(config.sourceFeedUrl, {
      fetchImpl: async () =>
        new Response("not xml", {
          status: 200,
          headers: { "content-type": "text/html" },
        }),
    }),
    /returned text\/html/,
  );
});

test("all enclosure URLs must remain playable with matching byte ranges", async () => {
  const overlay = buildAppleFeedOverlay(feedXml(), config);
  const results = await verifyAppleFeedEnclosures(overlay.episodes, {
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.Range, "bytes=0-0");
      const match = /episode-(\d+)\.mp3$/.exec(String(url));
      return successfulRangeResponse(episodeLength(Number(match[1])));
    },
  });
  assert.equal(results.length, 7);
  assert.equal(results.every((result) => result.status === 206), true);

  await assert.rejects(
    verifyAppleFeedEnclosures(overlay.episodes, {
      fetchImpl: async () => new Response("full response", { status: 200 }),
      maxAttempts: 1,
    }),
    /range request returned HTTP 200/,
  );
  await assert.rejects(
    verifyAppleFeedEnclosures(overlay.episodes, {
      fetchImpl: async () => successfulRangeResponse(999),
      maxAttempts: 1,
    }),
    /byte-range total does not match/,
  );
});

test("enclosure probes use bounded retries for transient failures", async () => {
  const overlay = buildAppleFeedOverlay(feedXml(), config);
  let attempts = 0;
  const delays = [];
  const [result] = await verifyAppleFeedEnclosures([overlay.episodes[0]], {
    fetchImpl: async () => {
      attempts += 1;
      if (attempts < 3) return new Response("temporary", { status: 503 });
      return successfulRangeResponse(episodeLength(7));
    },
    maxAttempts: 3,
    retryDelayMs: 10,
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
  });

  assert.equal(attempts, 3);
  assert.equal(result.attempts, 3);
  assert.deepEqual(delays, [10, 20]);

  let permanentAttempts = 0;
  await assert.rejects(
    verifyAppleFeedEnclosures([overlay.episodes[0]], {
      fetchImpl: async () => {
        permanentAttempts += 1;
        return new Response("temporary", { status: 503 });
      },
      maxAttempts: 2,
      retryDelayMs: 0,
    }),
    /Failed after 2 attempts/,
  );
  assert.equal(permanentAttempts, 2);
});

test("end-to-end generation writes the validated artifact atomically", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-feed-"));
  const outputPath = path.join(temporary, "apple-podcasts", "feed.xml");
  const source = feedXml();
  try {
    const report = await generateAppleFeedOverlay({
      outputPath,
      cacheBust: "end-to-end",
      fetchImpl: async (url) => {
        if (String(url).startsWith(config.sourceFeedUrl)) {
          return new Response(source, {
            status: 200,
            headers: {
              "content-type": "application/xml",
              etag: '"source-etag"',
              "last-modified": "Mon, 24 Aug 2026 18:00:00 GMT",
            },
          });
        }
        const match = /episode-(\d+)\.mp3$/.exec(String(url));
        return successfulRangeResponse(episodeLength(Number(match[1])));
      },
    });
    const written = await fs.readFile(outputPath, "utf8");
    assert.equal(restoreApprovedChanges(written), source);
    assert.equal(report.episodeCount, 7);
    assert.equal(report.playableByteRangeEnclosureCount, 7);
    assert.equal(report.sourceEtag, '"source-etag"');
    assert.equal(report.outputPath.endsWith("apple-podcasts/feed.xml"), true);
    const directoryEntries = await fs.readdir(path.dirname(outputPath));
    assert.deepEqual(directoryEntries, ["feed.xml"]);
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});
