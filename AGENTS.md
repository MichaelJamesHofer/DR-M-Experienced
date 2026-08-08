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

Apple replied on August 7 under case `20000130526608`: its existing Episode 1
and 2 records contain historical GUIDs that differ from the current feed. The
blocked repair crosswalk and gates are in `publishing/apple-guid-repair.json`.
Do not change either live GUID until Apple-side remapping, RSS.com in-place edit
capability, and Spotify identity preservation have been reviewed. On August 7,
corrected video was restored against
all seven existing Spotify episode IDs after the masters passed the loudness and
sync checks in `publishing/audio-replacement-audit.json`; independent public
checks now report video, exact copy, and approved artwork for all seven.

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
- Do not delete or reset the live Apple show. The inspected, nonpublic Draft
  show `1896845422` was archived on August 6, 2026; do not restore or recreate it
  unless new evidence shows that it contained unique configuration.
- The imported RSS.com feed is
  `https://media.rss.com/dr-m-experienced/feed.xml`. It preserves all seven
  captured August 5 GUIDs, titles, episode numbers, dates, playable enclosures,
  and 3000 x 3000 artwork. Its canonical metadata is exact, `RSSVERIFY` is
  absent, and no stray Season 1 metadata remains. Apple later supplied older
  GUID evidence for Episodes 1-2; that is a controlled identity-repair incident,
  not permission to recreate episodes or submit duplicate shows.
- Preserve the legacy Anchor URL and Spotify account. The old feed returns one
  HTTP 301 hop to RSS.com; do not remove or reverse that redirect merely because
  a directory or cache has not converged yet.
- Spotify receives podcast audio from RSS.com. For a video episode, first wait
  for the RSS item to appear in the existing Spotify show, then use Spotify for
  Creators to replace that episode's audio with the approved full video. Never
  create a second Spotify episode or directly upload fallback podcast audio.
- Never change podcast GUIDs during metadata, title, or directory cleanup. The
  only pending exception is the support-confirmed Apple repair recorded in
  `publishing/apple-guid-repair.json`, and every gate there must pass before a
  remote write.
- Public episode titles omit `Episode N`; the number remains required structured
  internal/RSS metadata. Apply the approved seven-title transition as one
  coordinated batch and preserve every remote content ID.
- Apple must continue to use public show `1870433419`, which was configured
  directly to RSS.com on August 6, 2026 at approximately 18:29 UTC. Its title
  and description are exact and contain no `RSSVERIFY`, but only five episodes
  are Available. The duplicate show and stale manual Episode 4 Draft were
  archived after inspection; RSS Episodes 1 and 2 remain `DRAFTING` and `HIDDEN`
  despite valid source items and audio. Repair that listing in place through
  the submitted Apple support request; do not recreate or manually upload those
  episodes.
- The seven current RSS audio enclosures are the August 7 normalized replacements.
  They measure between `-16.91` and `-16.75` LUFS with true peak no higher than
  `-1.86 dBTP`; their exact remote bytes fully decode and their captured August 5
  GUIDs are unchanged. Treat every later render as a new binary: hash and fully decode it,
  require `-17` through `-15` LUFS and true peak no higher than `-1 dBTP`, then
  replace the existing RSS.com episode audio without changing its GUID or other
  identity fields.
- Amazon has no claimed show yet. Submit the canonical RSS.com feed once,
  complete the required owner attestations manually, and record the resulting
  stable show ID and URL. Never submit the legacy Anchor URL.
- Rumble must remain non-exclusive. The only permitted Rumble license is Option
  C, `Rumble Only (non-exclusive, similar to YouTube)`
  (`rumble_only_option_c`). Never select either Video Management option (A or B)
  or Personal Use for a project
  release. Start Unlisted, keep Premium/exclusive placement off, and disable all
  additional syndication, especially the hidden YouTube switch. The August 7
  audit found all seven corrected uploads staged Unlisted with Option C but
  YouTube syndication enabled, so they remain blocked and unsubmitted.
- Rumble's Terms last modified July 21, 2026 prohibit automated software access
  or interaction without Rumble's prior written permission. Do not connect a
  browser automation bridge to Rumble or automate form inspection, editing,
  checkbox attestation, or submission. A human must review every episode's
  original/third-party asset rights, acknowledge the Terms' general-license
  AI/ML training and third-party AI sublicensing provisions, turn syndication
  off, check the rights and Terms boxes, and submit. Do not infer that the user
  has acknowledged a newly surfaced provision.
- `publishing/master-catalog.json` revision 11 is the current distribution
  metadata authority. Supabase remains the production authority for website-only
  editorial content; overlapping identity/title/audio fields are verified
  projections of the master. The August 8 Episode 7 correction passed guarded
  production migration and independent editorial readback. Current destination
  parity is recorded in `publishing/episode-description-correction.json`.
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
  Reconnect only after the authenticated dashboard is open. Rumble is the
  exception: leave its bridge disconnected and continue by direct human use.
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
