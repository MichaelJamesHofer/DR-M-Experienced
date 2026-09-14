# Show name correction

Last public check: September 14, 2026.

The owner requested the exact show title `DR M Experienced, with Dr. David
Musnick MD` across the website and channels, and explicitly authorized a
coordinated correction on September 14. Catalog revision 17 and the website
source were deployed from commit `945c28faf1c4eb1f217d388ca60e6dc57b064bd5`
by guarded Actions run `34897205655`. The local preview at
`http://127.0.0.1:3000/` is separate from the public site.

| Destination | Public name at last check | Next action |
|---|---|---|
| [Website](https://drmexperienced.com/) | Exact full title in public title, hero, and footer | Actions build, deployment, and public Apple-feed verification passed; PR #40 refreshed the checked-in legacy Pages root safeguard. The requested Pages Source switch remains pending: Otto has write but not manage-Pages permission, and the exact API update returned 404 |
| [RSS.com](https://rss.com/podcasts/dr-m-experienced/) | Exact full title in dashboard, public page, and canonical feed at 22:28 UTC | Existing show title and opening description saved through authenticated isolated DRM Chrome; eight episode items unchanged |
| [Spotify](https://open.spotify.com/show/7GGLljxmO0G3FLjPy8vfcw) | Exact full title and description prefix in public HTML/Open Graph at 22:31 UTC | RSS.com change propagated to the existing show ID without creating another listing |
| [Apple](https://podcasts.apple.com/us/podcast/dr-m-experienced-with-dr-david-musnick/id1870433419) | Exact full title in public page and iTunes lookup at about 21:16 UTC | Apple-only feed title projection is live and hash-verified; Episodes 1-2 publication remains a separate unresolved issue |
| [YouTube](https://www.youtube.com/channel/UCFA1nVv4lKMBlx81gjMAOFQ) | Exact full title in anonymous public metadata at 21:02 UTC | Studio saved exact channel name and description prefix on existing channel; handle unchanged |
| [Vimeo](https://vimeo.com/drmexperienced) | `DR M Experienced, Dr. Musnick MD` after edit | The editor rejected 43 characters (32-character limit); exact full title starts the bio and About text, and public metadata readback passed |
| [Instagram](https://www.instagram.com/drmexperienced/) | Exact full title in anonymous public metadata at 21:02 UTC | Account name and bio prefix saved; handle and Creator account preserved |
| [Rumble](https://rumble.com/c/c-7820170) | `Dr. M Experienced, with Dr. David Musnick` | Human-only channel profile edit; never attach automation without written permission |
| Amazon Music | No verified listing ID or URL | Podcasters account is at sign-in; do not claim a rename or create a replacement listing |

The legacy Anchor URL redirects to RSS.com. That feed had eight episodes on
September 14. RSS.com is the canonical podcast metadata source; Apple alone
uses the Apple-only overlay. The owner's September 14 direction supersedes the
earlier hold only for this show-name correction, not for episode-identity
repair. The current public Apple feed is the title-only projection of the sealed
`active` canary, with eight items and SHA-256
`3b2266bdb8cfcc048ce24b0461f557784974b8fc9b0b0733f8975844e6f62b47`.
The original sealed snapshots remain unchanged; the projection is documented in
`docs/apple-show-name-md-v1.md`. Apple show-name convergence does not establish
that Episodes 1-2 are available in its public catalog.
Do not let a show-name update alter GUIDs, enclosures, episode metadata, feed
URLs, or stable show IDs. The old
`publishing/hosting-migration.json` target metadata and existing show-art
package are historical evidence, not proof that the new title is live or that
artwork was approved for replacement.

At 22:28 UTC on September 14, the existing RSS.com podcast was edited in the
authenticated isolated DRM Chrome profile. The title and opening description
were saved as the exact catalog revision-17 text. The dashboard and public
podcast page show the exact title. The canonical bare URL and a cache-busted
readback returned the same feed SHA-256
`436ae091e28bd69f804a06d151a4b502586568b085a202b846b8180e7ab6d373`.
It has eight items; their concatenated raw XML `<item>` blocks have SHA-256
`c3e064fe2f4a9800b95907f36cb28809491fbc1b2b9fe9f0e680f91c33e1f2da`
both before and after the edit. The feed URL, item GUIDs, enclosures, dates,
artwork, and episode metadata were not changed by this save. A separate public
readback at 22:31 UTC found the exact title and description prefix in the
HTML and Open Graph metadata of existing Spotify show
`7GGLljxmO0G3FLjPy8vfcw`.

After a permitted remote change, record the exact platform edit and readback
in the appropriate state file, update its focused runbook, and check the public
result independently. Do not call the rollout complete until the website and
each reachable channel reflect the new title or a documented platform-limited
variant that includes `MD`.
