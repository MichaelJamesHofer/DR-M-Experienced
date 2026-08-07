const requiredVariables = ["NEXT_PUBLIC_POSTHOG_API_KEY"];

const missingVariables = requiredVariables.filter(
  (name) => !process.env[name]?.trim(),
);

if (missingVariables.length > 0) {
  console.error(
    `Production environment check failed: missing ${missingVariables.join(", ")}.`,
  );
  process.exitCode = 1;
} else {
  console.log("Production environment check passed.");
}
