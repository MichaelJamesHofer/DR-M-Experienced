import { parseSubmission, sanitizeText } from "./validation.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("parses and normalizes a valid contact submission", () => {
  const result = parseSubmission({
    type: "contact",
    email: "  Listener@Example.com ",
    name: "  Listener  ",
    subject: "podcast",
    message: "  Useful episode.  ",
    consent: true,
    page_url: "https://drmexperienced.com/contact/",
    user_agent: "audit-agent",
  });

  assert(result.kind === "valid", "expected a valid contact submission");
  assert(result.submission.type === "contact", "expected contact type");
  assert(
    result.submission.email === "listener@example.com",
    "email was not normalized",
  );
  assert(result.submission.name === "Listener", "name was not trimmed");
  assert(
    result.submission.message === "Useful episode.",
    "message was not trimmed",
  );
});

Deno.test("rejects malformed contact submissions before rate limiting", () => {
  const base = {
    type: "contact",
    email: "listener@example.com",
    name: "Listener",
    subject: "podcast",
    message: "Message",
    consent: true,
  };

  for (
    const payload of [
      null,
      [],
      { ...base, consent: false },
      { ...base, name: "" },
      { ...base, subject: "medical-advice" },
      { ...base, email: "not-an-email" },
    ]
  ) {
    assert(
      parseSubmission(payload).kind === "invalid",
      "malformed contact payload was accepted",
    );
  }
});

Deno.test("recognizes the honeypot before validating other fields", () => {
  assert(
    parseSubmission({ website: "https://spam.invalid" }).kind === "honeypot",
    "honeypot payload was not recognized",
  );
});

Deno.test("normalizes newsletter defaults and metadata limits", () => {
  const result = parseSubmission({
    type: "newsletter",
    email: "NEWS@EXAMPLE.COM",
    source: "x".repeat(70),
    page_url: "p".repeat(1100),
    user_agent: "u".repeat(600),
  });

  assert(result.kind === "valid", "expected a valid newsletter submission");
  assert(result.submission.type === "newsletter", "expected newsletter type");
  assert(
    result.submission.source.length === 50,
    "source limit was not enforced",
  );
  assert(
    result.submission.pageUrl?.length === 1000,
    "page URL limit was not enforced",
  );
  assert(
    result.submission.userAgent?.length === 500,
    "user-agent limit was not enforced",
  );
});

Deno.test("sanitizeText ignores non-string input", () => {
  assert(sanitizeText(42, 10) === "", "non-string input should be ignored");
});
