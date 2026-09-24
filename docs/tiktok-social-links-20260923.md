# TikTok profile links

Last source verification: September 23, 2026.

Social profiles should direct viewers to `https://drmexperienced.com/`, with
`https://drmexperienced.com/affiliates/` as the clearly labeled affiliate-guide
destination where an additional link is supported. The owner clarified that
social-to-social links are not the intended conversion path. Preserve canonical
URLs; this change adds no campaign parameters or analytics instrumentation.

The website may list the show's own social profiles, including the verified
TikTok profile `https://www.tiktok.com/@drmexperienced`. It uses the shared
`PlatformBadges` component for the desktop
header, mobile menu, homepage hero and footer. TikTok joins those existing
badges with the same monochrome icon, accessible label and 44-pixel target.
The earlier standalone footer text link is replaced by that shared badge.

`publishing/platforms.json` records the verified public handle and profile URL.
There is no existing social `sameAs` block in the current website template.
The attended TikTok publishing process remains separate; no publishing adapter,
account permission, episode identity, feed or existing reel destination changes.

Verify the exact profile URL in each rendered social group, including the
expanded mobile menu, and confirm no horizontal overflow at narrow widths.
Require normal pull-request checks before merging and the Pages deployment plus
public Apple-feed verification before recording the live website readback.
Deployment and readback evidence is retained in the project's additive
`website/social-links-20260923-v001` continuation folder.

## Platform profile readbacks

The coordinated profile work is separate from the website badge deployment.
The initial YouTube and Vimeo TikTok cross-links were corrected and publicly
read back against the website-directed policy above. The earlier
`Continuation/ubuntu-20260923-v005/social-links-20260923-v001/ROOT_PLATFORM_LINK_READBACK_v001.json`
records the initial state and must not be treated as the final conversion setup.

| Platform | Result |
|---|---|
| YouTube | The public channel header points to the website. Its expanded About links are `Dr. M’s Website` and `Dr. M’s Affiliate Guide`, with the exact canonical destinations above. TikTok was removed; channel name, description and videos were preserved. |
| Vimeo | Public profile preview verifies the website first and affiliate guide second, with zero TikTok cross-links. Vimeo exposes URL-only labels. The existing email, name, biography and 11 videos were preserved. |
| Instagram | The existing website, affiliate-guide and contact links already meet the clarified direction and remain unchanged. No TikTok link was added. Desktop link editing requires the mobile app, but no Instagram edit is needed for this request. |
| RSS.com | The existing dashboard requires account sign-in; available profile-link fields remain unverified. No account, show, episode or feed change was made. |
| Spotify | No social-link field appears in this show's inspected General or On Spotify settings. Existing episode summaries already contain website and affiliate-guide URLs and were preserved. This finding is limited to the inspected settings, not every Spotify product. |

Vimeo, RSS.com and Spotify evidence is recorded in
`Continuation/ubuntu-20260923-v005/social-links-20260923-v001/VIMEO_RSS_SPOTIFY_RESULTS_v002.json`.
The corrected YouTube and preserved Instagram readbacks are recorded in
`Continuation/ubuntu-20260923-v005/social-links-20260923-v001/ROOT_PLATFORM_LINK_READBACK_v002.json`.
