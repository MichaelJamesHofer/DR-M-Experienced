import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAppleFeedOverlay,
  loadAppleFeedOverlayConfig,
} from "./apple-feed-overlay.mjs";
import { verifyAppleFeedDeployment } from "./verify-apple-feed-deployment.mjs";

const config = await loadAppleFeedOverlayConfig();
const episodes = [
  [8, "Food and the Brain - Eating for Brain Health and Concussion Recovery", "3096546", "4587dd48-8a26-4341-b194-8764500d74ef"],
  [7, "The Brain on Fire - Neuroinflammation After Concussion", "3050760", "4a0b3903-b7d1-4ced-967b-079df4004a4e"],
  [6, "Concussion - What Happens in the Brain", "3050761", "13a0565e-582c-4969-a57d-9700b7babbe4"],
  [5, "Energy - Understanding Fatigue and Mitochondrial Health", "3050762", "e9f7596f-0333-49ca-8946-bc11e96b2091"],
  [4, "Electromagnetic Frequencies (EMF) - Practical Ways to Reduce Exposure", "3050763", "9579ff89-9e16-40db-b84a-00cee25c604a"],
  [3, "Insomnia - Causes and Practical Sleep Strategies", "3050764", "e4bde82f-54e6-43a2-a50a-4044f9cdbe8e"],
  [2, "Brain Fog, Part 2 - Testing and Basic Solutions", "3050765", "1e40e02b-b217-477c-9cc3-4271cb304c23"],
  [1, "Brain Fog, Part 1 - Is Your Brain in a Fog?", "3050766", "c9b853b6-a828-4012-9998-217919ff9163"],
];

function sourceFeedXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Dr. M Experienced, with Dr. David Musnick</title>
    <atom:link href="${config.sourceSelfUrl}" rel="self" type="application/rss+xml"/>
    ${episodes
      .map(
        ([number, title, rssComEpisodeId, guid]) => `<item>
      <title>${title}</title>
      <link>https://rss.com/podcasts/dr-m-experienced/${rssComEpisodeId}</link>
      <guid isPermaLink="false">${guid}</guid>
      <enclosure url="https://content.example.test/${number}.mp3" length="${10_000 + number}" type="audio/mpeg"/>
      <itunes:episode>${number}</itunes:episode>
      <pubDate>Tue, ${String(number).padStart(2, "0")} Jan 2026 08:00:00 GMT</pubDate>
    </item>`,
      )
      .join("\n    ")}
  </channel>
</rss>`;
}

function responseAt(url, body, init) {
  const response = new Response(body, init);
  Object.defineProperty(response, "url", { value: String(url) });
  return response;
}

function xmlResponse(url, xml, contentType = "application/rss+xml") {
  return responseAt(url, xml, {
    status: 200,
    headers: { "content-type": contentType },
  });
}

test("post-deploy verification polls the exact URL until the deployed artifact is live", async () => {
  const source = sourceFeedXml();
  const expected = buildAppleFeedOverlay(source, config);
  const publicRequests = [];
  let bareRequests = 0;
  const delays = [];

  const report = await verifyAppleFeedDeployment({
    cacheBust: "deploy-42",
    maxAttempts: 5,
    pollIntervalMs: 25,
    sleepImpl: async (milliseconds) => delays.push(milliseconds),
    expectedSha256: expected.report.outputSha256,
    fetchImpl: async (url, options) => {
      const requestUrl = new URL(url);
      assert.equal(options.headers["Cache-Control"], "no-cache");
      assert.equal(
        `${requestUrl.origin}${requestUrl.pathname}`,
        config.publicFeedUrl,
      );
      const requestMarker = requestUrl.searchParams.get("apple_overlay_verify");
      if (requestMarker === null) {
        bareRequests += 1;
        return bareRequests === 1
          ? xmlResponse(url, expected.xml.replace("</channel>", "<!-- bare stale --></channel>"))
          : xmlResponse(url, expected.xml);
      }
      publicRequests.push(requestMarker);
      if (publicRequests.length === 1) {
        return responseAt(url, "not found", { status: 404 });
      }
      if (publicRequests.length === 2) {
        return xmlResponse(url, "<rss>");
      }
      if (publicRequests.length === 3) {
        return xmlResponse(url, expected.xml.replace("</channel>", "<!-- stale --></channel>"));
      }
      return xmlResponse(url, expected.xml);
    },
  });

  assert.deepEqual(publicRequests, [
    "deploy-42-1",
    "deploy-42-2",
    "deploy-42-3",
    "deploy-42-4",
    "deploy-42-5",
  ]);
  assert.equal(bareRequests, 2);
  assert.deepEqual(delays, [25, 25, 25, 25]);
  assert.equal(report.attempts, 5);
  assert.equal(report.publicFeedUrl, config.publicFeedUrl);
  assert.equal(report.httpStatus, 200);
  assert.equal(report.publicSha256, expected.report.outputSha256);
  assert.equal(report.expectedSha256, expected.report.outputSha256);
  assert.equal(report.exactDeployedArtifact, true);
  assert.equal(report.bareUrlVerified, true);
});

test("post-deploy verification fails closed on a non-XML public response", async () => {
  const source = sourceFeedXml();
  const expected = buildAppleFeedOverlay(source, config);
  let publicAttempts = 0;

  await assert.rejects(
    verifyAppleFeedDeployment({
      cacheBust: "deploy-bad",
      maxAttempts: 2,
      pollIntervalMs: 0,
      expectedSha256: expected.report.outputSha256,
      fetchImpl: async (url) => {
        publicAttempts += 1;
        return xmlResponse(url, "<html></html>", "text/html");
      },
    }),
    /did not verify after 2 attempts: Published Apple feed returned text\/html/,
  );
  assert.equal(publicAttempts, 2);
});

test("post-deploy verification rejects redirects outside the approved feed path", async () => {
  const source = sourceFeedXml();
  const expected = buildAppleFeedOverlay(source, config);

  await assert.rejects(
    verifyAppleFeedDeployment({
      cacheBust: "deploy-redirect",
      maxAttempts: 1,
      pollIntervalMs: 0,
      expectedSha256: expected.report.outputSha256,
      fetchImpl: async () =>
        xmlResponse("https://example.test/feed.xml", expected.xml),
    }),
    /redirected outside its approved origin and path/,
  );
});

test("post-deploy verification requires the generated artifact hash", async () => {
  await assert.rejects(
    verifyAppleFeedDeployment({
      expectedSha256: null,
      maxAttempts: 1,
      pollIntervalMs: 0,
      fetchImpl: async () => {
        throw new Error("network must not be reached");
      },
    }),
    /expectedSha256 must be the lowercase SHA-256/,
  );
});
