import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { catalogHash, episodeHash, loadCatalog } from "./catalog.mjs";
import {
  buildApprovalSnapshot,
  buildTargetPlan,
  hashFile,
  hashSnapshot,
  hashText,
  renderApprovalPacket,
} from "./lib.mjs";
import {
  DEFAULT_RELEASE_AUTHORIZATION_TTL_MS,
  MAX_RELEASE_AUTHORIZATION_TTL_MS,
  buildReleaseAuthorization,
  releaseAuthorizationExpired,
  releaseAuthorizationProblems,
} from "./release-authorization.mjs";

function releasePlan(target) {
  const values = {
    youtube: { initialVisibility: "private", finalVisibility: "public", license: "youtube" },
    vimeo: { initialVisibility: "nobody", finalVisibility: "anybody", license: "none" },
  };
  return {
    releaseMode: "scheduled",
    monetization: "unchanged",
    notifications: "disabled",
    ...values[target],
  };
}

function target(id, assetSha256) {
  const plans = { youtube: releasePlan("youtube"), vimeo: releasePlan("vimeo") };
  return {
    id,
    label: id === "youtube" ? "YouTube" : "Vimeo",
    mode: "api_after_auth",
    readiness: "api_auth_required",
    asset: "fullVideo",
    assetSha256,
    dependsOn: null,
    destinationIds: { accountId: id === "youtube" ? "UCabcdefghijklmnopqrstuv" : "12345678", containerId: null },
    requiredDestinationIds: ["accountId"],
    missingDestinationIds: [],
    invalidDestinationIds: [],
    releasePlan: plans[id],
    unresolvedReleaseChoices: [],
    releasePolicyIssues: [],
    validationIssues: [],
    approvedCopy: `Approved ${id} copy`,
    copySource: `copy.${id}`,
    channelUrl: `https://example.test/${id}`,
    notes: "",
  };
}

function fixture() {
  const assetSha256 = "a".repeat(64);
  const manifest = {
    episodeNumber: 8,
    slug: "episode-8",
    title: "Reviewed episode",
    description: "Reviewed description",
    publishAt: "2026-08-15T15:00:00Z",
    explicit: false,
    madeForKids: false,
    containsSyntheticMedia: false,
    paidPromotion: false,
    tags: ["health"],
    assets: { fullVideo: "/tmp/video.mp4" },
    copy: { youtube: "Approved youtube copy", vimeo: "Approved vimeo copy" },
    releasePlan: { youtube: releasePlan("youtube"), vimeo: releasePlan("vimeo") },
    targets: ["youtube", "vimeo"],
  };
  const snapshot = {
    schemaVersion: 5,
    brand: "Dr. M Experienced, with Dr. David Musnick",
    rssFeed: "https://media.rss.com/dr-m-experienced/feed.xml",
    catalogBinding: {
      revision: 1,
      catalogHash: "b".repeat(64),
      episodeNumber: 8,
      episodeHash: "c".repeat(64),
    },
    manifest,
    assets: {
      fullVideo: {
        key: "fullVideo",
        path: "/tmp/video.mp4",
        sizeBytes: 1024,
        sha256: assetSha256,
        media: { durationSeconds: 60, streams: [] },
      },
    },
    targets: [target("youtube", assetSha256), target("vimeo", assetSha256)],
    warnings: [],
  };
  const packet = {
    id: "episode-8-20260808t120000z",
    status: "prepared",
    createdAt: "2026-08-08T18:00:00Z",
    sourceManifestPath: "/tmp/episode.json",
    approvalHash: hashSnapshot(snapshot),
    snapshot,
  };
  const reviewDocument = renderApprovalPacket(packet);
  const approval = {
    schemaVersion: 2,
    jobId: packet.id,
    approvalHash: packet.approvalHash,
    reviewDocumentSha256: hashText(reviewDocument),
    approvedAt: "2026-08-08T18:05:00Z",
    approvedBy: "Reviewer",
    attestationType: "self-reported-local-review",
    authorizesUpload: false,
    authorizesRelease: false,
  };
  return { packet, reviewDocument, approval };
}

function rehash(authorization) {
  const { authorizationHash: _authorizationHash, ...content } = authorization;
  authorization.authorizationHash = hashSnapshot(content);
  return authorization;
}

test("release authorization binds exact reviewed targets, assets, copy, release controls, and schedule", () => {
  const { packet, reviewDocument, approval } = fixture();
  const authorization = buildReleaseAuthorization({
    packet,
    approval,
    reviewDocument,
    targets: ["youtube"],
    approver: "Otto",
    issuedAt: "2026-08-08T18:10:00Z",
    expiresAt: "2026-08-08T19:10:00Z",
  });

  assert.deepEqual(
    releaseAuthorizationProblems(packet, approval, reviewDocument, authorization, {
      now: "2026-08-08T18:30:00Z",
    }),
    [],
  );
  assert.deepEqual(authorization.targets, ["youtube"]);
  assert.deepEqual(Object.keys(authorization.targetBindings), ["youtube"]);
  assert.equal(authorization.authorizesUpload, true);
  assert.equal(authorization.authorizesRelease, true);
  assert.deepEqual(authorization.targetBindings.youtube.schedule, {
    publishAt: "2026-08-15T15:00:00Z",
    releaseMode: "scheduled",
    initialVisibility: "private",
    finalVisibility: "public",
  });
  assert.equal(authorization.targetBindings.youtube.assetSha256, "a".repeat(64));
  assert.equal(authorization.targetBindings.youtube.approvedCopySha256, hashText("Approved youtube copy"));
  assert.equal(authorization.targetBindings.youtube.releasePlanSha256, hashSnapshot(releasePlan("youtube")));
});

test("release authorization rejects tamper, expanded scope, missing review, and expiry", () => {
  const { packet, reviewDocument, approval } = fixture();
  const authorization = buildReleaseAuthorization({
    packet,
    approval,
    reviewDocument,
    targets: ["youtube"],
    approver: "Otto",
    issuedAt: "2026-08-08T18:10:00Z",
    expiresAt: "2026-08-08T19:10:00Z",
  });

  const tampered = structuredClone(authorization);
  tampered.targetBindings.youtube.schedule.finalVisibility = "unlisted";
  assert.match(releaseAuthorizationProblems(packet, approval, reviewDocument, tampered).join("\n"), /binding|hash/i);

  const expanded = structuredClone(authorization);
  expanded.targets.push("vimeo");
  expanded.targetBindings.vimeo = structuredClone(authorization.targetBindings.youtube);
  rehash(expanded);
  assert.match(releaseAuthorizationProblems(packet, approval, reviewDocument, expanded).join("\n"), /binding for vimeo/i);

  const extraBinding = structuredClone(authorization);
  extraBinding.targetBindings.vimeo = structuredClone(packet.snapshot.targets[1]);
  rehash(extraBinding);
  assert.match(releaseAuthorizationProblems(packet, approval, reviewDocument, extraBinding).join("\n"), /exactly match/i);

  assert.match(releaseAuthorizationProblems(packet, approval, null, authorization).join("\n"), /exact reviewed document/i);
  assert.match(
    releaseAuthorizationProblems(packet, null, reviewDocument, authorization).join("\n"),
    /valid local review attestation/i,
  );
  assert.equal(releaseAuthorizationExpired(authorization, "2026-08-08T19:10:00Z"), true);
  assert.match(
    releaseAuthorizationProblems(packet, approval, reviewDocument, authorization, {
      now: "2026-08-08T19:10:00Z",
    }).join("\n"),
    /expired/i,
  );

  const missingExpiry = structuredClone(authorization);
  delete missingExpiry.expiresAt;
  rehash(missingExpiry);
  assert.equal(releaseAuthorizationExpired(missingExpiry, "2026-08-08T18:30:00Z"), true);
  assert.match(
    releaseAuthorizationProblems(packet, approval, reviewDocument, missingExpiry, {
      now: "2026-08-08T18:30:00Z",
    }).join("\n"),
    /expiresAt timestamp is required/i,
  );

  const unboundedExpiry = structuredClone(authorization);
  unboundedExpiry.expiresAt = new Date(
    Date.parse(unboundedExpiry.issuedAt) + MAX_RELEASE_AUTHORIZATION_TTL_MS + 1,
  ).toISOString();
  rehash(unboundedExpiry);
  assert.match(
    releaseAuthorizationProblems(packet, approval, reviewDocument, unboundedExpiry, {
      now: "2026-08-08T18:30:00Z",
    }).join("\n"),
    /no more than 24 hours/i,
  );
});

test("release authorization defaults to a bounded one-hour expiry", () => {
  const { packet, reviewDocument, approval } = fixture();
  const issuedAt = "2026-08-08T18:10:00Z";
  const authorization = buildReleaseAuthorization({
    packet,
    approval,
    reviewDocument,
    targets: ["youtube"],
    approver: "Otto",
    issuedAt,
  });

  assert.equal(
    authorization.expiresAt,
    new Date(Date.parse(issuedAt) + DEFAULT_RELEASE_AUTHORIZATION_TTL_MS).toISOString(),
  );
  assert.deepEqual(
    releaseAuthorizationProblems(packet, approval, reviewDocument, authorization, {
      now: "2026-08-08T18:30:00Z",
    }),
    [],
  );
});

test("authorize CLI requires review, exact confirmation and scope, then writes one private immutable record", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "drm-release-authorization-cli-"));
  const state = path.join(directory, "state");
  const assetPath = path.join(directory, "video.mp4");
  const cliPath = fileURLToPath(new URL("./cli.mjs", import.meta.url));
  const runCli = (...args) =>
    spawnSync(process.execPath, [cliPath, ...args], {
      encoding: "utf8",
      env: { ...process.env, DRM_PUBLISH_HOME: state, HOME: directory },
    });

  try {
    await fs.writeFile(assetPath, "approved asset", { mode: 0o600 });
    const stats = await fs.stat(assetPath);
    const catalog = await loadCatalog();
    const episode = catalog.episodes[0];
    const manifest = {
      episodeNumber: episode.number,
      slug: episode.slug,
      title: episode.title,
      description: episode.description.full,
      publishAt: "2099-08-15T15:00:00Z",
      explicit: episode.contentFlags.explicit,
      madeForKids: false,
      containsSyntheticMedia: false,
      paidPromotion: false,
      tags: ["health"],
      assets: { fullVideo: assetPath },
      copy: { youtube: "Approved YouTube copy" },
      releasePlan: { youtube: releasePlan("youtube") },
      targets: ["youtube"],
    };
    const assetSha256 = await hashFile(assetPath);
    const assets = {
      fullVideo: {
        key: "fullVideo",
        path: assetPath,
        sizeBytes: stats.size,
        modifiedMs: stats.mtimeMs,
        sha256: assetSha256,
        media: {
          durationSeconds: 60,
          streams: [{ type: "video", codec: "h264" }, { type: "audio", codec: "aac" }],
        },
        loudness: { integratedLufs: -16, truePeakDbtp: -1.5 },
      },
    };
    const platformConfig = {
      brand: "Dr. M Experienced, with Dr. David Musnick",
      rssFeed: "https://media.rss.com/dr-m-experienced/feed.xml",
      platforms: {
        youtube: {
          label: "YouTube",
          mode: "api_after_auth_and_audit",
          asset: "fullVideo",
          channelUrl: "https://www.youtube.com/channel/UCFA1nVv4lKMBlx81gjMAOFQ",
          destinationIds: {
            accountId: "UCFA1nVv4lKMBlx81gjMAOFQ",
            containerId: "UUFA1nVv4lKMBlx81gjMAOFQ",
          },
          requiredDestinationIds: ["accountId", "containerId"],
          notes: "",
        },
      },
    };
    const targets = buildTargetPlan(platformConfig, manifest, assets);
    const snapshot = buildApprovalSnapshot({
      platformConfig,
      manifest,
      assets,
      targets,
      warnings: [],
      catalogBinding: {
        revision: catalog.revision,
        catalogHash: catalogHash(catalog),
        episodeNumber: episode.number,
        episodeHash: episodeHash(episode),
      },
    });
    const packet = {
      id: "release-authorization-cli-test",
      status: "prepared",
      createdAt: "2026-08-08T18:00:00Z",
      sourceManifestPath: path.join(directory, "episode.json"),
      approvalHash: hashSnapshot(snapshot),
      snapshot,
    };
    const jobDirectory = path.join(state, "jobs", packet.id);
    const reviewDocument = renderApprovalPacket(packet);
    await fs.mkdir(jobDirectory, { recursive: true, mode: 0o700 });
    await fs.writeFile(path.join(jobDirectory, "packet.json"), `${JSON.stringify(packet, null, 2)}\n`, { mode: 0o600 });
    await fs.writeFile(path.join(jobDirectory, "approval.md"), reviewDocument, { mode: 0o600 });

    const authorizationConfirmation = `authorize-release ${packet.id} ${packet.approvalHash} youtube`;
    const missingReview = runCli(
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube",
      "--confirm",
      authorizationConfirmation,
    );
    assert.equal(missingReview.status, 1);
    assert.match(missingReview.stderr, /valid local review attestation/i);

    const reviewConfirmation = `approve ${packet.id} ${packet.approvalHash}`;
    const approved = runCli(
      "approve",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Reviewer",
      "--confirm",
      reviewConfirmation,
    );
    assert.equal(approved.status, 0, approved.stderr);

    const wrongScope = runCli(
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube,vimeo",
      "--confirm",
      `authorize-release ${packet.id} ${packet.approvalHash} youtube,vimeo`,
    );
    assert.equal(wrongScope.status, 1);
    assert.match(wrongScope.stderr, /not selected in the reviewed packet/i);

    const wrongConfirmation = runCli(
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube",
      "--confirm",
      `${authorizationConfirmation}-wrong`,
    );
    assert.equal(wrongConfirmation.status, 1);
    assert.match(wrongConfirmation.stderr, /confirmation phrase/i);

    const invalidArgumentCases = [
      {
        name: "unknown option",
        args: ["--unknown", "value"],
        pattern: /unknown authorize option/i,
      },
      {
        name: "stray value",
        args: ["stray"],
        pattern: /stray argument/i,
      },
      {
        name: "duplicate option",
        args: ["--by", "Second approver"],
        pattern: /may be specified only once/i,
      },
      {
        name: "missing value",
        args: ["--expires-at"],
        pattern: /--expires-at requires a value/i,
      },
      {
        name: "misspelled expiry option",
        args: ["--expiresAt", "2099-08-08T19:00:00Z"],
        pattern: /unknown authorize option/i,
      },
    ];
    const baseAuthorizationArguments = [
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube",
      "--confirm",
      authorizationConfirmation,
    ];
    for (const invalidCase of invalidArgumentCases) {
      const result = runCli(...baseAuthorizationArguments, ...invalidCase.args);
      assert.equal(result.status, 1, `${invalidCase.name}: ${result.stderr}`);
      assert.match(result.stderr, invalidCase.pattern, invalidCase.name);
    }

    const unbounded = runCli(
      ...baseAuthorizationArguments,
      "--expires-at",
      new Date(Date.now() + MAX_RELEASE_AUTHORIZATION_TTL_MS + 60_000).toISOString(),
    );
    assert.equal(unbounded.status, 1);
    assert.match(unbounded.stderr, /no more than 24 hours/i);

    const authorized = runCli(
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube",
      "--expires-at",
      new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      "--confirm",
      authorizationConfirmation,
    );
    assert.equal(authorized.status, 0, authorized.stderr);
    assert.match(authorized.stdout, /Immutable release authorization recorded/);

    const approval = JSON.parse(await fs.readFile(path.join(jobDirectory, "approval.json"), "utf8"));
    const authorization = JSON.parse(
      await fs.readFile(path.join(jobDirectory, "release-authorization.json"), "utf8"),
    );
    assert.equal(approval.authorizesUpload, false);
    assert.equal(approval.authorizesRelease, false);
    assert.deepEqual(authorization.targets, ["youtube"]);
    assert.equal(authorization.authorizesUpload, true);
    assert.equal(authorization.authorizesRelease, true);
    assert.equal((await fs.stat(path.join(jobDirectory, "release-authorization.json"))).mode & 0o777, 0o600);

    const status = runCli("status", packet.id);
    assert.equal(status.status, 0, status.stderr);
    assert.match(status.stdout, /Upload\/release authorization: granted for youtube by Otto/);
    assert.match(status.stdout, /Release authorization hash:/);

    const duplicate = runCli(
      "authorize",
      packet.id,
      "--hash",
      packet.approvalHash,
      "--by",
      "Otto",
      "--targets",
      "youtube",
      "--confirm",
      authorizationConfirmation,
    );
    assert.equal(duplicate.status, 1);
    assert.match(duplicate.stderr, /Refusing to overwrite existing file/i);

    authorization.targetBindings.youtube.schedule.finalVisibility = "unlisted";
    await fs.writeFile(
      path.join(jobDirectory, "release-authorization.json"),
      `${JSON.stringify(authorization, null, 2)}\n`,
      { mode: 0o600 },
    );
    const tamperedStatus = runCli("status", packet.id);
    assert.equal(tamperedStatus.status, 1);
    assert.match(tamperedStatus.stderr, /Release authorization integrity check failed/i);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
