import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  DropboxIntakeError,
  scanDropboxInbox,
  sealDeliveryBundle,
  validateDeliveryBundle,
} from "./dropbox-intake.mjs";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(moduleDirectory, "../..");
const catalogPath = path.join(projectRoot, "publishing", "master-catalog.json");
const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
const catalogEpisode = catalog.episodes.find((episode) => episode.number === 1);

function vimeoReleasePlan() {
  return {
    releaseMode: "hold",
    initialVisibility: "nobody",
    finalVisibility: "anybody",
    license: "none",
    monetization: "unchanged",
    notifications: "disabled",
  };
}

function rumbleReleasePlan() {
  return {
    releaseMode: "hold",
    initialVisibility: "unlisted",
    finalVisibility: "unlisted",
    license: "rumble_only_option_c",
    monetization: "enabled",
    notifications: "disabled",
    syndication: { youtube: false, vimeo: false, facebook: false },
    premiumExclusive: false,
    termsRevision: "2026-07-21",
    humanAttestation: {
      termsAcceptance: "human_only_not_recorded",
      rightsConfirmation: "human_only_not_recorded",
      aiMlLicenseAcknowledgement: "human_only_not_recorded",
      thirdPartyRightsConfirmation: "human_only_not_recorded",
    },
  };
}

function episodeManifest(overrides = {}) {
  return {
    episodeNumber: catalogEpisode.number,
    slug: catalogEpisode.slug,
    title: catalogEpisode.title,
    description: catalogEpisode.description.full,
    publishAt: null,
    explicit: false,
    madeForKids: false,
    containsSyntheticMedia: false,
    paidPromotion: false,
    tags: ["brain health"],
    category: "Health & Fitness",
    assets: { fullVideo: "master-video.mp4" },
    copy: { vimeo: null },
    releasePlan: { vimeo: vimeoReleasePlan() },
    targets: ["vimeo"],
    ...overrides,
  };
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function fixture(context, { manifest = episodeManifest(), deliveryId = "episode-001-final" } = {}) {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "drm-dropbox-intake-"));
  context.after(() => fs.rm(temporary, { recursive: true, force: true }));
  const inbox = path.join(temporary, "inbox");
  const bundle = path.join(inbox, deliveryId);
  const stateRoot = path.join(temporary, "state");
  await fs.mkdir(bundle, { recursive: true, mode: 0o700 });
  await fs.chmod(inbox, 0o700);
  await fs.chmod(bundle, 0o700);
  await writeJson(path.join(bundle, "episode.json"), manifest);
  for (const filename of Object.values(manifest.assets).filter(Boolean)) {
    await fs.writeFile(path.join(bundle, filename), `asset bytes for ${filename}\n`, { mode: 0o600 });
  }
  return { temporary, inbox, bundle, stateRoot, deliveryId };
}

test("a sealed delivery prepares exactly once and remains idempotent", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, {
    deliveryId: item.deliveryId,
    catalogPath,
    now: () => new Date("2026-08-08T18:00:00Z"),
  });
  let prepareCalls = 0;
  const prepareRunner = async () => {
    prepareCalls += 1;
    return { jobId: "brain-fog-part-1-20260808t180000z" };
  };

  const first = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    projectRoot,
    prepareRunner,
    now: () => new Date("2026-08-08T18:01:00Z"),
  });
  const second = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    projectRoot,
    prepareRunner,
  });

  assert.deepEqual(first, [{
    deliveryId: item.deliveryId,
    status: "prepared",
    jobId: "brain-fog-part-1-20260808t180000z",
  }]);
  assert.deepEqual(second, [{
    deliveryId: item.deliveryId,
    status: "already_prepared",
    jobId: "brain-fog-part-1-20260808t180000z",
  }]);
  assert.equal(prepareCalls, 1);
  const statePath = path.join(item.stateRoot, `${item.deliveryId}.json`);
  assert.equal((await fs.stat(statePath)).mode & 0o777, 0o600);
  assert.equal(JSON.parse(await fs.readFile(statePath, "utf8")).status, "prepared");
});

test("validate-only does not create state or invoke prepare", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  let prepareCalls = 0;
  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    validateOnly: true,
    prepareRunner: async () => {
      prepareCalls += 1;
      return { jobId: "unexpected" };
    },
  });
  assert.deepEqual(result, [{ deliveryId: item.deliveryId, status: "validated" }]);
  assert.equal(prepareCalls, 0);
  await assert.rejects(fs.stat(item.stateRoot), { code: "ENOENT" });
});

test("an unsealed directory is ignored", async (context) => {
  const item = await fixture(context);
  let prepareCalls = 0;
  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner: async () => {
      prepareCalls += 1;
      return { jobId: "unexpected" };
    },
  });
  assert.deepEqual(result, []);
  assert.equal(prepareCalls, 0);
});

test("explicit episode identity must match across both metadata files", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  const envelopePath = path.join(item.bundle, "delivery.json");
  const envelope = JSON.parse(await fs.readFile(envelopePath, "utf8"));
  envelope.episodeNumber = 2;
  await writeJson(envelopePath, envelope);

  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner: async () => assert.fail("prepare must not run"),
  });
  assert.deepEqual(result, [{
    deliveryId: item.deliveryId,
    status: "rejected",
    reasonCode: "episode_identity_mismatch",
  }]);
});

test("asset hash drift is rejected before prepare", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  await fs.appendFile(path.join(item.bundle, "master-video.mp4"), "changed\n");
  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner: async () => assert.fail("prepare must not run"),
  });
  assert.equal(result[0].status, "rejected");
  assert.equal(result[0].reasonCode, "size_mismatch");
});

test("group-writable media is rejected before prepare", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  await fs.chmod(path.join(item.bundle, "master-video.mp4"), 0o620);
  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner: async () => assert.fail("prepare must not run"),
  });
  assert.equal(result[0].status, "rejected");
  assert.equal(result[0].reasonCode, "insecure_input");
});

test("catalog metadata drift is rejected before a bundle can be sealed", async (context) => {
  const item = await fixture(context, {
    manifest: episodeManifest({ title: "A filename must not become episode identity" }),
  });
  await assert.rejects(
    sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath }),
    (error) => error instanceof DropboxIntakeError && error.code === "catalog_metadata_mismatch",
  );
  await assert.rejects(fs.stat(path.join(item.bundle, "READY")), { code: "ENOENT" });
});

test("undeclared files are rejected without naming them in the result", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  await fs.writeFile(path.join(item.bundle, "client-secret.txt"), "do not inspect\n", { mode: 0o600 });
  const result = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner: async () => assert.fail("prepare must not run"),
  });
  assert.deepEqual(result, [{
    deliveryId: item.deliveryId,
    status: "rejected",
    reasonCode: "undeclared_bundle_entry",
  }]);
  assert.equal(JSON.stringify(result).includes("client-secret"), false);
});

test("Rumble is excluded from sealing and automated intake", async (context) => {
  const manifest = episodeManifest({
    releasePlan: { vimeo: vimeoReleasePlan(), rumble: rumbleReleasePlan() },
    targets: ["vimeo", "rumble"],
  });
  const item = await fixture(context, { manifest });
  await assert.rejects(
    sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath }),
    (error) => error instanceof DropboxIntakeError && error.code === "rumble_forbidden",
  );
  await assert.rejects(fs.stat(path.join(item.bundle, "READY")), { code: "ENOENT" });
});

test("a failed prepare claim blocks automatic duplicate creation", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  let prepareCalls = 0;
  const prepareRunner = async () => {
    prepareCalls += 1;
    throw new DropboxIntakeError("prepare_failed", "simulated");
  };
  const first = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner,
  });
  const second = await scanDropboxInbox({
    inbox: item.inbox,
    stateRoot: item.stateRoot,
    catalogPath,
    prepareRunner,
  });
  assert.equal(first[0].status, "manual_recovery_required");
  assert.equal(second[0].status, "manual_recovery_required");
  assert.equal(prepareCalls, 1);
});

test("symbolic-link media cannot cross the delivery boundary", async (context) => {
  const item = await fixture(context);
  await sealDeliveryBundle(item.bundle, { deliveryId: item.deliveryId, catalogPath });
  const assetPath = path.join(item.bundle, "master-video.mp4");
  const external = path.join(item.temporary, "external.mp4");
  await fs.writeFile(external, "asset bytes for master-video.mp4\n", { mode: 0o600 });
  await fs.rm(assetPath);
  await fs.symlink(external, assetPath);
  await assert.rejects(
    validateDeliveryBundle(item.bundle, { catalogPath }),
    (error) =>
      error instanceof DropboxIntakeError &&
      ["insecure_input", "undeclared_bundle_entry"].includes(error.code),
  );
});
