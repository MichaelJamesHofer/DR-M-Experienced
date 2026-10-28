# Security Documentation

## Form Capture Security

The site is statically exported and captures contact/newsletter submissions through a Supabase Edge Function. Public browser requests post to the function; the function validates, rate-limits, and writes with server-side credentials.

## Supabase Controls

- Row Level Security is enabled on `contact_messages`.
- Row Level Security is enabled on `newsletter_subscriptions`.
- Public catalog child rows require a published episode, product, or blog parent.
- The editorial affiliate-match view is not available to public roles.
- No public read, insert, update, or delete policies are defined after the Edge Function path is live.
- Direct browser table access is blocked; the Edge Function is the receive-only path.
- Private rate-limit counters store hashed keys, not raw IP addresses.
- Rate-limit counters older than eight days are removed during normal form traffic.
- Database constraints enforce:
  - valid lower-case email format
  - maximum field lengths
  - non-empty names and messages
  - allowed contact subjects

## Client Controls

- Contact form validates required fields before insert.
- Newsletter form validates email before insert.
- Both forms trim user input.
- Both forms include a hidden honeypot field.
- The contact form requires the medical-advice acknowledgement checkbox.
- Duplicate newsletter subscriptions are handled as success.

## Key Handling

Safe for client-side use:

- `NEXT_PUBLIC_SUPABASE_URL`

Supabase publishable/anonymous keys may only be used with reviewed RLS policies. Never expose a Supabase secret or service-role key. Secret access must remain limited to Supabase Edge Functions, the Supabase dashboard, CLI, trusted administrative tooling, or server-side build steps whose output has been checked for leakage.

## Package Security

Run these checks before deploying:

```bash
npm run lint
npm run typecheck
npm run build
npm audit --audit-level=high
npm run test:dependencies
npm run test:database-security
```

The Edge Function must also pass Deno check, lint, and tests using `supabase/functions/deno.json` and `supabase/functions/deno.lock`.

### Temporary braces depth-guard backport

Last verified: October 5, 2026.

Tailwind 3 and Next's lint tooling depend on `braces` through Chokidar and
Micromatch. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects upstream `braces` through 3.0.3, with no patched release available.
The root override pins `braces` to the inspected
`npm:@dieub/braces-depth-guard@3.0.3-pn.0` backport; the lockfile pins the registry
tarball and SHA-512 integrity. This is a third-party derivative, not an upstream
release, and its bootstrap release has no GitHub OIDC provenance.

Compared with published `braces@3.0.3`, its runtime changes only add a maximum
nesting depth of 100 to parsing and recursive AST traversal, based on
[upstream PR 72](https://github.com/micromatch/braces/pull/72)'s initial guard
patch. Its entry point, utility functions, MIT license and `fill-range`
dependency are unchanged; it has no install lifecycle scripts. It preserves
upstream stringify behavior. It does not claim to bound expansion cardinality,
AST width, or malformed cyclic parent links; this site's consumers supply glob
strings, not external ASTs. Keep the exact pin until a replacement is reviewed.

`npm run test:dependencies` resolves the installed packages through their real
consumers and verifies deep-input rejection, direct AST traversal guards, brace
syntax compatibility, content-file discovery and Chokidar watching. CI runs it
alongside the unchanged `npm audit --audit-level=high` gate. A clean audit alone
is not evidence that a renamed fork fixes a vulnerability.

Remove this override when upstream publishes a release fixing the advisory:
update within compatible ranges, regenerate the lockfile, and rerun the audit,
dependency regressions, lint, typecheck, publisher tests and static build. Keep
the dependency regressions when returning to upstream. Tailwind remains on 3.x;
this repair requires no CSS migration or change to the Pages deployment gates.

### October 12 dependency audit repair

Last verified: October 12, 2026.

Scheduled Pages builds stopped at `npm audit --audit-level=high` after new
advisories affected the locked dependency tree. The repair pins Next and its
lint configuration to `15.5.27`, Sharp to `0.35.5`, and `source-map-js` to
`1.2.2`, the patched releases for
[Next cache poisoning](https://github.com/advisories/GHSA-4jqv-mc3x-m676),
[the related Next cache issue](https://github.com/advisories/GHSA-mcj8-r9mp-w47p),
[Sharp's librsvg vulnerability](https://github.com/advisories/GHSA-wq5f-xc86-pv6w),
and [source-map offset handling](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

Tailwind 3 and `postcss-nested` receive `postcss-selector-parser@7.1.6` through
an override for the
[flat-selector complexity advisory](https://github.com/advisories/GHSA-rj75-hqrm-r3gf).
This crosses the consumers' declared parser major range; dependency compatibility
tests exercise nested parent/attribute/pseudo selectors and Tailwind's hover,
group, arbitrary, responsive and reduced-motion variants. The complete static
build checks the actual site's styles. The existing braces backport and audit
threshold remain in place. Review this parser override when Tailwind 3's
dependencies adopt the patched parser upstream.

### October 22 dependency and security update

Last verified: October 22, 2026.

Update Next and its lint configuration to `15.5.28` for the
[Image Optimization SVG advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw)
and [App Router Server Actions DoS advisory](https://github.com/advisories/GHSA-p3m5-59mp-jv5r).
Update `posthog-js` to `^1.438.16` and pin `dompurify` to `3.4.17` for the
[DOMPurify shadow-root template bypass](https://github.com/advisories/GHSA-cg2g-xh64-v4q7),
[detached-subtree `IN_PLACE` hook handler advisory](https://github.com/advisories/GHSA-mrv2-3pqr-j5jr),
and [XHTML SMIL `href` guard advisory](https://github.com/advisories/GHSA-c6gr-qvv4-5v3f).

Compatible dependencies are updated in lockstep without changing major framework
contracts: `postcss@8.5.31`, `postcss-selector-parser@7.1.7`, `tailwindcss@^3.4.19`,
`fast-xml-parser@^5.11.2`, `lucide-react@^1.61.0`, `react@18.3.1`, `react-dom@18.3.1`,
`@types/node@20.19.43`, `@types/react@18.3.31`, and Edge Function
`jsr:@supabase/supabase-js@2.118.0`.

### October 28 dependency and CVE review

Last verified: October 28, 2026.

Verified that `fast-uri@3.1.9` covers the October 23 URI validation advisories
([GHSA-w74x-v6f9-j3xg](https://github.com/advisories/GHSA-w74x-v6f9-j3xg),
[GHSA-xhq7-xmqj-769h](https://github.com/advisories/GHSA-xhq7-xmqj-769h),
[GHSA-wjr9-j795-jxcr](https://github.com/advisories/GHSA-wjr9-j795-jxcr), and
[GHSA-333x-w4r6-6crp](https://github.com/advisories/GHSA-333x-w4r6-6crp)).
Although [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
was withdrawn on October 23, 2026, upstream `braces` remains at `3.0.3` without
a nesting depth guard; the `npm:@dieub/braces-depth-guard@3.0.3-pn.0` override
and depth-guard regression tests remain in place until an upstream release
supersedes `3.0.3`.

Compatible packages are updated to `postcss@8.5.32`, `posthog-js@^1.441.2`,
`lucide-react@^1.63.0`, `@typescript-eslint/*@8.72.1`, `ignore@7.0.14`, and
`@napi-rs/wasm-runtime@1.2.6`.

## Reporting A Vulnerability

Do not disclose suspected credentials or exploitable details in a public issue. Use GitHub's private vulnerability-reporting flow when available, or contact the repository owner privately through GitHub.

## Monitoring

Monitor Supabase for unusual function invocation volume, validation failures, rate-limit hits, and database growth. If spam becomes a problem beyond the current rate limits, add CAPTCHA such as Cloudflare Turnstile in the Edge Function path.
