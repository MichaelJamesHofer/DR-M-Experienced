import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertPublicApplePhaseBaseline,
  generateAuthorizedAppleSubtree,
  verifyAuthorizedAppleSubtree,
} from "./apple-authorized-subtree.mjs";
import { loadAppleRepublishCanaryAuthorities } from "./apple-republish-canary-prototype.mjs";
import { verifyAppleAuthorizedSubtreeDeployment } from "./verify-apple-authorized-subtree-deployment.mjs";

const loaded = await loadAppleRepublishCanaryAuthorities();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function replaceEpisodeOneLength(xml, url, length) {
  const before = `url="${url}" length="16339867"`;
  const after = `url="${url}" length="${length}"`;
  assert.equal((xml.match(new RegExp(before.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? []).length, 1);
  return xml.replace(before, after);
}

async function fixtureAuthorities(temporary, phase) {
  const bytes = Buffer.alloc(12_288);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = index % 251;
  const assetPath = path.join(temporary, "sealed.mp3");
  await fs.writeFile(assetPath, bytes);
  const authorities = structuredClone(loaded);
  authorities.config.canary.sourceEnclosure.length = bytes.length;
  authorities.config.canary.sourceEnclosure.sha256 = sha256(bytes);
  authorities.config.canary.candidateEnclosure.length = bytes.length;
  authorities.config.canary.candidateEnclosure.sha256 = sha256(bytes);
  authorities.config.validationEvidence.rangeProbeSha256 = sha256(
    bytes.subarray(0, 4096),
  );
  authorities.deploymentState.phase = phase;
  authorities.deploymentState.transitionAuthorization.approvedTargetPhase = phase;
  authorities.deploymentState.transitionAuthorization.recordedAt =
    phase === "closed" ? null : "2026-08-26T22:00:00Z";
  authorities.deploymentState.transitionAuthorization.authorizedBy =
    phase === "closed" ? null : "test_owner";
  authorities.deploymentState.sealedMediaAsset.path =
    phase === "closed" ? null : "publishing/apple-republish-canary-assets/test.mp3";
  authorities.deploymentState.sealedMediaAsset.length = bytes.length;
  authorities.deploymentState.sealedMediaAsset.sha256 = sha256(bytes);
  authorities.deploymentState.mediaStagedPublicEvidence =
    phase === "active" || phase === "contained"
      ? {
          verifiedAt: "2026-08-26T22:30:00Z",
          publicUrl: authorities.config.canary.candidateEnclosure.url,
          directNoRedirect: true,
          headStatus: 200,
          acceptRanges: true,
          verifiedRangeCount: 3,
          fullStatus: 200,
          bytes: bytes.length,
          sha256: sha256(bytes),
          historicalFeedSha256:
            authorities.deploymentState.sealedFeedSnapshots.historical
              .publishedSha256,
        }
      : null;
  authorities.sealedMediaAssetPathOverride = assetPath;
  authorities.sealedFeeds.historical = replaceEpisodeOneLength(
    authorities.sealedFeeds.historical,
    authorities.config.canary.sourceEnclosure.url,
    bytes.length,
  );
  authorities.sealedFeeds.active = replaceEpisodeOneLength(
    authorities.sealedFeeds.active,
    authorities.config.canary.candidateEnclosure.url,
    bytes.length,
  );
  authorities.sealedFeeds.contained = replaceEpisodeOneLength(
    authorities.sealedFeeds.contained,
    authorities.config.canary.candidateEnclosure.url,
    bytes.length,
  );
  return { authorities, bytes };
}

function responseAt(url, body, init) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: String(url) });
  return response;
}

function deploymentFetch(authorities, bytes, expectedFeed) {
  return async (url, options = {}) => {
    const requested = String(url);
    if (new URL(requested).pathname === new URL(authorities.activeConfig.publicFeedUrl).pathname) {
      return responseAt(url, expectedFeed, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });
    }
    assert.equal(requested, authorities.config.canary.candidateEnclosure.url);
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
    const range = options.headers?.Range;
    if (range) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      assert.ok(match);
      const start = Number(match[1]);
      const end = Number(match[2]);
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
}

async function makeSite(temporary, name) {
  const site = path.join(temporary, name);
  await fs.mkdir(site);
  return site;
}

const phaseCases = [
  {
    phase: "closed",
    baseline: null,
    guid: "historical",
    block: false,
    inventory: ["feed.xml"],
  },
  {
    phase: "media_staged",
    baseline: "historical",
    guid: "historical",
    block: false,
    inventory: [
      "feed.xml",
      "media/brain-fog-part-1-9f9402d98ec297cd.mp3",
    ],
  },
  {
    phase: "active",
    baseline: "historical",
    guid: "candidate",
    block: false,
    inventory: [
      "feed.xml",
      "media/brain-fog-part-1-9f9402d98ec297cd.mp3",
    ],
  },
  {
    phase: "contained",
    baseline: "active",
    guid: "candidate",
    block: true,
    inventory: [
      "feed.xml",
      "media/brain-fog-part-1-9f9402d98ec297cd.mp3",
    ],
  },
];

for (const phaseCase of phaseCases) {
  test(`${phaseCase.phase} phase materializes and verifies the exact offline subtree`, async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-phase-"));
    try {
      const { authorities, bytes } = await fixtureAuthorities(
        temporary,
        phaseCase.phase,
      );
      const site = await makeSite(temporary, "site");
      const publicFeedXml = phaseCase.baseline
        ? authorities.sealedFeeds[phaseCase.baseline]
        : null;
      const noNetwork = async () => {
        throw new Error("offline authorized materializer must not use the network");
      };
      const generated = await generateAuthorizedAppleSubtree({
        siteRoot: site,
        authorities,
        publicFeedXml,
        fetchImpl: noNetwork,
      });
      assert.equal(generated.phase, phaseCase.phase);
      assert.deepEqual(generated.inventory, phaseCase.inventory);
      if (phaseCase.baseline) {
        assert.equal(generated.baselinePhase, phaseCase.baseline === "historical" ? "media_staged" : phaseCase.baseline);
        assert.equal(generated.pretransitionPublicSha256, sha256(publicFeedXml));
      }

      const verified = await verifyAuthorizedAppleSubtree({
        siteRoot: site,
        authorities,
        publicFeedXml,
        fetchImpl: noNetwork,
      });
      assert.equal(verified.exactAuthorizedPhaseProjection, true);
      assert.deepEqual(verified.inventory, phaseCase.inventory);
      const feed = await fs.readFile(
        path.join(site, authorities.config.artifactLayout.feedRelativePath),
        "utf8",
      );
      const expectedGuid =
        phaseCase.guid === "historical"
          ? authorities.config.canary.activeAppleGuid
          : authorities.config.canary.candidateGuid.value;
      assert.equal(feed.includes(expectedGuid), true);
      assert.equal(feed.includes("<itunes:block>yes</itunes:block>"), phaseCase.block);
      if (phaseCase.phase !== "closed") {
        assert.deepEqual(
          await fs.readFile(
            path.join(site, authorities.config.artifactLayout.mediaRelativePath),
          ),
          bytes,
        );
      }
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  });
}

for (const phaseCase of phaseCases) {
  test(`${phaseCase.phase} phase verifies exact public feed and required media`, async () => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-public-phase-"));
    try {
      const { authorities, bytes } = await fixtureAuthorities(
        temporary,
        phaseCase.phase,
      );
      const snapshot = authorities.deploymentState.feedSnapshotByPhase[phaseCase.phase];
      const expectedFeed = authorities.sealedFeeds[snapshot];
      const report = await verifyAppleAuthorizedSubtreeDeployment({
        authorities,
        expectedFeedSha256: sha256(expectedFeed),
        fetchImpl: deploymentFetch(authorities, bytes, expectedFeed),
        maxAttempts: 1,
        pollIntervalMs: 0,
      });
      assert.equal(report.phase, phaseCase.phase);
      assert.equal(report.exactSealedFeed, true);
      assert.equal(report.bareUrlVerified, true);
      assert.equal(report.candidateMediaRequired, phaseCase.phase !== "closed");
      assert.equal(report.media === null, phaseCase.phase === "closed");
      if (report.media) {
        assert.equal(report.media.verifiedRangeCount, 3);
        assert.equal(report.media.sha256, sha256(bytes));
      }
    } finally {
      await fs.rm(temporary, { recursive: true, force: true });
    }
  });
}

test("active and contained baselines allow only exact previous or current projections", () => {
  const activePrevious = assertPublicApplePhaseBaseline(
    loaded.sealedFeeds.historical,
    loaded,
    "active",
  );
  assert.equal(activePrevious.baselinePhase, "media_staged");
  assert.equal(activePrevious.idempotent, false);
  const activeCurrent = assertPublicApplePhaseBaseline(
    loaded.sealedFeeds.active,
    loaded,
    "active",
  );
  assert.equal(activeCurrent.baselinePhase, "active");
  assert.equal(activeCurrent.idempotent, true);
  const containedPrevious = assertPublicApplePhaseBaseline(
    loaded.sealedFeeds.active,
    loaded,
    "contained",
  );
  assert.equal(containedPrevious.baselinePhase, "active");
  const containedCurrent = assertPublicApplePhaseBaseline(
    loaded.sealedFeeds.contained,
    loaded,
    "contained",
  );
  assert.equal(containedCurrent.baselinePhase, "contained");
  assert.throws(
    () => assertPublicApplePhaseBaseline("<rss>unrelated drift</rss>", loaded, "active"),
    /neither the exact previous nor current active projection/,
  );
  assert.throws(
    () => assertPublicApplePhaseBaseline(loaded.sealedFeeds.historical, loaded, "contained"),
    /neither the exact previous nor current contained projection/,
  );
});

test("public-baseline failure happens before a deployment artifact is written", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-phase-"));
  try {
    const { authorities } = await fixtureAuthorities(temporary, "active");
    const site = await makeSite(temporary, "site");
    await assert.rejects(
      generateAuthorizedAppleSubtree({
        siteRoot: site,
        authorities,
        publicFeedXml: "<rss>unrelated drift</rss>",
      }),
      /neither the exact previous nor current active projection/,
    );
    await assert.rejects(fs.lstat(path.join(site, "apple-podcasts")), {
      code: "ENOENT",
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("phase transition requires bare and cache-busted public feed parity", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-parity-"));
  try {
    const { authorities } = await fixtureAuthorities(temporary, "active");
    const site = await makeSite(temporary, "site");
    const fetchImpl = async (url) => {
      const requested = new URL(String(url));
      const xml = requested.searchParams.has("apple_overlay_verify")
        ? authorities.sealedFeeds.active
        : authorities.sealedFeeds.historical;
      return responseAt(url, xml, {
        status: 200,
        headers: { "content-type": "application/rss+xml" },
      });
    };
    await assert.rejects(
      generateAuthorizedAppleSubtree({
        siteRoot: site,
        authorities,
        fetchImpl,
        cacheBust: "transition-parity",
      }),
      /Bare and cache-busted Apple feeds disagree/,
    );
    await assert.rejects(fs.lstat(path.join(site, "apple-podcasts")), {
      code: "ENOENT",
    });
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("closed state rejects leaked candidate media and never removes it", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-phase-"));
  try {
    const { authorities } = await fixtureAuthorities(temporary, "closed");
    const site = await makeSite(temporary, "site");
    const mediaPath = path.join(site, authorities.config.artifactLayout.mediaRelativePath);
    await fs.mkdir(path.dirname(mediaPath), { recursive: true });
    await fs.writeFile(mediaPath, "must remain for diagnosis");
    await assert.rejects(
      generateAuthorizedAppleSubtree({ siteRoot: site, authorities }),
      /unauthorized subtree files/,
    );
    assert.equal(await fs.readFile(mediaPath, "utf8"), "must remain for diagnosis");
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

test("site root and subtree symlink aliases fail before writes", async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-symlink-"));
  try {
    const { authorities } = await fixtureAuthorities(temporary, "closed");
    const real = await makeSite(temporary, "real");
    const alias = path.join(temporary, "alias");
    await fs.symlink(real, alias, "dir");
    await assert.rejects(
      generateAuthorizedAppleSubtree({ siteRoot: alias, authorities }),
      /symlink-free canonical path|not a symlink/,
    );

    const site = await makeSite(temporary, "nested-site");
    await fs.symlink(real, path.join(site, "apple-podcasts"), "dir");
    await assert.rejects(
      generateAuthorizedAppleSubtree({ siteRoot: site, authorities }),
      /subtree root must be a real directory/,
    );
  } finally {
    await fs.rm(temporary, { recursive: true, force: true });
  }
});

for (const workflowName of ["rollback-current-v2.yml", "rollback-pre-v2.yml"]) {
  test(`${workflowName} injects and publicly verifies the checked-in Apple phase`, async () => {
    const workflow = await fs.readFile(
      new URL(`../../.github/workflows/${workflowName}`, import.meta.url),
      "utf8",
    );
    assert.match(workflow, /ref: main/);
    assert.match(workflow, /persist-credentials: false/);
    assert.match(workflow, /npm run generate:authorized-apple-subtree/);
    assert.match(workflow, /npm run verify:authorized-apple-subtree/);
    assert.match(workflow, /cp -a out\/apple-podcasts rollback-package\/site\/apple-podcasts/);
    assert.match(workflow, /sha256sum rollback-package\/site\/apple-podcasts\/feed\.xml/);
    assert.match(workflow, /npm run verify:apple-authorized-subtree-deployment/);
    assert.ok(
      workflow.indexOf("verify:authorized-apple-subtree") <
        workflow.indexOf("actions/upload-pages-artifact"),
    );
    assert.ok(
      workflow.indexOf("actions/deploy-pages") <
        workflow.indexOf("verify:apple-authorized-subtree-deployment"),
    );
  });
}
