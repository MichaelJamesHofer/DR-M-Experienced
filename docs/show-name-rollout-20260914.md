# Show name correction

Last public check: September 14, 2026.

The owner requested the exact show title `DR M Experienced, with Dr. David
Musnick MD` across the website and channels, and explicitly authorized a
coordinated correction on September 14. Catalog revision 17 and the website
source prepare the title locally. The local preview is
`http://127.0.0.1:3000/`; it is not the public site.

| Destination | Public name at last check | Next action |
|---|---|---|
| [Website](https://drmexperienced.com/) | `Dr. M Experienced, with Dr. David Musnick` in title, hero, and footer | Deploy the reviewed branch and independently read back; Pages still reports legacy `main:/` source, but the Actions workflow was re-enabled September 14 |
| [RSS.com](https://rss.com/podcasts/dr-m-experienced/) | `Dr. M Experienced, with Dr. David Musnick` in the canonical feed | Saved dashboard login expired in both isolated and normal Otto Chrome; owner must sign in before the existing podcast title/description can be edited |
| [Spotify](https://open.spotify.com/show/7GGLljxmO0G3FLjPy8vfcw) | `Dr. M Experienced, with Dr. David Musnick` | Verify RSS.com propagation on the existing show ID |
| [Apple](https://podcasts.apple.com/us/podcast/dr-m-experienced-with-dr-david-musnick/id1870433419) | `Dr. M Experienced, with Dr. David Musnick` | A hash-bound Apple-only show-metadata projection is prepared, not deployed; verify the public feed and catalog after deployment |
| [YouTube](https://www.youtube.com/channel/UCFA1nVv4lKMBlx81gjMAOFQ) | Exact full title in anonymous public metadata at 21:02 UTC | Studio saved exact channel name and description prefix on existing channel; handle unchanged |
| [Vimeo](https://vimeo.com/drmexperienced) | `DR M Experienced, Dr. Musnick MD` after edit | The editor rejected 43 characters (32-character limit); exact full title starts the bio and About text, and public metadata readback passed |
| [Instagram](https://www.instagram.com/drmexperienced/) | Exact full title in anonymous public metadata at 21:02 UTC | Account name and bio prefix saved; handle and Creator account preserved |
| [Rumble](https://rumble.com/c/c-7820170) | `Dr. M Experienced, with Dr. David Musnick` | Human-only channel profile edit; never attach automation without written permission |
| Amazon Music | No verified listing ID or URL | Podcasters account is at sign-in; do not claim a rename or create a replacement listing |

The legacy Anchor URL redirects to RSS.com. That feed had eight episodes on
September 14. RSS.com is the canonical podcast metadata source; Apple alone
uses the Apple-only overlay. The owner's September 14 direction supersedes the
earlier hold only for this show-name correction, not for episode-identity
repair. The current public Apple feed is the sealed `active` canary, with eight
items and SHA-256 `caa85ee126729629036aba67cc37ef132fad79055f56c77ba6b999e830d2a96a`.
The prepared title-only successor is documented in `docs/apple-show-name-md-v1.md`.
Do not let a show-name update alter GUIDs, enclosures, episode metadata, feed
URLs, or stable show IDs. The old
`publishing/hosting-migration.json` target metadata and existing show-art
package are historical evidence, not proof that the new title is live or that
artwork was approved for replacement.

After a permitted remote change, record the exact platform edit and readback
in the appropriate state file, update its focused runbook, and check the public
result independently. Do not call the rollout complete until the website and
each reachable channel reflect the new title or a documented platform-limited
variant that includes `MD`.
