# Dropbox Delivery Intake

Last verified: 2026-08-08

This is the offline handoff between editing and the existing publishing approval
workflow. It watches only:

`/home/otto/Dropbox/Dr M Experienced/publisher-inbox`

The intake service cannot access the network. A valid bundle creates a prepared,
hash-bound review packet under `~/.local/state/drm-publisher/jobs`; it does not
approve, authorize, dispatch, upload, schedule, or publish. Rumble is rejected by
the intake contract and remains outside automation.

## Bundle contract

Use one permanent directory whose lowercase name is an explicit delivery ID:

```text
publisher-inbox/
  episode-008-blood-brain-barrier-final/
    episode.json
    master-video.mp4
    podcast-audio.mp3
    thumbnail.jpg
    delivery.json
    READY
```

`episode.json` is the existing `publishing/episode.schema.json` manifest. It must
contain the exact episode number, slug, title, description, content flags,
target list, release choices, and plain asset filenames. The episode must already
exist in `publishing/master-catalog.json`, and all catalog-owned metadata must
match. The binary locations and fingerprints in that catalog must also be ready
for the existing `prepare` checks. No identity is derived from a media filename.

Each asset must live directly in the bundle. Subdirectories, symlinks, hard
links, undeclared files, group/world-writable files, absolute paths, and parent
directory traversal are rejected. The allowed file extensions are intentionally
narrow:

| Role | Extensions |
| --- | --- |
| `fullVideo` | `.mp4`, `.mov` |
| `podcastAudio` | `.mp3`, `.m4a`, `.wav` |
| `instagramReel` | `.mp4`, `.mov` |
| `thumbnail` | `.jpg`, `.jpeg`, `.png`, `.webp` |
| `captions` | `.srt`, `.vtt` |

`delivery.json` follows `publishing/dropbox-delivery.schema.json`. It repeats the
explicit episode identity and binds `episode.json` plus every asset to an exact
byte count and SHA-256 value. It also permanently records:

```json
{
  "readyForPreparation": true,
  "authorizesUpload": false,
  "authorizesRelease": false
}
```

Do not hand-edit hashes. After the catalog and `episode.json` are ready, seal a
new bundle as the `otto` user:

```bash
cd /home/otto/DR-M-Experienced-ops
/home/otto/.nvm/versions/node/v22.22.0/bin/node \
  scripts/publish/dropbox-intake.mjs seal \
  "/home/otto/Dropbox/Dr M Experienced/publisher-inbox/episode-008-blood-brain-barrier-final" \
  --delivery-id episode-008-blood-brain-barrier-final
```

Sealing writes `delivery.json` and then writes `READY` last. It refuses an
already sealed directory. Any binary or metadata revision needs a new delivery
ID and a new directory; never replace bytes under a prepared delivery.

## Host operation

Validate ready bundles without creating jobs:

```bash
/home/otto/.nvm/versions/node/v22.22.0/bin/node \
  scripts/publish/dropbox-intake.mjs scan --validate-only
```

Install the service only after `ops/install-publisher-host.sh` has installed a
clean, pinned release. Installation is disabled by default:

```bash
ops/install-publisher-intake.sh
ops/install-publisher-intake.sh --enable
systemctl --user status drm-publisher-intake.timer
```

The two-minute timer runs the scanner from the exact immutable publisher release.
The service has `IPAddressDeny=any`, read-only Dropbox access, and write access
only to the private publisher state directory. Repeated scans of the same exact
delivery return the original job ID rather than creating another job.

After `status=prepared`, continue through the existing gates:

```bash
drm-publish show <job-id>
drm-publish approve <job-id> ...
drm-publish authorize <job-id> ...
drm-publish dispatch <job-id>
```

Only the final three commands can move a reviewed packet toward the queue, and
each retains its existing exact-confirmation and expiry requirements.

## Failure recovery

| Result | Meaning | Recovery |
| --- | --- | --- |
| `rejected` | The bundle, catalog binding, or a fingerprint failed before a job claim. | Correct the source and seal a new delivery ID. |
| `manual_recovery_required` | Preparation failed after the intake claimed the delivery, or its outcome is ambiguous. | Inspect the private intake state and jobs directory. Do not delete the claim until absence of a prepared job is proven. |
| `already_prepared` | The exact delivery already produced a review packet. | Use the returned existing job ID. |

Private intake claims live at
`~/.local/state/drm-publisher/intake/<delivery-id>.json`. A `preparing` or
`blocked` claim deliberately prevents an automatic retry because a killed
process could have created a job before recording its ID. If recovery proves
there is no matching job, use a new delivery ID; this keeps the audit trail
append-only and avoids ambiguous duplicate preparation.
