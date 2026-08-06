# Dr. M Ecosystem Operating Contract

This repository is the operating home for the website, podcast distribution,
social publishing, brand identity, and recovery procedures for Dr. M
Experienced, with Dr. David Musnick.

## Read First

Before taking action, read these sources in order:

1. `AGENTS.md`
2. `publishing/hosting-migration.json`
3. `publishing/platforms.json`
4. `docs/operations-manual.md`
5. The focused runbook linked by the task

Run these read-only checks at the beginning of an operating session:

```bash
cd /home/otto/DR-M-Experienced-ops
git status --short --branch
/home/otto/.local/bin/drm-publish doctor
/home/otto/.local/bin/drm-browser status
```

The RSS.com host cutover is complete. RSS.com is canonical at
`https://media.rss.com/dr-m-experienced/feed.xml`; the legacy Anchor URL returns
one HTTP 301 hop to that exact feed. Apple show `1870433419` is configured
directly to RSS.com. Apple draft/public-count cleanup, Amazon's one-time claim,
and directory cache convergence are downstream work, not reasons to recreate a
show or switch the canonical host.

## Operating Role

- When requested, directly help manage profile metadata, show settings, drafts,
  uploads, and verification through official APIs or the isolated local browser.
  Do not hand routine account work back to the user when the approved action can
  be performed safely from this machine.
- Treat a logged-in browser session as a capability, not blanket authorization.
- Exact, user-approved profile text may be entered and verified. An episode may
  be prepared and uploaded as a draft or private item only after the exact media
  and destination are approved for upload.
- Public release, scheduling, visibility, audience, synthetic-media disclosure,
  paid promotion, monetization, licensing, notifications, and changed copy need
  fresh approval for their exact values.
- Stop for MFA, CAPTCHA, reauthentication, agreements, payment, identity checks,
  or any prompt that asks the user to attest facts.
- Account deletion, show deletion, permanent redirects, archive actions,
  credential export, and irreversible directory changes always require explicit
  approval after current evidence is reviewed.

## Hard Invariants

- Preserve Apple public show ID `1870433419` and Spotify show ID
  `7GGLljxmO0G3FLjPy8vfcw`. Do not create replacement listings.
- Do not delete or reset the live Apple show. The separate nonpublic Draft show
  `1896845422` is handled only after the live show is healthy and its contents
  have been inspected.
- The imported RSS.com feed is
  `https://media.rss.com/dr-m-experienced/feed.xml`. It preserves all seven
  GUIDs, titles, episode numbers, dates, playable byte-identical enclosures, and
  3000 x 3000 artwork. Its canonical metadata is exact, `RSSVERIFY` is absent,
  and no stray Season 1 metadata remains. Do not recreate those episodes or
  submit duplicate shows.
- Preserve the legacy Anchor URL and Spotify account. The old feed returns one
  HTTP 301 hop to RSS.com; do not remove or reverse that redirect merely because
  a directory or cache has not converged yet.
- Spotify receives podcast audio from RSS.com. For a video episode, first wait
  for the RSS item to appear in the existing Spotify show, then use Spotify for
  Creators to replace that episode's audio with the approved full video. Never
  create a second Spotify episode or directly upload fallback podcast audio.
- Never change podcast GUIDs during metadata, title, or directory cleanup.
- Public episode titles omit `Episode N`; the number remains required structured
  internal/RSS metadata. Apply the approved seven-title transition as one
  coordinated batch and preserve every remote content ID.
- Apple must continue to use public show `1870433419`, which was configured
  directly to RSS.com on August 6, 2026 at approximately 18:29 UTC. Its title
  and description are exact and contain no `RSSVERIFY`, but only five episodes
  are Available; Episodes 1 and 2 and a stale duplicate Episode 4 remain Draft.
  Repair that listing in place and archive only inspected, redundant drafts.
- Amazon has no claimed show yet. Submit the canonical RSS.com feed once,
  complete the required owner attestations manually, and record the resulting
  stable show ID and URL. Never submit the legacy Anchor URL.
- `publishing/master-catalog.json` is the distribution metadata authority.
  Supabase remains the production authority for website-only editorial content;
  overlapping identity/title/audio fields are verified projections of the
  master. The production seven-row episode audio migration and exact catalog
  readback passed on August 6, 2026.
- Dropbox is binary storage, not metadata authority. Configure only a
  project-scoped synced root outside git, use portable logical references, and
  verify hashes before preparation or upload.
- Work on a branch, preserve unrelated changes, require passing CI, and verify
  the live website after deployment.

## Browser And Secrets

- Use `/home/otto/.local/bin/drm-browser`; it owns one isolated Chrome data
  directory at `~/.local/share/drm-publisher/chrome-profile` with two identities.
  `Default` is `drmexperienced@gmail.com` for RSS.com, Spotify, Apple, Amazon,
  YouTube, Vimeo, Instagram, and Rumble. `Profile 1` is
  `ottotheautonomous@gmail.com` for GitHub and Supabase. Run
  `drm-browser identities` to verify the mapping before account work.
- Never sign out the DRM identity, swap its publishing sessions into the Otto
  profile, or copy authentication material between profiles. Use only one
  connected bridge scope at a time; switching scopes must preserve the open
  tabs and saved sessions in both profiles.
- When a saved session needs human reauthentication, run
  `drm-browser reauth <platform>`. This stops the automation bridge and opens
  that dashboard in its assigned profile within the same isolated browser
  process so OAuth and the profile keychain work without losing either identity.
  Reconnect only after the authenticated dashboard is open.
- Never attach automation to Otto's normal Chrome profile, copy cookies, print
  tokens, or place credentials in the repository.
- Run account tooling as Otto. When a root shell is unavoidable, use the local
  wrappers or `runuser` with Otto's `HOME`, `USER`, runtime directory, D-Bus, and
  `PATH`; a root-context credential result is not evidence of Otto's state.
- Automatic desktop login cannot securely unlock GNOME Keyring at boot. Unlock
  it interactively once after reboot; do not store the login password in a
  script or weaken the keyring to suppress that prompt.

## Documentation Duty

After an account, feed, stable ID, workflow, or recovery state changes:

1. Update the appropriate machine-readable JSON file.
2. Update the focused runbook and its `Last verified` date.
3. Update `docs/operations-manual.md` if the ecosystem contract changed.
4. Record returned remote IDs and URLs without recording secrets.
5. Verify the public result independently before reporting completion.
