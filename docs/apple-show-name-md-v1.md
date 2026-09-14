# Apple Show Name MD Projection

Last verified: September 14, 2026.

The existing Apple show remains `1870433419` at
`https://drmexperienced.com/apple-podcasts/feed.xml`. This release changes only
the RSS channel title, channel description, and channel image title to the
master-catalog name and short copy. It does not change the podcast GUID, self
URL, item order, episode GUIDs, dates, artwork, or enclosure bytes/URLs.

`publishing/apple-show-name-md-v1.json` pins the three immutable canary
snapshots and their corresponding title-projected feed hashes. The active
canary feed published before this change has SHA-256
`caa85ee126729629036aba67cc37ef132fad79055f56c77ba6b999e830d2a96a`.
The active title-projected feed has SHA-256
`3b2266bdb8cfcc048ce24b0461f557784974b8fc9b0b0733f8975844e6f62b47`.
The original sealed snapshots and deployment-state record are unchanged.

The authorized-subtree generator accepts the exact prior public canary feed or
the exact title-projected target as its public baseline. It rejects unrelated
feed bytes before writing the deployment artifact. The deployment verifier
requires the exact generated target hash and checks both bare and cache-busted
public feed URLs. The same title projection is pinned for historical and
contained snapshots so Episode 1 containment remains available.

Before deployment, run the focused canary suite and the full publisher suite
with Node 22, then confirm the bare public feed still hashes to one of the
authorized baselines. After deployment, verify the same Apple show ID, the
target feed hash, channel metadata, item identity, and playable enclosures;
only then request a feed refresh for the existing show in Podcasts Connect.
Do not submit a replacement Apple listing.

GitHub Pages is currently configured with the legacy `main:/` source, and the
checked-in root safeguard remains the prior verified production export. Do
not replace it with a local fallback-catalog build. Prefer changing Pages
Source to GitHub Actions before merging this release. If that owner setting
cannot be changed, refresh the root safeguard only from a successful strict
production artifact and re-pin its manifest before relying on branch builds.
