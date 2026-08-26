import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { verifyAppleRepublishCanaryDeployment } from "./verify-apple-republish-canary-deployment.mjs";

const config = {
  sourceFeedUrl: "https://source.example.test/feed.xml",
  appleShowId: "1870433419",
  canary: {
    episodeNumber: 1,
    candidateGuid: { value: "4111e441-c542-50f8-95de-3031c2b27f56" },
  },
};
const activeConfig = {
  publicFeedUrl: "https://public.example.test/apple-podcasts/feed.xml",
};

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function verificationHarness({
  sourceXml = "<rss><channel>source-stable</channel></rss>",
  candidateForSource = (xml) =>
    xml.replace("source-stable", "candidate-stable"),
  cacheBustedXml,
  bareXml,
} = {}) {
  const events = [];
  const expectedXml = candidateForSource(
    "<rss><channel>source-stable</channel></rss>",
  );
  const dependencies = {
    loadAuthorities: async () => {
      events.push("authorities");
      return { config, activeConfig };
    },
    fetchSource: async (url, options) => {
      events.push(`source:${options.cacheBust}`);
      assert.equal(url, config.sourceFeedUrl);
      return { xml: sourceXml };
    },
    buildOverlay: (xml, observedActiveConfig, observedConfig) => {
      events.push("build");
      assert.equal(observedActiveConfig, activeConfig);
      assert.equal(observedConfig, config);
      return { xml: candidateForSource(xml) };
    },
    fetchPublished: async (url, options) => {
      const kind = options.cacheBust === null ? "bare" : "cache-busted";
      events.push(`${kind}:${options.cacheBust}`);
      assert.equal(url, activeConfig.publicFeedUrl);
      return {
        xml:
          kind === "bare"
            ? (bareXml ?? expectedXml)
            : (cacheBustedXml ?? expectedXml),
      };
    },
    verifyMedia: async (observedConfig) => {
      events.push("media");
      assert.equal(observedConfig, config);
      return { sha256: "media-verified" };
    },
  };
  return {
    dependencies,
    events,
    expectedXml,
    expectedFeedSha256: sha256(expectedXml),
  };
}

test("canary deployment verification binds the fetched source projection to the expected candidate hash", async () => {
  const harness = verificationHarness();
  const report = await verifyAppleRepublishCanaryDeployment({
    cacheBust: "run-42",
    expectedFeedSha256: harness.expectedFeedSha256,
    dependencies: harness.dependencies,
  });

  assert.deepEqual(harness.events, [
    "authorities",
    "source:run-42-source",
    "build",
    "cache-busted:run-42-feed",
    "bare:null",
    "media",
  ]);
  assert.equal(report.publicFeedSha256, harness.expectedFeedSha256);
  assert.equal(report.bareFeedSha256, harness.expectedFeedSha256);
  assert.equal(report.exactCandidateFeed, true);
  assert.equal(report.bareUrlVerified, true);
  assert.deepEqual(report.media, { sha256: "media-verified" });
});

test("source drift changes the projection and fails before any public or media verification", async () => {
  const harness = verificationHarness({
    sourceXml: "<rss><channel>source-drifted</channel></rss>",
  });

  await assert.rejects(
    verifyAppleRepublishCanaryDeployment({
      cacheBust: "run-source-drift",
      expectedFeedSha256: harness.expectedFeedSha256,
      dependencies: harness.dependencies,
    }),
    /Expected canary feed SHA does not match the current canonical projection/,
  );
  assert.deepEqual(harness.events, [
    "authorities",
    "source:run-source-drift-source",
    "build",
  ]);
});

test("cache-busted public feed must equal the source-bound candidate before later checks", async () => {
  const harness = verificationHarness({
    cacheBustedXml: "<rss><channel>cache-stale</channel></rss>",
  });

  await assert.rejects(
    verifyAppleRepublishCanaryDeployment({
      cacheBust: "run-cache-stale",
      expectedFeedSha256: harness.expectedFeedSha256,
      dependencies: harness.dependencies,
    }),
    /Published Apple feed is not the exact candidate artifact/,
  );
  assert.deepEqual(harness.events, [
    "authorities",
    "source:run-cache-stale-source",
    "build",
    "cache-busted:run-cache-stale-feed",
  ]);
});

test("bare public feed must also equal the candidate before media verification", async () => {
  const harness = verificationHarness({
    bareXml: "<rss><channel>bare-stale</channel></rss>",
  });

  await assert.rejects(
    verifyAppleRepublishCanaryDeployment({
      cacheBust: "run-bare-stale",
      expectedFeedSha256: harness.expectedFeedSha256,
      dependencies: harness.dependencies,
    }),
    /Bare Apple feed URL is not the exact candidate artifact/,
  );
  assert.deepEqual(harness.events, [
    "authorities",
    "source:run-bare-stale-source",
    "build",
    "cache-busted:run-bare-stale-feed",
    "bare:null",
  ]);
});
