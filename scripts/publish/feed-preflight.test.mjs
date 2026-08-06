import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  comparePodcastFeeds,
  compareSourceBaseline,
  compareTargetMetadata,
  fetchPodcastFeed,
  loadTargetMetadata,
  parsePodcastFeed,
  renderPreflightReport,
  runPreflight,
  saveRawFeedSnapshots,
  verifyCandidateArtwork,
  verifyCandidateEdgeAudio,
  verifyCandidateMedia,
} from "./feed-preflight.mjs";

function feedXml({
  title = "Test Show",
  description = null,
  language = null,
  author = null,
  explicit = null,
  podcastType = null,
  artwork = null,
  generator = "Test Host",
  ownerEmail = "owner@example.test",
  episodes = [],
} = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title><![CDATA[${title}]]></title>
    ${description == null ? "" : `<description><![CDATA[${description}]]></description>`}
    ${language == null ? "" : `<language>${language}</language>`}
    ${author == null ? "" : `<itunes:author>${author}</itunes:author>`}
    ${explicit == null ? "" : `<itunes:explicit>${explicit}</itunes:explicit>`}
    ${podcastType == null ? "" : `<itunes:type>${podcastType}</itunes:type>`}
    ${artwork == null ? "" : `<itunes:image href="${artwork}" />`}
    <generator>${generator}</generator>
    <itunes:owner><itunes:email>${ownerEmail}</itunes:email></itunes:owner>
    ${episodes
      .map(
        (episode) => `<item>
      <guid isPermaLink="false">${episode.guid ?? ""}</guid>
      <title><![CDATA[${episode.title ?? ""}]]></title>
      ${episode.description == null ? "" : `<description><![CDATA[${episode.description}]]></description>`}
      <pubDate>${episode.pubDate ?? ""}</pubDate>
      ${episode.duration == null ? "" : `<itunes:duration>${episode.duration}</itunes:duration>`}
      ${episode.explicit == null ? "" : `<itunes:explicit>${episode.explicit}</itunes:explicit>`}
      ${episode.episodeNumber == null ? "" : `<itunes:episode>${episode.episodeNumber}</itunes:episode>`}
      ${episode.seasonNumber == null ? "" : `<itunes:season>${episode.seasonNumber}</itunes:season>`}
      ${episode.episodeType == null ? "" : `<itunes:episodeType>${episode.episodeType}</itunes:episodeType>`}
      ${episode.artwork == null ? "" : `<itunes:image href="${episode.artwork}" />`}
      ${episode.enclosure === false ? "" : `<enclosure url="${episode.enclosure ?? "https://media.example.test/audio.mp3"}" type="audio/mpeg" />`}
    </item>`
      )
      .join("\n")}
  </channel>
</rss>`;
}

const sourceEpisodes = [
  {
    guid: "episode-one-guid",
    title: "Episode One",
    pubDate: "Tue, 04 Aug 2026 12:00:00 GMT",
    duration: "01:02",
    enclosure: "https://old.example.test/one.mp3?signature=source-secret&amp;expires=1",
  },
  {
    guid: "episode-two-guid",
    title: "Episode Two",
    pubDate: "Wed, 05 Aug 2026 12:00:00 GMT",
    duration: "1:01:01",
    enclosure: "https://old.example.test/two.mp3",
  },
];

const migrationCatalog = {
  episodes: [
    {
      publicationState: "published",
      number: 1,
      rssGuid: "episode-one-guid",
      title: "Canonical Episode One",
      description: { full: "<p>Canonical <strong>first</strong> description.</p>" },
    },
    {
      publicationState: "published",
      number: 2,
      rssGuid: "episode-two-guid",
      title: "Canonical Episode Two",
      description: { full: "<p>Canonical second description.</p>" },
    },
  ],
};

function catalogFeedEpisodes() {
  const sourceByGuid = new Map(sourceEpisodes.map((episode) => [episode.guid, episode]));
  return migrationCatalog.episodes
    .map((episode) => ({
      ...sourceByGuid.get(episode.rssGuid),
      guid: episode.rssGuid,
      title: episode.title,
      description: episode.description.full,
      episodeNumber: String(episode.number),
    }))
    .reverse();
}

async function runCatalogBoundPreflight(episodes, options = {}) {
  const xml = feedXml({ episodes });
  return runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl: async () => new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } }),
    catalog: migrationCatalog,
    requireCatalogBinding: true,
    ...options,
  });
}

test("structural comparison accepts equivalent dates and duration formats while preserving exact GUIDs", () => {
  const source = parsePodcastFeed(feedXml({ episodes: sourceEpisodes }));
  const candidate = parsePodcastFeed(
    feedXml({
      generator: "New Host",
      episodes: [
        {
          ...sourceEpisodes[0],
          pubDate: "Tue, 04 Aug 2026 06:00:00 -0600",
          duration: "62",
          enclosure: "https://new.example.test/one.mp3?token=candidate-secret&amp;x=1",
        },
        { ...sourceEpisodes[1], duration: "3661", enclosure: "https://new.example.test/two.mp3" },
      ],
    })
  );

  assert.equal(source.title, "Test Show");
  assert.equal(source.episodes[0].comparableDuration, 62);
  assert.equal(candidate.episodes[0].comparablePubDate, source.episodes[0].comparablePubDate);
  assert.equal(comparePodcastFeeds(source, candidate).ok, true);
});

test("description comparison ignores host-only HTML wrappers and entity serialization", () => {
  const source = parsePodcastFeed(
    feedXml({
      description: "A practical show & useful conversations.",
      episodes: [{ ...sourceEpisodes[0], description: "First point & second point." }],
    })
  );
  const candidate = parsePodcastFeed(
    feedXml({
      description: "<p>A practical show &amp; useful conversations.</p>",
      episodes: [
        {
          ...sourceEpisodes[0],
          description: "<p>First <strong>point</strong> &amp; second point.</p>",
        },
      ],
    })
  );

  assert.equal(comparePodcastFeeds(source, candidate).ok, true);
});

test("comparison fails on counts, duplicate or changed GUIDs, and per-GUID metadata changes", () => {
  const source = parsePodcastFeed(feedXml({ episodes: sourceEpisodes }));
  const candidate = parsePodcastFeed(
    feedXml({
      episodes: [
        { ...sourceEpisodes[0], title: "Changed title", duration: "99", enclosure: false },
        { ...sourceEpisodes[0] },
        { ...sourceEpisodes[1], guid: "unexpected-guid" },
      ],
    })
  );
  const result = comparePodcastFeeds(source, candidate);
  const codes = new Set(result.issues.map((issue) => issue.code));

  assert.equal(result.ok, false);
  assert.deepEqual(
    codes,
    new Set(["episode_count", "candidate_duplicate_guids", "candidate_missing_metadata", "guid_set", "episode_metadata"])
  );
  assert.equal(result.missingGuids.length, 1);
  assert.equal(result.extraGuids.length, 1);
  assert.deepEqual(result.metadataMismatches[0].fields.sort(), ["duration", "enclosure", "title"]);
});

test("empty feeds fail instead of passing vacuous migration checks", () => {
  const emptySource = parsePodcastFeed(feedXml());
  const populatedSource = parsePodcastFeed(feedXml({ episodes: sourceEpisodes }));
  const emptyCandidate = parsePodcastFeed(feedXml());

  const bothEmpty = comparePodcastFeeds(emptySource, emptyCandidate);
  assert.equal(bothEmpty.ok, false);
  assert.deepEqual(
    bothEmpty.issues.map((issue) => issue.code),
    ["source_empty", "candidate_empty"]
  );

  const missingImport = comparePodcastFeeds(populatedSource, emptyCandidate);
  assert.equal(missingImport.ok, false);
  assert.equal(missingImport.sharedGuidCount, 0);
  assert.equal(missingImport.issues.some((issue) => issue.code === "candidate_empty"), true);
});

test("comparison checks show metadata and extended per-episode podcast fields", () => {
  const show = {
    description: "Original show description",
    language: "en-US",
    author: "Dr. David Musnick",
    explicit: "no",
    podcastType: "episodic",
    artwork: "https://media.example.test/show.jpg",
  };
  const episode = {
    ...sourceEpisodes[0],
    description: "Original episode description",
    explicit: "no",
    episodeNumber: "1",
    seasonNumber: "2",
    episodeType: "full",
  };
  const source = parsePodcastFeed(feedXml({ ...show, episodes: [episode] }));
  const candidate = parsePodcastFeed(
    feedXml({
      ...show,
      description: "Changed show description",
      episodes: [
        {
          ...episode,
          description: "Changed episode description",
          explicit: "yes",
          episodeNumber: "9",
          seasonNumber: "3",
          episodeType: "bonus",
        },
      ],
    })
  );

  const result = comparePodcastFeeds(source, candidate);
  assert.equal(result.ok, false);
  assert.deepEqual(result.showMetadataMismatches, ["description"]);
  assert.deepEqual(result.metadataMismatches[0].fields, [
    "description",
    "explicit",
    "episodeNumber",
    "seasonNumber",
    "episodeType",
  ]);
});

test("comparison detects item-level episode artwork lost during migration", () => {
  const source = parsePodcastFeed(
    feedXml({
      episodes: [
        { ...sourceEpisodes[0], artwork: "https://images.example.test/source-one.jpg" },
        { ...sourceEpisodes[1], artwork: "https://images.example.test/source-two.jpg" },
      ],
    })
  );
  const candidate = parsePodcastFeed(
    feedXml({
      episodes: [
        { ...sourceEpisodes[0], artwork: "https://images.example.test/candidate-one.jpg" },
        sourceEpisodes[1],
      ],
    })
  );

  const result = comparePodcastFeeds(source, candidate);
  assert.equal(source.episodes[0].artworkPresent, true);
  assert.equal(candidate.episodes[0].artworkUrl, "https://images.example.test/candidate-one.jpg");
  assert.equal(result.ok, false);
  assert.deepEqual(result.metadataMismatches[0].fields, ["artwork"]);
});

test("canonical target metadata is independent from source parity and loads migration targetMetadata", async () => {
  const candidate = parsePodcastFeed(
    feedXml({
      title: "Dr. M Experienced, with Dr. David Musnick",
      description: "<p>Canonical practical description.</p>",
      episodes: sourceEpisodes,
    })
  );
  const matching = compareTargetMetadata(candidate, {
    title: "Dr. M Experienced, with Dr. David Musnick",
    description: "Canonical practical description.",
  });
  const stale = compareTargetMetadata(candidate, {
    title: "Retired show name",
    description: "Canonical practical description.",
  });
  assert.equal(matching.ok, true);
  assert.deepEqual(stale.mismatches, ["title"]);

  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-target-metadata-test-"));
  const filePath = path.join(temporary, "migration.json");
  try {
    await fs.writeFile(
      filePath,
      JSON.stringify({ targetMetadata: { title: candidate.title, description: "Canonical practical description." } })
    );
    assert.deepEqual(await loadTargetMetadata(filePath), {
      title: candidate.title,
      description: "Canonical practical description.",
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("recorded source baseline detects source-feed drift before candidate comparison", () => {
  const source = parsePodcastFeed(feedXml({ episodes: sourceEpisodes }));
  const matching = compareSourceBaseline(source, {
    expectedEpisodeCount: 2,
    expectedGuids: sourceEpisodes.map((episode) => episode.guid),
  });
  const drifted = compareSourceBaseline(source, {
    expectedEpisodeCount: 3,
    expectedGuids: [sourceEpisodes[0].guid, "missing-guid"],
  });

  assert.equal(matching.ok, true);
  assert.equal(drifted.ok, false);
  assert.equal(drifted.countMatches, false);
  assert.equal(drifted.guidSetMatches, false);
  assert.equal(drifted.missingGuids.length, 1);
  assert.equal(drifted.extraGuids.length, 1);
});

test("feed retrieval records redirect status without exposing URL credentials or query strings", async () => {
  const xml = feedXml({ episodes: sourceEpisodes });
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, options });
    if (requests.length === 1) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://feeds.example.test/final.xml?access_token=redirect-secret" },
      });
    }
    return new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } });
  };

  const fetched = await fetchPodcastFeed("https://user:password@feeds.example.test/start.xml?token=request-secret", {
    fetchImpl,
  });

  assert.equal(fetched.ok, true);
  assert.deepEqual(fetched.chain, [
    { status: 302, url: "https://feeds.example.test/start.xml" },
    { status: 200, url: "https://feeds.example.test/final.xml" },
  ]);
  assert.equal(fetched.requestUrl, "https://feeds.example.test/start.xml");
  assert.equal(requests.every((request) => request.options.redirect === "manual"), true);
});

test("candidate media verification requires audio metadata and a one-byte 206 response", async () => {
  const candidate = parsePodcastFeed(feedXml({ episodes: [sourceEpisodes[0]] }));
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    if (options.method === "HEAD") return new Response(null, { status: 405 });
    return new Response("x", {
      status: 206,
      headers: { "content-type": "audio/mpeg", "content-range": "bytes 0-0/100", "content-length": "1" },
    });
  };

  const result = await verifyCandidateMedia(candidate, { fetchImpl, concurrency: 1 });

  assert.equal(result.length, 1);
  assert.equal(result[0].ok, true);
  assert.deepEqual(result[0].checks, {
    audioContentType: true,
    positiveContentLength: true,
    oneByteRange206: true,
  });
  assert.equal(result[0].contentLength, 100);
  assert.deepEqual(
    requests.map((request) => request.method),
    ["HEAD", "GET"]
  );
  assert.equal(requests[1].headers.range, "bytes=0-0");
});

test("media verification fails when a host ignores the byte range or returns a non-audio type", async () => {
  const candidate = parsePodcastFeed(feedXml({ episodes: [sourceEpisodes[0]] }));
  const fetchImpl = async (_url, options) => {
    if (options.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-type": "text/html", "content-length": "100", "accept-ranges": "bytes" },
      });
    }
    return new Response("not audio", { status: 200, headers: { "content-type": "text/html", "content-length": "9" } });
  };

  const [result] = await verifyCandidateMedia(candidate, { fetchImpl, concurrency: 1 });

  assert.equal(result.ok, false);
  assert.equal(result.advertisedByteRanges, true);
  assert.deepEqual(result.checks, {
    audioContentType: false,
    positiveContentLength: true,
    oneByteRange206: false,
  });
});

test("candidate artwork verification requires reachable image URLs", async () => {
  const candidate = parsePodcastFeed(
    feedXml({
      episodes: [{ ...sourceEpisodes[0], artwork: "https://images.example.test/episode-one.jpg" }],
    })
  );
  const requests = [];
  const fetchImpl = async (_url, options) => {
    requests.push(options);
    if (options.method === "HEAD") {
      return new Response(null, {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "100" },
      });
    }
    return new Response("x", {
      status: 206,
      headers: { "content-type": "image/jpeg", "content-range": "bytes 0-0/100", "content-length": "1" },
    });
  };

  const [result] = await verifyCandidateArtwork(candidate, { fetchImpl, concurrency: 1 });

  assert.equal(result.ok, true);
  assert.deepEqual(result.checks, {
    imageContentType: true,
    positiveContentLength: true,
    reachableGet: true,
  });
  assert.deepEqual(
    requests.map((request) => request.method),
    ["HEAD", "GET"]
  );
});

test("artwork verification fails the preflight when item-level coverage is missing", async () => {
  const xml = feedXml({ episodes: sourceEpisodes });
  const result = await runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl: async () => new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } }),
    verifyArtwork: true,
  });

  assert.equal(result.ok, false);
  assert.match(result.report, /Candidate item-level artwork availability/);
  assert.match(result.report, /episode coverage: FAIL \(0\/2\)/);
});

test("edge audio verification fully downloads and decodes oldest and newest episodes, then removes temp media", async () => {
  const oldest = Buffer.alloc(8192, 1);
  const newest = Buffer.alloc(12288, 2);
  const middle = Buffer.alloc(1024, 3);
  const payloads = new Map([
    ["/oldest.mp3", oldest],
    ["/middle.mp3", middle],
    ["/newest.mp3", newest],
  ]);
  const server = http.createServer((request, response) => {
    const payload = payloads.get(request.url);
    if (!payload) {
      response.writeHead(404).end();
      return;
    }
    response.writeHead(200, { "content-type": "audio/mpeg", "content-length": String(payload.length) });
    for (let offset = 0; offset < payload.length; offset += 777) response.write(payload.subarray(offset, offset + 777));
    response.end();
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), "drm-edge-audio-test-"));
  const decodedPaths = [];
  const decodedPayloads = [];

  try {
    const candidate = parsePodcastFeed(
      feedXml({
        episodes: [
          { ...sourceEpisodes[1], enclosure: `http://127.0.0.1:${port}/newest.mp3` },
          {
            guid: "middle-guid",
            title: "Middle",
            pubDate: "Tue, 04 Aug 2026 18:00:00 GMT",
            enclosure: `http://127.0.0.1:${port}/middle.mp3`,
          },
          { ...sourceEpisodes[0], enclosure: `http://127.0.0.1:${port}/oldest.mp3` },
        ],
      })
    );
    const result = await verifyCandidateEdgeAudio(candidate, {
      allowPrivateNetwork: true,
      temporaryRoot,
      edgeDecodeTimeoutMs: 5000,
      decodeImpl: async (filePath) => {
        decodedPaths.push(filePath);
        decodedPayloads.push(await fs.readFile(filePath));
        assert.equal((await fs.stat(filePath)).mode & 0o777, 0o600);
        return { ok: true };
      },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(
      result.results.map((item) => [item.role, item.downloadedBytes]),
      [
        ["oldest", oldest.length],
        ["newest", newest.length],
      ]
    );
    assert.deepEqual(decodedPayloads, [oldest, newest]);
    for (const filePath of decodedPaths) await assert.rejects(fs.access(filePath), { code: "ENOENT" });
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});

test("feed and media requests reject obvious local, private, and link-local targets before fetch", async () => {
  const attempted = [];
  const fetchImpl = async (url) => {
    attempted.push(url);
    throw new Error("must not run");
  };

  for (const url of [
    "http://localhost/feed.xml",
    "http://127.0.0.1/feed.xml",
    "http://10.0.0.5/feed.xml",
    "http://169.254.169.254/feed.xml",
    "http://[::1]/feed.xml",
    "http://service.local/feed.xml",
  ]) {
    const result = await fetchPodcastFeed(url, { fetchImpl });
    assert.equal(result.ok, false);
    assert.equal(result.error, "blocked_network_target");
  }
  assert.deepEqual(attempted, []);
});

test("runPreflight returns a failed gate for structurally mismatched feeds", async () => {
  const sourceXml = feedXml({ episodes: sourceEpisodes });
  const candidateXml = feedXml({ episodes: [sourceEpisodes[0]] });
  const fetchImpl = async (url) =>
    new Response(url.includes("source.xml") ? sourceXml : candidateXml, {
      status: 200,
      headers: { "content-type": "application/rss+xml" },
    });

  const result = await runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl,
  });

  assert.equal(result.ok, false);
  assert.match(result.report, /RESULT: FAIL - do not cut over or redirect/);
});

test("runPreflight enforces canonical target metadata even when source and candidate match", async () => {
  const xml = feedXml({ title: "Imported but stale title", description: "Stale description", episodes: sourceEpisodes });
  const result = await runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl: async () => new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } }),
    expectedCandidate: {
      title: "Dr. M Experienced, with Dr. David Musnick",
      description: "Canonical description",
    },
  });

  assert.equal(result.ok, false);
  assert.match(result.report, /Canonical target metadata/);
  assert.match(result.report, /exact target values: FAIL/);
  assert.match(result.report, /mismatches: title, description/);
});

test("catalog gate rejects source and candidate that share the same noncanonical title", async () => {
  const episodes = catalogFeedEpisodes().map((episode) => ({
    ...episode,
    title: `Stale ${episode.title}`,
  }));
  const result = await runCatalogBoundPreflight(episodes);

  assert.equal(result.comparison.ok, true, "source/candidate parity should pass in this regression fixture");
  assert.equal(result.catalogBinding.source.titleMatches, false);
  assert.equal(result.catalogBinding.candidate.titleMatches, false);
  assert.equal(result.ok, false);
  assert.match(result.report, /Source feed catalog binding \(required\)/);
  assert.match(result.report, /Candidate feed catalog binding \(required\)/);
  assert.match(result.report, /canonical titles by GUID: FAIL/);
  assert.match(result.report, /catalog gate: FAIL/);
});

test("catalog gate rejects normalized visible description drift on both feeds", async () => {
  const episodes = catalogFeedEpisodes();
  episodes[0].description = "<div>Canonical second description changed.</div>";
  const result = await runCatalogBoundPreflight(episodes);

  assert.equal(result.comparison.ok, true, "matching bad descriptions must not be trusted as canonical");
  assert.equal(result.catalogBinding.source.descriptionsMatch, false);
  assert.equal(result.catalogBinding.candidate.descriptionsMatch, false);
  assert.equal(result.ok, false);
  assert.match(result.report, /canonical descriptions by GUID: FAIL/);
  assert.match(result.report, /description mismatch/);
});

test("catalog gate rejects season metadata even when both feeds share it", async () => {
  const episodes = catalogFeedEpisodes();
  episodes[0].seasonNumber = "1";
  const result = await runCatalogBoundPreflight(episodes);

  assert.equal(result.comparison.ok, true);
  assert.equal(result.catalogBinding.source.noSeasonMetadata, false);
  assert.equal(result.catalogBinding.candidate.noSeasonMetadata, false);
  assert.equal(result.ok, false);
  assert.match(result.report, /no season metadata: FAIL/);
  assert.match(result.report, /season metadata/);
});

test("catalog gate rejects feed order drift even when source and candidate share it", async () => {
  const episodes = catalogFeedEpisodes().reverse();
  const result = await runCatalogBoundPreflight(episodes);

  assert.equal(result.comparison.ok, true, "pairwise comparison intentionally binds by GUID, not item order");
  assert.equal(result.catalogBinding.source.feedOrderMatches, false);
  assert.equal(result.catalogBinding.candidate.feedOrderMatches, false);
  assert.deepEqual(result.catalogBinding.candidate.expectedFeedOrder, [2, 1]);
  assert.deepEqual(result.catalogBinding.candidate.actualFeedOrder, [1, 2]);
  assert.equal(result.ok, false);
  assert.match(result.report, /reverse episode-number order: FAIL \(1 > 2\)/);
  assert.match(result.report, /expected order: 2 > 1/);
});

test("post-redirect catalog gate still fetches and checks the candidate independently", async () => {
  const xml = feedXml({ episodes: catalogFeedEpisodes() });
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    if (url.endsWith("/source.xml")) {
      return new Response(null, {
        status: 301,
        headers: { location: "https://feeds.example.test/candidate.xml" },
      });
    }
    return new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } });
  };
  const result = await runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl,
    catalog: migrationCatalog,
    requireCatalogBinding: true,
  });

  assert.equal(result.ok, true);
  assert.equal(result.catalogBinding.phase, "post_redirect");
  assert.equal(result.catalogBinding.sourceRequired, false);
  assert.equal(result.catalogBinding.source.ok, true);
  assert.equal(result.catalogBinding.candidate.ok, true);
  assert.equal(
    requests.filter((url) => url.endsWith("/candidate.xml")).length,
    2,
    "candidate endpoint must be fetched once through the redirect and once directly"
  );
  assert.match(result.report, /source resolves to the candidate endpoint/);
  assert.match(result.report, /candidate was fetched and checked separately/);
  assert.match(result.report, /Candidate feed catalog binding \(required\)/);
});

test("a required catalog gate fails closed when no catalog is supplied", async () => {
  const xml = feedXml({ episodes: catalogFeedEpisodes() });
  const result = await runPreflight({
    source: "https://feeds.example.test/source.xml",
    candidate: "https://feeds.example.test/candidate.xml",
    timeoutMs: 5000,
    fetchImpl: async () => new Response(xml, { status: 200, headers: { "content-type": "application/rss+xml" } }),
    requireCatalogBinding: true,
  });

  assert.equal(result.comparison.ok, true);
  assert.equal(result.catalogBinding.ok, false);
  assert.equal(result.ok, false);
  assert.match(result.report, /validated master catalog was not supplied/);
});

test("raw snapshots require an out-of-repository directory and use private permissions", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-feed-snapshot-test-"));
  const root = path.join(temporary, "repo");
  const snapshots = path.join(temporary, "snapshots");
  const sourceXml = feedXml({ ownerEmail: "private-source@example.test", episodes: sourceEpisodes });
  const candidateXml = feedXml({ ownerEmail: "private-candidate@example.test", episodes: sourceEpisodes });
  await fs.mkdir(root);

  try {
    const paths = await saveRawFeedSnapshots({ sourceXml, candidateXml, directory: snapshots, root });
    assert.equal(await fs.readFile(paths.sourcePath, "utf8"), sourceXml);
    assert.equal(await fs.readFile(paths.candidatePath, "utf8"), candidateXml);
    assert.equal((await fs.stat(snapshots)).mode & 0o777, 0o700);
    assert.equal((await fs.stat(paths.sourcePath)).mode & 0o777, 0o600);
    assert.equal((await fs.stat(paths.candidatePath)).mode & 0o777, 0o600);

    await assert.rejects(
      saveRawFeedSnapshots({
        sourceXml,
        candidateXml,
        directory: path.join(root, "private-feeds"),
        root,
      }),
      /outside the project repository/i
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("the rendered report omits owner emails, URL credentials, queries, and enclosure URLs", () => {
  const source = parsePodcastFeed(
    feedXml({ ownerEmail: "source-owner@example.test", title: "Owner source-owner@example.test", episodes: sourceEpisodes })
  );
  const candidate = parsePodcastFeed(feedXml({ ownerEmail: "candidate-owner@example.test", episodes: sourceEpisodes }));
  const comparison = comparePodcastFeeds(source, candidate);
  const report = renderPreflightReport({
    sourceFetch: {
      ok: true,
      requestUrl: "https://feeds.example.test/source.xml",
      chain: [{ status: 200, url: "https://feeds.example.test/source.xml" }],
    },
    candidateFetch: {
      ok: true,
      requestUrl: "https://feeds.example.test/candidate.xml",
      chain: [{ status: 200, url: "https://feeds.example.test/candidate.xml" }],
    },
    sourceFeed: source,
    candidateFeed: candidate,
    comparison,
    media: null,
    snapshots: {
      sourcePath: "/tmp/source-owner@example.test/source.xml",
      candidatePath: "/tmp/candidate-owner@example.test/candidate.xml",
    },
  });

  assert.doesNotMatch(report, /source-owner@example\.test|candidate-owner@example\.test/);
  assert.doesNotMatch(report, /source-secret|candidate-secret|old\.example\.test|new\.example\.test/);
  assert.match(report, /\[redacted-email\]/);
});

test("the rendered report does not label empty candidate checks as passing", () => {
  const source = parsePodcastFeed(feedXml({ episodes: sourceEpisodes }));
  const candidate = parsePodcastFeed(feedXml());
  const comparison = comparePodcastFeeds(source, candidate);
  const report = renderPreflightReport({
    sourceFetch: {
      ok: true,
      requestUrl: "https://feeds.example.test/source.xml",
      chain: [{ status: 200, url: "https://feeds.example.test/source.xml" }],
    },
    candidateFetch: {
      ok: true,
      requestUrl: "https://feeds.example.test/candidate.xml",
      chain: [{ status: 200, url: "https://feeds.example.test/candidate.xml" }],
    },
    sourceFeed: source,
    candidateFeed: candidate,
    comparison,
    media: [],
  });

  assert.match(report, /candidate GUID uniqueness: NOT CHECKED/);
  assert.match(report, /per-GUID metadata: NOT CHECKED/);
  assert.match(report, /required candidate episode metadata: NOT CHECKED/);
  assert.match(report, /audio content-type: NOT CHECKED/);
  assert.match(report, /episode coverage: FAIL \(0\/0\)/);
  assert.match(report, /RESULT: FAIL - do not cut over or redirect/);
  assert.doesNotMatch(report, /PASS \(0\/0\)/);
});

test("CLI usage documents canonical metadata, artwork, and full edge decode gates", async () => {
  const cliPath = fileURLToPath(new URL("./feed-preflight.mjs", import.meta.url));
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cliPath, "--help"], { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /--target-metadata <json>/);
  assert.match(result.stdout, /--verify-artwork/);
  assert.match(result.stdout, /--decode-edge-audio/);
  assert.match(result.stdout, /private OS temp files/);
});

test("CLI exits nonzero when the candidate feed does not match", async () => {
  const sourceXml = feedXml({ ownerEmail: "cli-owner@example.test", episodes: sourceEpisodes });
  const candidateXml = feedXml({ episodes: [sourceEpisodes[0]] });
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "application/rss+xml" });
    response.end(request.url.startsWith("/source") ? sourceXml : candidateXml);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  const cliPath = fileURLToPath(new URL("./feed-preflight.mjs", import.meta.url));

  try {
    const result = await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          cliPath,
          "--source",
          `http://127.0.0.1:${address.port}/source.xml?token=source-secret`,
          "--candidate",
          `http://127.0.0.1:${address.port}/candidate.xml?token=candidate-secret`,
        ],
        { stdio: ["ignore", "pipe", "pipe"] }
      );
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8").on("data", (chunk) => (stdout += chunk));
      child.stderr.setEncoding("utf8").on("data", (chunk) => (stderr += chunk));
      child.on("error", reject);
      child.on("close", (status) => resolve({ status, stdout, stderr }));
    });

    assert.equal(result.status, 2, result.stderr);
    assert.match(result.stdout, /RESULT: FAIL - do not cut over or redirect/);
    assert.doesNotMatch(result.stdout, /cli-owner@example\.test|source-secret|candidate-secret/);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
});
