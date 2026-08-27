import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  buildAppleRepublishCanaryOverlay,
  buildAppleRepublishCanaryPhaseOverlay,
  generateAppleRepublishCanaryPrototype,
  loadAppleRepublishCanaryAuthorities,
  stageEpisodeOneCanaryMedia,
  uuidV5,
  validateAppleRepublishCanaryConfig,
  writeAll,
} from "./apple-republish-canary-prototype.mjs";
import { verifyDirectAppleCanaryMedia } from "./verify-apple-republish-canary-deployment.mjs";

const { config, activeConfig, deploymentState, sealedFeeds } =
  await loadAppleRepublishCanaryAuthorities();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function responseAt(url, body, init) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: String(url) });
  return response;
}

const episodes = [
  [8, "Food and the Brain - Eating for Brain Health and Concussion Recovery", "3096546", "4587dd48-8a26-4341-b194-8764500d74ef"],
  [7, "The Brain on Fire - Neuroinflammation After Concussion", "3050760", "4a0b3903-b7d1-4ced-967b-079df4004a4e"],
  [6, "Concussion - What Happens in the Brain", "3050761", "13a0565e-582c-4969-a57d-9700b7babbe4"],
  [5, "Energy - Understanding Fatigue and Mitochondrial Health", "3050762", "e9f7596f-0333-49ca-8946-bc11e96b2091"],
  [4, "Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure", "3050763", "9579ff89-9e16-40db-b84a-00cee25c604a"],
  [3, "Insomnia - Causes and Practical Sleep Strategies", "3050764", "e4bde82f-54e6-43a2-a50a-4044f9cdbe8e"],
  [2, "Brain Fog, Part 2 - Testing and Basic Solutions", "3050765", "1e40e02b-b217-477c-9cc3-4271cb304c23"],
  [1, "Brain Fog, Part 1 - Is Your Brain in a Fog?", "3050766", "c9b853b6-a828-4012-9998-217919ff9163"],
].map(([number, title, rssId, guid]) => ({ number, title, rssId, guid }));

function enclosureUrl(number) {
  return number === 1
    ? config.canary.sourceEnclosure.url
    : `https://content.example.test/episode-${number}.mp3`;
}

function enclosureLength(number) {
  return number === 1 ? config.canary.sourceEnclosure.length : 10_000 + number;
}

function feedXml({ episodeOverrides = new Map() } = {}) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Dr. M Experienced, with Dr. David Musnick</title>
    <atom:link href="${activeConfig.sourceSelfUrl}" rel="self" type="application/rss+xml"/>
    ${episodes
      .map((baseline) => {
        const episode = { ...baseline, ...(episodeOverrides.get(baseline.number) ?? {}) };
        return `<item>
      <title><![CDATA[${episode.title}]]></title>
      <description><![CDATA[Episode ${episode.number} exact metadata.]]></description>
      <link>https://rss.com/podcasts/dr-m-experienced/${episode.rssId}</link>
      <enclosure url="${episode.enclosureUrl ?? enclosureUrl(episode.number)}" length="${episode.enclosureLength ?? enclosureLength(episode.number)}" type="audio/mpeg"/>
      <guid isPermaLink="false">${episode.guid}</guid>
      <itunes:episode>${episode.number}</itunes:episode>
      <pubDate>Tue, ${String(episode.number).padStart(2, "0")} Jan 2026 08:00:00 GMT</pubDate>
    </item>`;
      })
      .join("\n    ")}
  </channel>
</rss>`;
}

test("prototype config is schema-pinned, deterministic, and remote-fail-closed", () => {
  assert.deepEqual(validateAppleRepublishCanaryConfig(config), {
    valid: true,
    errors: [],
  });
  assert.equal(config.appleShowId, "1870433419");
  assert.equal(config.canary.episodeNumber, 1);
  assert.equal(config.canary.appleEpisodeId, "1000746628307");
  assert.equal(config.canary.candidateGuid.value, "4111e441-c542-50f8-95de-3031c2b27f56");
  assert.equal(
    uuidV5(
      config.canary.candidateGuid.namespace,
      config.canary.candidateGuid.name,
    ),
    config.canary.candidateGuid.value,
  );
  assert.equal(config.canary.candidateGuid.automaticRegenerationAllowed, false);
  assert.equal(config.canary.candidateGuid.reusableForAnotherEpisode, false);
  assert.deepEqual(deploymentState.orderedPhases, [
    "closed",
    "media_staged",
    "active",
    "contained",
  ]);
  assert.ok(deploymentState.orderedPhases.includes(deploymentState.phase));
  assert.equal(
    deploymentState.transitionAuthorization.approvedTargetPhase,
    deploymentState.phase,
  );
  if (deploymentState.phase === "closed") {
    assert.equal(deploymentState.sealedMediaAsset.path, null);
    assert.equal(deploymentState.mediaStagedPublicEvidence, null);
  } else {
    assert.equal(
      deploymentState.sealedMediaAsset.path,
      "publishing/apple-republish-canary-assets/brain-fog-part-1-9f9402d98ec297cd.mp3",
    );
    assert.ok(deploymentState.transitionAuthorization.recordedAt);
    assert.ok(deploymentState.transitionAuthorization.authorizedBy);
  }
  assert.equal("incidentAuthorityPath" in config, false);
  assert.equal("incidentAuthoritySha256" in config, false);
  assert.equal("deploymentState" in config, false);
  assert.equal(
    config.identityGates.existingAppleEpisodeRecordPreservation,
    "not_guaranteed_new_guid_and_enclosure_may_create_a_new_apple_episode_id",
  );
  assert.equal(config.identityGates.replacementAppleEpisodeIdMayDiffer, true);
  assert.deepEqual(config.remoteActionGates, {
    prototypeArtifactMayDeploy: false,
    appleFeedEditApproved: false,
    appleFeedRefreshApproved: false,
    appleEpisodeDeleteApproved: false,
    appleEpisodeArchiveApproved: false,
    canonicalRssComMutationApproved: false,
    spotifyMutationApproved: false,
    requiresFreshAttendedOwnerApproval: true,
  });
  const mutated = structuredClone(config);
  mutated.remoteActionGates.prototypeArtifactMayDeploy = true;
  const result = validateAppleRepublishCanaryConfig(mutated);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /remoteActionGates/.test(error)));
});

test("operational phase state rejects unknown or unauthorized open phases", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-canary-state-"));
  try {
    const invalidPhase = structuredClone(deploymentState);
    invalidPhase.phase = "unexpected";
    invalidPhase.transitionAuthorization.approvedTargetPhase = "unexpected";
    const invalidPhasePath = path.join(temporary, "invalid-phase.json");
    await fs.writeFile(invalidPhasePath, JSON.stringify(invalidPhase));
    await assert.rejects(
      loadAppleRepublishCanaryAuthorities(undefined, invalidPhasePath),
      /Apple canary deployment state is invalid/,
    );

    const unauthorized = structuredClone(deploymentState);
    unauthorized.phase = "active";
    unauthorized.transitionAuthorization.approvedTargetPhase = "active";
    unauthorized.transitionAuthorization.recordedAt = null;
    unauthorized.transitionAuthorization.authorizedBy = null;
    unauthorized.sealedMediaAsset.path = null;
    unauthorized.mediaStagedPublicEvidence = {
      verifiedAt: "2026-08-26T22:30:00Z",
      publicUrl: config.canary.candidateEnclosure.url,
      directNoRedirect: true,
      headStatus: 200,
      acceptRanges: true,
      verifiedRangeCount: 3,
      fullStatus: 200,
      bytes: config.canary.candidateEnclosure.length,
      sha256: config.canary.candidateEnclosure.sha256,
      historicalFeedSha256:
        deploymentState.sealedFeedSnapshots.historical.publishedSha256,
    };
    const unauthorizedPath = path.join(temporary, "unauthorized.json");
    await fs.writeFile(unauthorizedPath, JSON.stringify(unauthorized));
    await assert.rejects(
      loadAppleRepublishCanaryAuthorities(undefined, unauthorizedPath),
      /require a sealed media asset and attended authorization record/,
    );

    const noPublicEvidence = structuredClone(deploymentState);
    noPublicEvidence.phase = "active";
    noPublicEvidence.sealedMediaAsset.path =
      "publishing/apple-republish-canary-assets/brain-fog-part-1-9f9402d98ec297cd.mp3";
    noPublicEvidence.transitionAuthorization = {
      approvedTargetPhase: "active",
      recordedAt: "2026-08-26T22:30:00Z",
      authorizedBy: "test_owner",
      approvalBasis: "Test fixture only.",
    };
    const noPublicEvidencePath = path.join(temporary, "no-evidence.json");
    await fs.writeFile(
      noPublicEvidencePath,
      JSON.stringify(noPublicEvidence),
    );
    await assert.rejects(
      loadAppleRepublishCanaryAuthorities(undefined, noPublicEvidencePath),
      /Apple canary deployment state is invalid/,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("sealed four-phase projections are exact and fail closed", () => {
  const canonical = feedXml();
  const closed = buildAppleRepublishCanaryPhaseOverlay(
    canonical,
    activeConfig,
    config,
    "closed",
  );
  const staged = buildAppleRepublishCanaryPhaseOverlay(
    canonical,
    activeConfig,
    config,
    "media_staged",
  );
  const active = buildAppleRepublishCanaryPhaseOverlay(
    canonical,
    activeConfig,
    config,
    "active",
  );
  const contained = buildAppleRepublishCanaryPhaseOverlay(
    canonical,
    activeConfig,
    config,
    "contained",
  );

  assert.equal(closed.xml, staged.xml, "media staging must not change the feed");
  assert.equal(closed.xml.includes(config.canary.activeAppleGuid), true);
  assert.equal(closed.xml.includes(config.canary.candidateGuid.value), false);
  assert.equal(active.xml.includes(config.canary.candidateGuid.value), true);
  assert.equal(active.xml.includes(config.canary.candidateEnclosure.url), true);
  assert.equal(active.xml.includes("<itunes:block>yes</itunes:block>"), false);
  assert.equal(contained.xml.includes(config.canary.candidateGuid.value), true);
  assert.equal(contained.xml.includes(config.canary.candidateEnclosure.url), true);
  assert.equal(
    (contained.xml.match(/<itunes:block>yes<\/itunes:block>/g) ?? []).length,
    1,
  );
  assert.equal(contained.report.transitionChangedFieldCount, 1);
  assert.throws(
    () =>
      buildAppleRepublishCanaryPhaseOverlay(
        canonical,
        activeConfig,
        config,
        "unexpected",
      ),
    /Unknown Apple republish canary phase/,
  );

  assert.equal(sealedFeeds.historical.includes(config.canary.activeAppleGuid), true);
  assert.equal(sealedFeeds.historical.includes(config.canary.candidateGuid.value), false);
  assert.equal(sealedFeeds.active.includes(config.canary.candidateGuid.value), true);
  assert.equal(sealedFeeds.active.includes("<itunes:block>yes</itunes:block>"), false);
  assert.equal(
    (sealedFeeds.contained.match(/<itunes:block>yes<\/itunes:block>/g) ?? []).length,
    1,
  );
});

test("candidate enclosure is a path-distinct immutable content-hash URL", () => {
  assert.equal(
    config.canary.candidateEnclosure.url,
    "https://drmexperienced.com/apple-podcasts/media/brain-fog-part-1-9f9402d98ec297cd.mp3",
  );
  assert.equal(
    config.artifactLayout.mediaRelativePath,
    "apple-podcasts/media/brain-fog-part-1-9f9402d98ec297cd.mp3",
  );
  assert.notEqual(
    config.canary.candidateEnclosure.url,
    config.canary.sourceEnclosure.url,
  );
  assert.equal(
    config.canary.candidateEnclosure.sha256,
    config.canary.sourceEnclosure.sha256,
  );
  assert.equal(config.canary.candidateEnclosure.publicHttpValidated, false);
  assert.equal(config.validationEvidence.candidatePublicHttpValidated, false);
  assert.equal(config.validationEvidence.appleIdentityTreatmentVerified, false);
});

test("prototype changes only Episode 1 GUID and enclosure and reverses byte-exactly", () => {
  const result = buildAppleRepublishCanaryOverlay(
    feedXml(),
    activeConfig,
    config,
  );
  assert.equal(result.report.episodeCount, 8);
  assert.equal(result.report.changedEpisodeCount, 1);
  assert.equal(result.report.changedFieldCount, 2);
  assert.equal(result.report.activeOverlayRestoredByteExactly, true);
  assert.equal(result.report.canonicalSourceMutated, false);
  assert.equal(result.xml.includes(config.canary.candidateGuid.value), true);
  assert.equal(result.xml.includes(config.canary.candidateEnclosure.url), true);
  assert.equal(result.xml.includes(config.canary.activeAppleGuid), false);
  assert.equal(
    result.xml.includes(activeConfig.guidMappings[1].appleGuid),
    true,
    "Episode 2 must retain its active historical Apple GUID",
  );
  assert.equal(result.xml.includes("<itunes:new-feed-url"), false);

  const restored = result.xml
    .replace(
      config.canary.candidateEnclosure.url,
      config.canary.sourceEnclosure.url,
    )
    .replace(config.canary.candidateGuid.value, config.canary.activeAppleGuid);
  assert.equal(restored, result.activeOverlayXml);
  for (const number of [2, 3, 4, 5, 6, 7, 8]) {
    const before = result.episodes.find((episode) => episode.episodeNumber === number);
    const activeResult = buildAppleRepublishCanaryOverlay(
      feedXml(),
      activeConfig,
      config,
    );
    const after = activeResult.episodes.find(
      (episode) => episode.episodeNumber === number,
    );
    assert.deepEqual(after, before);
  }
});

test("Episode 1 source identity drift fails before candidate output", () => {
  assert.throws(
    () =>
      buildAppleRepublishCanaryOverlay(
        feedXml({
          episodeOverrides: new Map([
            [1, { enclosureUrl: "https://content.example.test/drift.mp3" }],
          ]),
        }),
        activeConfig,
        config,
      ),
    /Active Episode 1 enclosure URL drifted/,
  );
});

test("reversal policy is phase-aware and never removes used canary media", () => {
  assert.equal(
    config.reversalGates.preActivation.requireByteExactActiveOverlayRestoration,
    true,
  );
  assert.equal(
    config.reversalGates.preActivation
      .candidateMediaRemovalAllowedOnlyIfNeverReferencedByPublishedFeed,
    true,
  );
  assert.equal(
    config.reversalGates.postActivation.candidateMediaMustRemainLiveIndefinitely,
    true,
  );
  assert.equal(
    config.reversalGates.postActivation.blindHistoricalGuidRestoreProhibited,
    true,
  );
  assert.equal(
    config.reversalGates.postActivation.containmentMethod,
    "retain_candidate_guid_and_enclosure_add_itunes_block_yes",
  );
  assert.equal(
    config.reversalGates.containmentMayBeTriggeredByDuplicatePublicEpisode,
    true,
  );
});

test("immutable media staging hashes before no-replace install, reuses exact bytes, and refuses drift", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-canary-media-"));
  const destination = path.join(temporary, "media", "tiny.mp3");
  const bytes = Buffer.from("tiny exact media");
  const tiny = structuredClone(config);
  tiny.canary.sourceEnclosure.length = bytes.length;
  tiny.canary.sourceEnclosure.sha256 = sha256(bytes);
  tiny.canary.candidateEnclosure.length = bytes.length;
  tiny.canary.candidateEnclosure.sha256 = sha256(bytes);
  try {
    const fetchImpl = async (_url, options) => {
      assert.equal(options.redirect, "follow");
      return responseAt(
        "https://rsscom.pdn.tritondigital.com/dr-m-experienced/2026_08_07_05_37_14_57d1a0c9-5f80-4880-bc5d-57f7eeef7cb5.mp3?episode_id=3050766&show_id=397420",
        bytes,
        {
          status: 200,
          headers: {
            "content-length": String(bytes.length),
            "content-type": "audio/mpeg",
          },
        },
      );
    };
    const first = await stageEpisodeOneCanaryMedia(tiny, destination, {
      fetchImpl,
    });
    assert.equal(first.reused, false);
    assert.equal(first.sha256, sha256(bytes));
    assert.deepEqual(await fs.readFile(destination), bytes);
    const second = await stageEpisodeOneCanaryMedia(tiny, destination, {
      fetchImpl: async () => {
        throw new Error("exact immutable media should be reused");
      },
    });
    assert.equal(second.reused, true);

    await fs.writeFile(destination, "different");
    await assert.rejects(
      stageEpisodeOneCanaryMedia(tiny, destination, { fetchImpl }),
      /refusing overwrite/,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("media staging never removes a lock owned by another process", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-canary-lock-"));
  const destination = path.join(temporary, "media", "tiny.mp3");
  const lockPath = `${destination}.lock`;
  try {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(lockPath, "other-process-lock", { mode: 0o600 });
    await assert.rejects(
      stageEpisodeOneCanaryMedia(config, destination, {
        fetchImpl: async () => {
          throw new Error("fetch must not run when the lock is held");
        },
      }),
      (error) => error?.code === "EEXIST",
    );
    assert.equal(await fs.readFile(lockPath, "utf8"), "other-process-lock");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("media staging completes partial writes and rejects zero progress", async () => {
  const expected = Buffer.from("partial-write-proof");
  const observed = [];
  await writeAll(
    {
      async write(buffer, offset, length) {
        const bytesWritten = Math.min(3, length);
        observed.push(buffer.subarray(offset, offset + bytesWritten));
        return { bytesWritten };
      },
    },
    expected,
  );
  assert.deepEqual(Buffer.concat(observed), expected);
  await assert.rejects(
    writeAll(
      {
        async write() {
          return { bytesWritten: 0 };
        },
      },
      expected,
    ),
    /no filesystem write progress/,
  );
});

test("public media verifier requires direct HEAD, three ranges, and full hash", async () => {
  const bytes = Buffer.alloc(12_288);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
  const tiny = structuredClone(config);
  tiny.canary.candidateEnclosure.length = bytes.length;
  tiny.canary.candidateEnclosure.sha256 = sha256(bytes);
  tiny.validationEvidence.rangeProbeSha256 = sha256(bytes.subarray(0, 4096));

  const fetchImpl = async (url, options) => {
    assert.equal(String(url), tiny.canary.candidateEnclosure.url);
    if (options.method === "HEAD") {
      return responseAt(url, null, {
        status: 200,
        headers: {
          "accept-ranges": "bytes",
          "content-length": String(bytes.length),
          "content-type": "audio/mpeg",
        },
      });
    }
    const range = options.headers.Range;
    if (range) {
      const [, startText, endText] = /^bytes=(\d+)-(\d+)$/.exec(range);
      const start = Number(startText);
      const end = Number(endText);
      return responseAt(url, bytes.subarray(start, end + 1), {
        status: 206,
        headers: {
          "content-length": String(end - start + 1),
          "content-range": `bytes ${start}-${end}/${bytes.length}`,
          "content-type": "audio/mpeg",
        },
      });
    }
    return responseAt(url, bytes, {
      status: 200,
      headers: {
        "content-length": String(bytes.length),
        "content-type": "audio/mpeg",
      },
    });
  };

  const report = await verifyDirectAppleCanaryMedia(tiny, { fetchImpl });
  assert.equal(report.directNoRedirect, true);
  assert.equal(report.verifiedRangeCount, 3);
  assert.equal(report.bytes, bytes.length);
  assert.equal(report.sha256, sha256(bytes));

  await assert.rejects(
    verifyDirectAppleCanaryMedia(tiny, {
      fetchImpl: async () =>
        responseAt("https://example.test/redirected.mp3", null, {
          status: 200,
          headers: {
            "accept-ranges": "bytes",
            "content-length": String(bytes.length),
            "content-type": "audio/mpeg",
          },
        }),
    }),
    /must not redirect/,
  );
});

test("prototype generator cannot target production out or run without acknowledgment", async () => {
  await assert.rejects(
    generateAppleRepublishCanaryPrototype({
      artifactRoot: path.resolve("out"),
    }),
    /explicit local-prototype acknowledgment/,
  );
  await assert.rejects(
    generateAppleRepublishCanaryPrototype({
      artifactRoot: path.resolve("out"),
      allowLocalPrototype: true,
    }),
    /forbids writing the repository production artifact/,
  );
  await assert.rejects(
    generateAppleRepublishCanaryPrototype({
      artifactRoot: path.resolve("out", "missing-clean-run-artifact"),
      allowLocalPrototype: true,
    }),
    /forbids writing the repository production artifact/,
  );
});

test("prototype generator rejects symlink aliases and nested symlink escapes", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-canary-symlink-"));
  const alias = path.join(temporary, "production-alias");
  const artifact = path.join(temporary, "artifact");
  try {
    await fs.symlink(path.resolve("out"), alias, "dir");
    await assert.rejects(
      generateAppleRepublishCanaryPrototype({
        artifactRoot: alias,
        allowLocalPrototype: true,
        fetchImpl: async () => {
          throw new Error("fetch must not run through a symlink alias");
        },
      }),
      /symlink-free canonical directory/,
    );

    await fs.mkdir(artifact);
    await fs.writeFile(path.join(artifact, "index.html"), "sentinel");
    await fs.writeFile(path.join(artifact, "CNAME"), "drmexperienced.com\n");
    await fs.symlink(path.resolve("out"), path.join(artifact, "apple-podcasts"), "dir");
    await assert.rejects(
      generateAppleRepublishCanaryPrototype({
        artifactRoot: artifact,
        allowLocalPrototype: true,
        fetchImpl: async () => {
          throw new Error("fetch must not run through a nested symlink");
        },
      }),
      /must not contain symlinks/,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("production deploy workflow materializes only the checked-in authorized phase", async () => {
  const workflow = await fs.readFile(
    new URL("../../.github/workflows/deploy.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /npm run generate:authorized-apple-subtree/);
  assert.match(workflow, /npm run verify:authorized-apple-subtree/);
  assert.match(workflow, /npm run verify:apple-authorized-subtree-deployment/);
});
