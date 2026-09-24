# TikTok profile links

Last source verification: September 23, 2026.

The owner requested the existing TikTok profile,
`https://www.tiktok.com/@drmexperienced`, in the website and platform social
links. The website uses its shared `PlatformBadges` component for the desktop
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
The following outcomes were verified on September 23 by the agent operating
the named platform; unchanged channel copy and existing profile links were
preserved.

| Platform | Result |
|---|---|
| YouTube | Added a link labeled `TikTok` to the existing channel. Public readback at `https://www.youtube.com/@drmexperienced` resolves to the exact TikTok profile URL above. |
| Vimeo | Saved the TikTok link and verified it in the public profile preview. The existing website, email, name and 11 videos were preserved. |
| Instagram | Desktop Edit Profile disables the website field and explicitly requires the Instagram mobile app to change bio links. The existing website, affiliate-guide and contact links remain unchanged; no TikTok link was added through the web interface. |

The YouTube and Instagram observations are recorded in the project
receipt `Continuation/ubuntu-20260923-v005/social-links-20260923-v001/ROOT_PLATFORM_LINK_READBACK_v001.json`.
