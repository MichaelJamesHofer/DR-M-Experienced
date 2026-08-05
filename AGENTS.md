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
cd /home/otto/DR-M-Experienced
git status --short --branch
/home/otto/.local/bin/drm-publish doctor
/home/otto/.local/bin/drm-browser status
/home/otto/.local/bin/drm-publish migration-check
```

`migration-check` returning exit code 2 is expected while the RSS.com import is
incomplete. Read the result; never treat an existing but empty feed as ready.

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
- The Anchor feed remains canonical until the RSS.com feed contains all seven
  original GUIDs, media and metadata pass validation, and the exact redirect has
  fresh approval.
- Never change podcast GUIDs during the host migration or title cleanup.
- Public episode titles will eventually omit `Episode N`, but the number remains
  structured internal/RSS metadata. Apply that transition as one coordinated
  batch after the RSS.com migration is stable; do not rename episodes piecemeal.
- Supabase is the production content authority for the website. Checked-in data
  is a recovery mirror.
- Work on a branch, preserve unrelated changes, require passing CI, and verify
  the live website after deployment.

## Browser And Secrets

- Use `/home/otto/.local/bin/drm-browser`; it owns an isolated Chrome profile at
  `~/.local/share/drm-publisher/chrome-profile`.
- Use only one connected platform at a time. Gmail and all other publishing
  origins must remain blocked. Disconnect before changing scope and close the
  automation browser when finished.
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
