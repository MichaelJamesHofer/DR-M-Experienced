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
one HTTP 301 hop to that exact feed. Apple show `1870433419` is still configured
directly to RSS.com and publicly exposes five episodes. The owner approved the
exact Apple-only derived feed in `publishing/apple-feed-overlay.json`; it is
locally verified but not yet deployed or configured in Apple. RSS.com remains
the canonical host for every channel.

Apple replied on August 7 under case `20000130526608`: its existing Episode 1
and 2 records contain historical GUIDs that differ from the current feed. The
repair crosswalk, exact approval, before-state evidence, and rollout gates are in
`publishing/apple-guid-repair.json`. RSS.com confirmed existing GUIDs are not
editable by dashboard, support, or API. The approved repair changes only the
derived Apple feed; do not change RSS.com or the master catalog. On August 7,
corrected video was restored against all seven existing Spotify episode IDs
after the masters passed the loudness and sync checks in
`publishing/audio-replacement-audit.json`. As of August 22, six video
attachments remain; Episode 5 preserves its episode ID and corrected RSS audio
but is audio-only pending the staged Creator Support request.

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
  GUID evidence for Episodes 1-2; that is a controlled Apple-only identity
  repair, not permission to mutate RSS.com or submit a replacement show.
- Preserve the legacy Anchor URL and Spotify account. The old feed returns one
  HTTP 301 hop to RSS.com; do not remove or reverse that redirect merely because
  a directory or cache has not converged yet.
- Spotify receives podcast audio from RSS.com. For a video episode, first wait
  for the RSS item to appear in the existing Spotify show, then use Spotify for
  Creators to replace that episode's audio with the approved full video. Never
  create a second Spotify episode or directly upload fallback podcast audio.
- Never change podcast GUIDs during metadata, title, or directory cleanup. The
  only exception is the support-confirmed Apple-only overlay recorded in
  `publishing/apple-guid-repair.json`; every gate there must pass before each
  remote step. Canonical RSS.com and master-catalog GUIDs remain unchanged.
- Public episode titles omit `Episode N`; the number remains required structured
  internal/RSS metadata. Apply the approved seven-title transition as one
  coordinated batch and preserve every remote content ID.
- Apple must continue to use public show `1870433419`, which is still configured
  directly to RSS.com. Its title
  and description are exact and contain no `RSSVERIFY`, but only five episodes
  are Available. The duplicate show and stale manual Episode 4 Draft were
  archived after inspection; RSS Episodes 1 and 2 remain `DRAFTING` and `HIDDEN`
  despite valid source items and audio. Repair that listing in place by deploying
  and validating the approved derived feed, then changing only this existing
  show's RSS URL. Do not recreate the show or manually upload episodes.
- Treat `https://drmexperienced.com/apple-podcasts/feed.xml` as a stable public
  contract after cutover. A later website or Cloudflare migration must serve and
  verify that exact path before DNS/origin cutover; do not change Apple's URL a
  second time merely because the website hosting platform changes.
- Six current RSS audio enclosures are the August 7 normalized replacements;
  Episode 5 is the corrected August 22 binary registered in catalog revision 13.
  All seven canonical RSS.com items retain their captured August 5 GUIDs. Treat every later render as a
  new binary: hash and fully decode it,
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
  YouTube syndication enabled. The August 8 cache reset invalidated those forms;
  the exact local assets remain verified, blocked, and unsubmitted.
- Rumble's Terms last modified July 21, 2026 prohibit automated software access
  or interaction without Rumble's prior written permission. Do not connect a
  browser automation bridge to Rumble or automate form inspection, editing,
  checkbox attestation, or submission. A human must review every episode's
  original/third-party asset rights, turn syndication off, check the rights and
  Terms boxes, and submit. On August 8, 2026, the user explicitly accepted the
  Terms last modified July 21, including the general-license AI/ML training and
  third-party AI sublicensing provisions. That acceptance is not an asset-rights
  attestation and does not grant Rumble's required written automation permission.
- `publishing/master-catalog.json` revision 13 is the current distribution
  metadata authority. It records the corrected Episode 5 video, podcast-audio,
  and Spotify-derivative fingerprints, the corrected RSS enclosure, and the
  30-minute runtime while preserving all stable episode and show identities.
  Revision 13 also retains the exact Show Brand Package `1.0.0-rc1` hashes for
  local verification only; that package still requires owner visual approval
  and has no remote publishing authorization. Supabase remains the production
  authority for website-only editorial content; overlapping identity, title,
  and audio fields are verified projections of the master.
- Project-scoped Dropbox contains the canonical fingerprinted binary masters;
  it is not metadata authority. Vimeo is a distribution and recovery copy, not
  a co-master. RSS.com is the canonical published-audio host/feed, while the
  fingerprinted local MP3 remains the canonical audio binary. Use portable
  logical references and verify hashes before preparation or upload.
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
