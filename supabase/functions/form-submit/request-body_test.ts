import { readJsonBody } from "./request-body.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function assertRejects(promise: Promise<unknown>, message: string) {
  try {
    await promise;
  } catch {
    return;
  }
  throw new Error(message);
}

Deno.test("reads a JSON request within the byte limit", async () => {
  const payload = await readJsonBody(
    new Request("https://example.test", {
      method: "POST",
      body: JSON.stringify({ type: "newsletter" }),
    }),
    100,
  );

  assert(
    typeof payload === "object" && payload !== null,
    "expected a parsed object",
  );
});

Deno.test("rejects an oversized declared content length", async () => {
  await assertRejects(
    readJsonBody(
      new Request("https://example.test", {
        method: "POST",
        headers: { "content-length": "101" },
        body: "{}",
      }),
      100,
    ),
    "oversized declared body was accepted",
  );
});

Deno.test("stops reading a streamed body at the byte limit", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(60));
      controller.enqueue(new Uint8Array(60));
      controller.close();
    },
  });

  await assertRejects(
    readJsonBody(
      new Request("https://example.test", { method: "POST", body }),
      100,
    ),
    "oversized streamed body was accepted",
  );
});

Deno.test("rejects malformed JSON", async () => {
  await assertRejects(
    readJsonBody(
      new Request("https://example.test", { method: "POST", body: "{" }),
      100,
    ),
    "malformed JSON was accepted",
  );
});
