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
  fetchPodcastFeed,
  parsePodcastFeed,
  renderPreflightReport,
  runPreflight,
  saveRawFeedSnapshots,
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
