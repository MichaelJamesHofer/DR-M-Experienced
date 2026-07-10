export type FormType = "contact" | "newsletter";

type SubmissionMetadata = {
  pageUrl: string | null;
  userAgent: string | null;
};

export type ValidSubmission =
  | (SubmissionMetadata & {
    type: "newsletter";
    email: string;
    source: string;
  })
  | (SubmissionMetadata & {
    type: "contact";
    email: string;
    name: string;
    subject: string;
    message: string;
  });

export type SubmissionParseResult =
  | { kind: "valid"; submission: ValidSubmission }
  | { kind: "honeypot" }
  | { kind: "invalid" };

const SUBJECTS = new Set(["podcast", "business", "press", "other"]);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function nullableText(value: unknown, maxLength: number): string | null {
  const sanitized = sanitizeText(value, maxLength);
  return sanitized || null;
}

function normalizeEmail(value: unknown): string {
  return sanitizeText(value, 255).toLowerCase();
}

function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email) && email.length <= 255;
}

export function parseSubmission(payload: unknown): SubmissionParseResult {
  if (!isRecord(payload)) return { kind: "invalid" };
  if (sanitizeText(payload.website, 200)) return { kind: "honeypot" };

  const type = payload.type;
  const email = normalizeEmail(payload.email);
  if ((type !== "contact" && type !== "newsletter") || !isValidEmail(email)) {
    return { kind: "invalid" };
  }

  const metadata: SubmissionMetadata = {
    pageUrl: nullableText(payload.page_url, 1000),
    userAgent: nullableText(payload.user_agent, 500),
  };

  if (type === "newsletter") {
    return {
      kind: "valid",
      submission: {
        type,
        email,
        source: sanitizeText(payload.source, 50) || "unknown",
        ...metadata,
      },
    };
  }

  const name = sanitizeText(payload.name, 200);
  const subject = sanitizeText(payload.subject, 200);
  const message = sanitizeText(payload.message, 5000);
  if (payload.consent !== true || !name || !message || !SUBJECTS.has(subject)) {
    return { kind: "invalid" };
  }

  return {
    kind: "valid",
    submission: {
      type,
      email,
      name,
      subject,
      message,
      ...metadata,
    },
  };
}
