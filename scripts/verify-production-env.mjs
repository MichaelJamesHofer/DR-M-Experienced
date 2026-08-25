const postHogTokenVariables = [
  "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN",
  "NEXT_PUBLIC_POSTHOG_API_KEY",
];

const hasPostHogToken = postHogTokenVariables.some(
  (name) => process.env[name]?.trim(),
);

if (!hasPostHogToken) {
  console.error(
    `Production environment check failed: configure ${postHogTokenVariables.join(" or ")}.`,
  );
  process.exitCode = 1;
} else {
  console.log("Production environment check passed.");
}
