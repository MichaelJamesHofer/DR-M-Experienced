import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  integrateRemoteAudioReceipt,
  MIGRATION_FILENAME,
  RemoteAudioReceiptIntegrationError,
  validateRemoteAudioReceiptData,
} from "./integrate-remote-audio-receipt.mjs";

const projectRoot = path.resolve(new URL("../..", import.meta.url).pathname);
const catalogTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing/master-catalog.json"), "utf8")
);
const auditTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "publishing/audio-replacement-audit.json"), "utf8")
);
const enrichmentTemplate = JSON.parse(
  await fs.readFile(path.join(projectRoot, "src/data/episodes-enrichment.json"), "utf8")
);
const seedTemplate = await fs.readFile(path.join(projectRoot, "supabase/seed.sql"), "utf8");

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function renderFeed(catalog, urls, durations, lastBuildDate) {
  const items = [...catalog.episodes]
    .sort((left, right) => right.number - left.number)
    .map(
      (episode) => `<item>
<guid>${episode.rssGuid}</guid>
<title>${xmlEscape(episode.title)}</title>
<description><![CDATA[${episode.description.full}]]></description>
<pubDate>${new Date(episode.feedPublishedAt).toUTCString()}</pubDate>
<itunes:duration>${durations.get(episode.number)}</itunes:duration>
<itunes:explicit>false</itunes:explicit>
<itunes:episode>${episode.number}</itunes:episode>
<itunes:episodeType>full</itunes:episodeType>
<itunes:image href="https://media.rss.com/dr-m-experienced/episode-${episode.number}.jpg" />
<enclosure url="${xmlEscape(urls.get(episode.number))}" type="audio/mpeg" />
</item>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel>
<title>${xmlEscape(catalog.show.names.full)}</title>
<description>${xmlEscape(catalog.show.profileCopy.short)}</description>
<language>en</language><itunes:author>David Musnick</itunes:author>
<itunes:explicit>false</itunes:explicit><itunes:type>episodic</itunes:type>
<itunes:image href="https://media.rss.com/dr-m-experienced/podcast_cover.jpg" />
<lastBuildDate>${lastBuildDate}</lastBuildDate>
${items}
</channel></rss>\n`;
}

async function writeJson(filePath, value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text);
  return sha256(text);
}

async function prepareFixture(context) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "drm-remote-audio-integration-"));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const catalog = structuredClone(catalogTemplate);
  catalog.revision = 8;
  const audit = structuredClone(auditTemplate);
  audit.status = "validated_local_delivery_pending_remote_replacement";
  delete audit.remoteReplacement;
  for (const episode of audit.episodes) {
    const target = episode.remoteReplacementTargets.find((entry) => entry.platform === "rssCom");
    target.status = "pending";
    delete target.verification;
  }
  const enrichment = structuredClone(enrichmentTemplate);
  const baselineUrls = new Map();
  const currentUrls = new Map();
  const baselineDurations = new Map();
  const currentDurations = new Map();
  for (const episode of catalog.episodes) {
    const audio = catalog.assetRegistry[episode.assetRefs.podcastAudio];
    baselineUrls.set(episode.number, audio.publishedUrl);
    currentUrls.set(
      episode.number,
      `https://content.rss.com/episodes/397420/${4000000 - episode.number}/dr-m-experienced/normalized-${episode.number}.mp3`
    );
    baselineDurations.set(episode.number, 1000 + episode.number);
    currentDurations.set(episode.number, 1000 + episode.number);
  }
  baselineDurations.set(5, 1862);
  currentDurations.set(5, 1861);
  baselineDurations.set(6, 1203);
  currentDurations.set(6, 1200);
  const baselineXml = renderFeed(
    catalog,
    baselineUrls,
    baselineDurations,
    "Thu, 06 Aug 2026 17:33:39 GMT"
  );
  const currentXml = renderFeed(
    catalog,
    currentUrls,
    currentDurations,
    "Fri, 07 Aug 2026 05:56:39 GMT"
  );
  const evidenceDirectory = path.join(root, "evidence");
  await fs.mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const baselinePath = path.join(root, "baseline.xml");
  const currentPath = path.join(evidenceDirectory, "current-feed.xml");
  await fs.writeFile(baselinePath, baselineXml);
  await fs.writeFile(currentPath, currentXml);
  const episodes = [];
  for (const episode of catalog.episodes) {
    const filePath = path.join(
      evidenceDirectory,
      `episode-${String(episode.number).padStart(2, "0")}-current.mp3`
    );
    const bytes = Buffer.from(`verified remote episode ${episode.number}\n`);
    await fs.writeFile(filePath, bytes, { mode: 0o600 });
    await fs.chmod(filePath, 0o600);
    const stats = await fs.stat(filePath);
    const duration = currentDurations.get(episode.number) + 0.2;
    episodes.push({
      episodeNumber: episode.number,
      guid: episode.rssGuid,
      title: episode.title,
      enclosure: {
        baselineUrl: baselineUrls.get(episode.number),
        currentUrl: currentUrls.get(episode.number),
        urlChanged: true,
        effectiveUrl: `https://rsscom.pdn.tritondigital.com/normalized-${episode.number}.mp3?redacted=test`,
        httpStatus: 200,
        contentType: "audio/mpeg",
      },
      localFile: {
        path: filePath,
        filename: path.basename(filePath),
        sha256: sha256(bytes),
        bytes: bytes.length,
        mode: "600",
        ownerUid: stats.uid,
        ownerGid: stats.gid,
        stableDuringAudit: true,
      },
      feedDurationSeconds: {
        baseline: baselineDurations.get(episode.number),
        current: currentDurations.get(episode.number),
      },
      probe: {
        format: "mp3",
        durationSeconds: duration,
        bitRate: 128000,
        audioStreams: [
          {
            type: "audio",
            codec: "mp3",
            width: null,
            height: null,
            frameRate: "0/0",
            sampleRate: 44100,
            channels: 2,
            durationSeconds: duration,
          },
        ],
        videoStreamCount: 0,
      },
      fullDecode: { passed: true, stderrBytes: 0 },
      loudness: {
        integratedLufs: -16.5,
        truePeakDbtp: -1.5,
        loudnessRangeLu: 5,
        thresholdLufs: -27,
        measuredWith: "ffmpeg loudnorm full-file analysis",
        acceptedIntegratedLufsRange: [-17, -15],
        maximumTruePeakDbtp: -1,
        passed: true,
      },
      passed: true,
    });
  }
  const receipt = {
    schemaVersion: 1,
    auditType: "rss_com_remote_audio_replacement_readback",
    status: "passed",
    startedAt: "2026-08-07T06:05:21.909Z",
    completedAt: "2026-08-07T06:07:40.834Z",
    canonicalFeedUrl: "https://media.rss.com/dr-m-experienced/feed.xml",
    baseline: { path: baselinePath, sha256: sha256(baselineXml), bytes: Buffer.byteLength(baselineXml) },
    currentFeed: { path: currentPath, sha256: sha256(currentXml), bytes: Buffer.byteLength(currentXml) },
    comparePodcastFeeds: {
      ok: false,
      issueCodes: ["episode_metadata"],
      metadataMismatches: [
        { fingerprint: "216c67d43fd7", title: catalog.episodes[5].title, fields: ["duration"] },
        { fingerprint: "55db6452b2f0", title: catalog.episodes[4].title, fields: ["duration"] },
      ],
      note: "Only the explicitly enumerated benign duration rounding differences are present.",
    },
    invariants: {
      baselineEpisodeCount: 7,
      currentEpisodeCount: 7,
      uniqueCurrentGuidCount: 7,
      guidSetExact: true,
      allSevenGuidsRetained: true,
      allSevenEnclosureUrlsChanged: true,
      showMetadataUnchanged: true,
      noMissingRequiredMetadata: true,
      noUnexpectedEpisodeMetadataDifferences: true,
      nonEnclosureDifferencesAllBenign: true,
    },
    nonEnclosureDifferences: [
      { scope: "channel", type: "lastBuildDate", baseline: "old", current: "new", benign: true },
      { scope: "episode", episodeNumber: 1, type: "html_entity_serialization", details: ["entity"], semanticContentUnchanged: true, benign: true },
      { scope: "episode", episodeNumber: 2, type: "html_entity_serialization", details: ["entity"], semanticContentUnchanged: true, benign: true },
      { scope: "episode", episodeNumber: 5, type: "itunes_duration_rounding", baselineSeconds: 1862, currentSeconds: 1861, deltaSeconds: -1, measuredDurationSeconds: 1861.2, benign: true },
      { scope: "episode", episodeNumber: 6, type: "itunes_duration_rounding", baselineSeconds: 1203, currentSeconds: 1200, deltaSeconds: -3, measuredDurationSeconds: 1200.2, benign: true },
    ],
    fetch: {
      cacheBusted: true,
      requestHeaders: ["Cache-Control: no-cache, no-store", "Pragma: no-cache"],
      snapshotPath: currentPath,
      responseHeadersPath: path.join(evidenceDirectory, "feed-headers.txt"),
    },
    acceptance: {
      integratedLufsMinimum: -17,
      integratedLufsMaximum: -15,
      truePeakDbtpMaximum: -1,
      fullDecodeRequired: true,
    },
    episodes,
    totals: {
      episodes: 7,
      downloadsPassed: 7,
      fullDecodesPassed: 7,
      loudnessGatesPassed: 7,
      overallPassed: true,
    },
  };
  const paths = {
    receipt: path.join(evidenceDirectory, "receipt.json"),
    catalog: path.join(root, "publishing/master-catalog.json"),
    audit: path.join(root, "publishing/audio-replacement-audit.json"),
    enrichment: path.join(root, "src/data/episodes-enrichment.json"),
    seed: path.join(root, "supabase/seed.sql"),
    migration: path.join(root, "supabase/migrations", MIGRATION_FILENAME),
  };
  const receiptSha256 = await writeJson(paths.receipt, receipt);
  await writeJson(paths.catalog, catalog);
  await writeJson(paths.audit, audit);
  await writeJson(paths.enrichment, enrichment);
  await fs.mkdir(path.dirname(paths.seed), { recursive: true });
  await fs.writeFile(paths.seed, seedTemplate);
  return { catalog, receipt, receiptSha256, paths };
}

test("strict receipt validation rejects unverified loudness evidence", async (context) => {
  const fixture = await prepareFixture(context);
  const changed = structuredClone(fixture.receipt);
  changed.episodes[0].loudness.passed = false;
  assert.throws(
    () => validateRemoteAudioReceiptData({ receipt: changed, catalog: fixture.catalog }),
    (error) =>
      error instanceof RemoteAudioReceiptIntegrationError &&
      error.message.includes("loudness gate did not pass")
  );
});

test("integration preserves Episode 5 derivative and is idempotent", async (context) => {
  const fixture = await prepareFixture(context);
  let verified = 0;
  const options = {
    receiptPath: fixture.paths.receipt,
    expectedReceiptSha256: fixture.receiptSha256,
    catalogPath: fixture.paths.catalog,
    auditPath: fixture.paths.audit,
    enrichmentPath: fixture.paths.enrichment,
    seedPath: fixture.paths.seed,
    migrationPath: fixture.paths.migration,
    apply: true,
    mediaVerifier: async () => {
      verified += 1;
    },
  };
  const priorDerivative = structuredClone(
    fixture.catalog.assetRegistry["episode-005-spotify-video"]
  );
  const first = await integrateRemoteAudioReceipt(options);
  assert.equal(first.catalogRevisionBefore, 8);
  assert.equal(first.catalogRevisionAfter, 9);
  assert.equal(first.downstreamRefreshVerified, false);
  assert.equal(verified, 7);
  const firstFiles = await Promise.all(
    Object.values(fixture.paths).slice(1).map((filePath) => fs.readFile(filePath, "utf8"))
  );
  const catalog = JSON.parse(await fs.readFile(fixture.paths.catalog, "utf8"));
  const audit = JSON.parse(await fs.readFile(fixture.paths.audit, "utf8"));
  assert.deepEqual(catalog.assetRegistry["episode-005-spotify-video"], priorDerivative);
  assert.equal(audit.remoteReplacement.downstreamRefreshVerified, false);
  assert.equal(
    audit.episodes.every(
      (episode) =>
        episode.remoteReplacementTargets.find((target) => target.platform === "rssCom")
          .status === "verified_remote_replacement"
    ),
    true
  );
  const second = await integrateRemoteAudioReceipt(options);
  assert.equal(second.catalogRevisionBefore, 9);
  assert.equal(second.catalogRevisionAfter, 9);
  assert.equal(verified, 14);
  const secondFiles = await Promise.all(
    Object.values(fixture.paths).slice(1).map((filePath) => fs.readFile(filePath, "utf8"))
  );
  assert.deepEqual(secondFiles, firstFiles);
});

test("integration rejects a downloaded enclosure hash mismatch", async (context) => {
  const fixture = await prepareFixture(context);
  await fs.appendFile(fixture.receipt.episodes[0].localFile.path, "tampered\n");
  await assert.rejects(
    integrateRemoteAudioReceipt({
      receiptPath: fixture.paths.receipt,
      expectedReceiptSha256: fixture.receiptSha256,
      catalogPath: fixture.paths.catalog,
      auditPath: fixture.paths.audit,
      enrichmentPath: fixture.paths.enrichment,
      seedPath: fixture.paths.seed,
      migrationPath: fixture.paths.migration,
      mediaVerifier: async () => {},
    }),
    (error) =>
      error instanceof RemoteAudioReceiptIntegrationError &&
      error.message.includes("file facts differ")
  );
});
