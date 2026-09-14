import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  loadAppleAuthorizedAuthorities,
  projectAppleShowNameMd,
  selectedAppleFeed,
} from "./apple-show-name-md-v1.mjs";
import {
  assertPublicApplePhaseBaseline,
  generateAuthorizedAppleSubtree,
  verifyAuthorizedAppleSubtree,
} from "./apple-authorized-subtree.mjs";
import { parseAppleRepublishFeed } from "./apple-republish-canary-prototype.mjs";
import { verifyAppleAuthorizedSubtreeDeployment } from "./verify-apple-authorized-subtree-deployment.mjs";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

test("show-name v1 changes only three channel fields above byte-exact episode items", async () => {
  const authorities = await loadAppleAuthorizedAuthorities();
  const release = authorities.showNameMdRelease;
  const before = authorities.sealedFeeds.active;
  const after = release.projections.active.xml;
  const itemMarker = "\n    <item>";
  assert.equal(sha256(before), release.baseFeedSha256BySnapshot.active);
  assert.equal(sha256(after), release.targetFeedSha256BySnapshot.active);
  assert.equal(after.slice(after.indexOf(itemMarker)), before.slice(before.indexOf(itemMarker)));
  assert.deepEqual(parseAppleRepublishFeed(after), parseAppleRepublishFeed(before));
  assert.equal(
    after.split(`<title><![CDATA[${release.targetShowName}]]></title>`).length - 1,
    1,
  );
  assert.equal(
    after.split(`<description><![CDATA[<p>${release.targetDescription}</p>]]></description>`).length - 1,
    1,
  );
  assert.equal(after.split(`<title>${release.targetShowName}</title>`).length - 1, 1);
  assert.equal(selectedAppleFeed(authorities).name, "active+show-name-md-v1");
  assert.throws(
    () => projectAppleShowNameMd(`${before} `, release, "active"),
    /base feed drifted/,
  );
  assert.throws(
    () => projectAppleShowNameMd(before, {
      ...release,
      targetFeedSha256BySnapshot: {
        ...release.targetFeedSha256BySnapshot,
        active: "0".repeat(64),
      },
    }, "active"),
    /target feed drifted/,
  );
});

test("show-name v1 accepts the live active canary as predecessor and its own target idempotently", async () => {
  const authorities = await loadAppleAuthorizedAuthorities();
  const previous = assertPublicApplePhaseBaseline(authorities.sealedFeeds.active, authorities);
  assert.equal(previous.baselinePhase, "active_pre_show_name");
  assert.equal(previous.idempotent, false);
  const current = assertPublicApplePhaseBaseline(authorities.showNameMdRelease.projections.active.xml, authorities);
  assert.equal(current.baselinePhase, "active");
  assert.equal(current.idempotent, true);
  const containedAuthorities = {
    ...authorities,
    deploymentState: { ...authorities.deploymentState, phase: "contained" },
  };
  const containedPrevious = assertPublicApplePhaseBaseline(
    authorities.showNameMdRelease.projections.active.xml,
    containedAuthorities,
  );
  assert.equal(containedPrevious.baselinePhase, "active");
  assert.equal(containedPrevious.idempotent, false);
  const containedCurrent = assertPublicApplePhaseBaseline(
    authorities.showNameMdRelease.projections.contained.xml,
    containedAuthorities,
  );
  assert.equal(containedCurrent.idempotent, true);
  assert.throws(
    () => assertPublicApplePhaseBaseline(`${authorities.sealedFeeds.active} `, authorities),
    /neither the exact previous nor current/,
  );
  assert.throws(
    () => assertPublicApplePhaseBaseline(authorities.sealedFeeds.historical, authorities),
    /neither the exact previous nor current/,
  );
  assert.throws(
    () => assertPublicApplePhaseBaseline(authorities.showNameMdRelease.projections.historical.xml, authorities),
    /neither the exact previous nor current/,
  );
});

test("show-name v1 materializes and verifies the authorized Apple subtree", async () => {
  const authorities = await loadAppleAuthorizedAuthorities();
  const siteRoot = await fs.mkdtemp(path.join(os.tmpdir(), "drm-apple-show-name-md-"));
  try {
    const first = await generateAuthorizedAppleSubtree({
      siteRoot,
      authorities,
      publicFeedXml: authorities.sealedFeeds.active,
    });
    assert.equal(first.feedSha256, authorities.showNameMdRelease.targetFeedSha256BySnapshot.active);
    assert.equal(first.baselinePhase, "active_pre_show_name");
    const second = await generateAuthorizedAppleSubtree({
      siteRoot,
      authorities,
      publicFeedXml: authorities.showNameMdRelease.projections.active.xml,
    });
    assert.equal(second.idempotent, true);
    const verified = await verifyAuthorizedAppleSubtree({
      siteRoot,
      authorities,
      publicFeedXml: authorities.showNameMdRelease.projections.active.xml,
    });
    assert.equal(verified.exactAuthorizedPhaseProjection, true);
    assert.equal(verified.feedSha256, authorities.showNameMdRelease.targetFeedSha256BySnapshot.active);
  } finally {
    await fs.rm(siteRoot, { recursive: true, force: true });
  }
});

test("deployment verifier rejects the old canary hash before fetching", async () => {
  const authorities = await loadAppleAuthorizedAuthorities();
  await assert.rejects(
    verifyAppleAuthorizedSubtreeDeployment({
      authorities,
      expectedFeedSha256: authorities.showNameMdRelease.baseFeedSha256BySnapshot.active,
      fetchImpl: () => {
        throw new Error("network should not be used");
      },
    }),
    /not the sealed active phase feed/,
  );
});
