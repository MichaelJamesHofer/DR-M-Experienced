# Episode 8 All-Channel Copy And Release Packet

Status: prepared copy and verified local media; no upload or public release is
authorized by this document.

This packet is the reusable copy and release-control handoff for Episode 8. It
does not replace `publishing/master-catalog.json`, the private publisher
manifest, a hash-bound review packet, or an expiring release authorization.
Unknown remote identities and human decisions must remain pending until they are
read back or explicitly selected.

## Canonical Identity

- Structured episode number: `8`
- Proposed public title: `Food and the Brain - Eating for Brain Health and Concussion Recovery`
- Exact public-title approval: **PENDING OWNER APPROVAL**
- Slug: `episode-8-food-and-the-brain`
- Planned public page: `https://drmexperienced.com/episodes/episode-8-food-and-the-brain/`
- Category: `Health & Fitness`
- Runtime: `21:32.700`
- Short summary: `Dr. Musnick explains how he approaches eating for brain sharpness and concussion recovery, covering apigenin, choline, omega-3s, Nrf2-supportive foods, turmeric, quercetin, rosemary, protein, blood sugar, the microbiome, and selected elimination strategies.`

The public title intentionally omits `Episode 8`; the number remains structured
RSS, catalog, website, and approval metadata.

## Approved Local Media

Only the following canonical files are approved for this release. The earlier
`master-video-source.mp4` is an under-level source and must not be uploaded.

| Role | Project-relative file | Bytes | SHA-256 | Verification |
| --- | --- | ---: | --- | --- |
| Full video | `episodes/008-episode-8-food-and-the-brain/master-video.mp4` | 1,607,073,706 | `4d126da758c5b1e2908cdfa27f5b4622022202be967d16a08a400c59befc8615` | H.264/AAC, 1920 x 1080 at 60 fps, full decode passed, `-16.05 LUFS`, `-1.33 dBTP`, fast-start enabled |
| Podcast audio | `episodes/008-episode-8-food-and-the-brain/podcast-audio.mp3` | 31,025,133 | `10cb7e8e0dde9a5f081123d3bc8f5f2aedbfcb9a1a1ae66a69812b051aa64433` | MP3 192 kbps, 48 kHz stereo, full decode passed, `-16.31 LUFS`, `-1.70 dBTP` |
| Video thumbnail | `episodes/008-episode-8-food-and-the-brain/artwork/video-thumbnail-1920x1080.jpg` | 564,787 | `a53a5f85634701c8a7aaf5ba1b6b436202f857428dbfa592b485732f67db5643` | 1920 x 1080 JPEG |
| Podcast episode art | `episodes/008-episode-8-food-and-the-brain/artwork/podcast-art-3000x3000.jpg` | 1,587,391 | `992f1a5dc196c3fff1ceb442d241db9a25ac0e503c693cedb5cf358975183bf0` | 3000 x 3000 JPEG |
| Website art | `episodes/008-episode-8-food-and-the-brain/artwork/website-1600x900.webp` | 139,232 | `e77cc725a6daf6b214e4a59535e7820df26d2524a19220a0a72cff9a0ce7674d` | 1600 x 900 WebP |
| Captions | `episodes/008-episode-8-food-and-the-brain/captions.srt` | 27,385 | `a33793b0968695ca6c26ec187fbf790d11bdf208c44b1ccc7aa53d0951e3d19c` | SRT timed captions through `21:31.920` |

The video and MP3 pass the project's `-17` through `-15 LUFS` integrated
loudness gate and the `-1 dBTP` maximum true-peak gate.

## Human Decisions Required Before Release

These are deliberately unresolved. Record exact values in the private manifest
and immutable review packet; do not infer them from this document.

- Publish now or scheduled date/time: **PENDING HUMAN SELECTION**
- Exact public title: **PENDING OWNER APPROVAL**
- Explicit content: **PENDING HUMAN CONFIRMATION**
- Made for kids / audience: **PENDING HUMAN CONFIRMATION**
- Altered or synthetic media disclosure: **PENDING HUMAN CONFIRMATION**
- Paid promotion disclosure: **PENDING HUMAN CONFIRMATION**
- YouTube license and subscriber notifications: **PENDING HUMAN SELECTION**
- Vimeo license, visibility, and notifications: **PENDING HUMAN SELECTION**
- Spotify video replacement confirmation on the RSS-created item: **PENDING HUMAN APPROVAL**
- Third-party music, footage, graphics, quotations, and trademark review: **PENDING HUMAN RIGHTS REVIEW**

Affiliate links and product mentions require the disclosure included below.
Their presence does not by itself answer a platform's paid-promotion question.

### Manifest Control Ledger

Every `PENDING` value below must be selected in the private manifest and bound
into the review and authorization hashes. Safe initial privacy is a preparation
control, not permission to upload or release.

| Direct target | Release mode / final visibility | Initial visibility | License | Monetization | Notifications |
| --- | --- | --- | --- | --- | --- |
| RSS.com | **PENDING HUMAN SELECTION** | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** |
| Spotify video attachment | **PENDING HUMAN SELECTION**, after same RSS item appears | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** | **PENDING MANIFEST SELECTION** |
| YouTube | **PENDING HUMAN SELECTION** | `private` | **PENDING HUMAN SELECTION** | **PENDING HUMAN SELECTION** | **PENDING HUMAN SELECTION** |
| Vimeo | **PENDING HUMAN SELECTION** | `nobody` | **PENDING HUMAN SELECTION** | **PENDING HUMAN SELECTION** | **PENDING HUMAN SELECTION** |
| Instagram | `hold`; no approved `instagramReel` exists | **PENDING IN A NEW PACKET** | **PENDING IN A NEW PACKET** | **PENDING IN A NEW PACKET** | **PENDING IN A NEW PACKET** |
| Rumble | **PENDING HUMAN FINAL-VISIBILITY SELECTION** | `unlisted` | `rumble_only_option_c` / form code `6` | **PENDING HUMAN SELECTION** | **PENDING HUMAN SELECTION** |

Rumble additionally requires all syndication and Premium/exclusive placement
off plus a direct-human rights and Terms review; use the dedicated handoff.
Apple Podcasts and Amazon Music/Audible have no direct per-episode release-plan
entry because they fan out from the canonical RSS item.

## Canonical Long Description And Show Notes

Use this HTML on RSS.com. Spotify and Apple will ingest it from the canonical
feed. Amazon will ingest it only after the existing show is claimed with that
same feed. Keep the visible URLs when a destination strips anchor attributes.

```html
<p>What should you eat when you want a sharper brain—or when the brain is recovering from a concussion or other neurological stress?</p>

<p>In this episode of <strong>Dr. M Experienced, with Dr. David Musnick</strong>, Dr. M connects food with brain health, neuroinflammation, blood-sugar stability, mitochondria, the gut-brain connection, and neuronal membranes.</p>

<p><strong>Topics include:</strong></p>
<ul>
<li>Apigenin, parsley, and the balance between inflammatory M1 and repair-oriented M2 microglia</li>
<li>A parsley, wild-blueberry, and protein smoothie</li>
<li>Choline, omega-3 DHA, plasmalogens, and neuronal membranes</li>
<li>Nrf2-supportive broccoli sprouts, green tea, turmeric, and rosemary</li>
<li>Quercetin-rich capers, red onions, and apples</li>
<li>Protein, lower-mercury fish, vegetable diversity, fiber, and the microbiome</li>
<li>Advanced glycation end products, acrylamide, heavy metals, BPA, MSG, aspartame, and sugar</li>
<li>Ketogenic diets, intermittent fasting, and when they may not be appropriate</li>
</ul>

<p>Dr. M explains why he may consider gluten-free, cow-dairy-free, or selective short-term elimination strategies in some concussion and neurological cases. These are not universal and should be individualized with an appropriate clinician.</p>

<p><strong>Related episodes:</strong></p>
<ul>
<li>The Brain on Fire - Neuroinflammation After Concussion: <a href="https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/">https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/</a></li>
<li>Concussion - What Happens in the Brain: <a href="https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/">https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/</a></li>
</ul>

<p><strong>Resources mentioned:</strong></p>
<ul>
<li>Episode page, video, audio, and notes: <a href="https://drmexperienced.com/episodes/episode-8-food-and-the-brain/">https://drmexperienced.com/episodes/episode-8-food-and-the-brain/</a></li>
<li>HumanN Turmeric Chews — Dr. M Experienced product guide: <a href="https://drmexperienced.com/affiliates/#humann-turmeric-chews">https://drmexperienced.com/affiliates/#humann-turmeric-chews</a></li>
<li>FGO Turmeric Ginger Tea — Dr. M Experienced product guide: <a href="https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea">https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea</a></li>
<li>Purity Coffee — Dr. M Experienced product guide: <a href="https://drmexperienced.com/affiliates/#purity-coffee">https://drmexperienced.com/affiliates/#purity-coffee</a></li>
<li>Complete Dr. M Experienced affiliate and product guide: <a href="https://drmexperienced.com/affiliates/">https://drmexperienced.com/affiliates/</a></li>
<li>Dr. M Experienced Supplement Dispensary: <a href="https://drmexperienced.com/affiliates/#doctors-supplement-store">https://drmexperienced.com/affiliates/#doctors-supplement-store</a></li>
<li>Request the Healthy Brain Diet handout: <a href="https://drmexperienced.com/contact/">https://drmexperienced.com/contact/</a> — use “Episode 8 brain diet handout” in the message</li>
</ul>

<p><em>Some product links may be affiliate links. If you purchase through those links, Dr. M Experienced may earn a commission at no additional cost to you. Product mentions are educational and are not medical advice.</em></p>

<p><em>This episode is for educational purposes only and is not a substitute for personalized medical care. Nutrition needs, allergies, medications, metabolic conditions, and concussion recovery differ. Consult your own qualified healthcare professional before making major dietary changes, starting supplements, fasting, or using an elimination or ketogenic diet.</em></p>

<p>#BrainHealth #BrainNutrition #FoodAsMedicine #ConcussionRecovery #Neuroinflammation #FunctionalMedicine #HealthyEating #DrMExperienced</p>
```

This is the proposed catalog HTML, formatted with line breaks for operator
readability. It must match the catalog-owned description exactly before release
authorization. The product guide discloses whether an actual affiliate URL
exists; do not describe HumanN, FGO, or Purity as commission-bearing
destinations unless an exact affiliate relationship is separately verified.

## YouTube And Vimeo Plain-Text Description

Use this explicit override instead of automatically flattening the RSS HTML.
Every resource URL is literal so it remains clickable.

```text
How can food support brain sharpness, brain health, and recovery after a concussion? Dr. David Musnick shares the practical nutrition principles he considers when helping people think about the brain and nervous system.

This episode connects M1 and M2 microglia with apigenin-rich parsley, then explores wild blueberries, choline, omega-3 DHA, Nrf2-supportive foods, turmeric, quercetin, rosemary, clean protein, blood-sugar stability, fiber, and microbiome diversity. It also covers advanced glycation end products, acrylamide, heavy metals, BPA, MSG, aspartame, and heavily browned foods.

Gluten-free, dairy-free, low-lectin, ketogenic, fasting, and other elimination approaches are discussed as selected clinical considerations, not universal instructions. Consult a qualified clinician before major diet changes or using supplements, fasting, elimination diets, or a ketogenic diet.

EPISODE NOTES
https://drmexperienced.com/episodes/episode-8-food-and-the-brain/

AFFILIATE AND PRODUCT GUIDE
HumanN Turmeric Chews
https://drmexperienced.com/affiliates/#humann-turmeric-chews

FGO Turmeric Ginger Tea
https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea

Purity Coffee
https://drmexperienced.com/affiliates/#purity-coffee

Complete guide
https://drmexperienced.com/affiliates/

Dr. M Experienced Supplement Dispensary
https://drmexperienced.com/affiliates/#doctors-supplement-store

REQUEST THE BRAIN-DIET HANDOUT
https://drmexperienced.com/contact/

RELATED EPISODES
The Brain on Fire - Neuroinflammation After Concussion
https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/

Concussion - What Happens in the Brain
https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/

Some product links may be affiliate links. If you purchase through those links, Dr. M Experienced may earn a commission at no additional cost to you. Product mentions are educational and are not medical advice.

This episode is for educational purposes only and is not a substitute for personalized medical care. Consult a qualified clinician before making major diet changes or using supplements, fasting, elimination diets, or a ketogenic diet.

CHAPTERS
00:00 Introduction and educational disclaimer
00:47 Affiliate guide and brain-diet handout
01:19 Microglia, M1/M2 balance, and apigenin
03:04 Parsley and wild-blueberry smoothie
04:45 Gluten and dairy considerations
06:28 Choline, omega-3s, and neurological membranes
08:08 Nrf2-supportive foods
10:25 Brain-healthy pesto
11:12 Quercetin and rosemary
12:37 Protein, fish, and mercury
13:08 Advanced glycation end products, acrylamide, and coffee
15:02 Flavonoids and ketogenic diets
15:50 Heavy metals, crucifers, BPA, and blood sugar
17:22 Elimination approaches, lectins, and choline foods
18:22 Microbiome diversity and fiber
19:03 Smoothie protein, leucine, MSG, and aspartame
20:16 Intermittent fasting considerations
20:36 Resources and wrap-up

#BrainHealth #BrainNutrition #FoodAsMedicine #ConcussionRecovery #Neuroinflammation #FunctionalMedicine #HealthyEating #DrMExperienced
```

## Tags And Hashtags

YouTube tags, entered as separate tags rather than one comma-containing tag:

```text
brain health
brain food
nutrition for brain health
concussion recovery
post-concussion nutrition
neuroinflammation
functional medicine
Dr David Musnick
Dr M Experienced
microglia
apigenin
parsley smoothie
wild blueberries
choline
omega-3 DHA
Nrf2
broccoli sprouts
turmeric
quercetin
rosemary
blood sugar
microbiome
ketogenic diet
healthy brain diet
food and the brain
```

Approved hashtag set:

```text
#BrainHealth #BrainNutrition #FoodAsMedicine #ConcussionRecovery #Neuroinflammation #FunctionalMedicine #HealthyEating #DrMExperienced
```

## Chapters

| Time | Chapter |
| ---: | --- |
| 00:00 | Introduction and educational disclaimer |
| 00:47 | Affiliate guide and brain-diet handout |
| 01:19 | Microglia, M1/M2 balance, and apigenin |
| 03:04 | Parsley and wild-blueberry smoothie |
| 04:45 | Gluten and dairy considerations |
| 06:28 | Choline, omega-3s, and neurological membranes |
| 08:08 | Nrf2-supportive foods |
| 10:25 | Brain-healthy pesto |
| 11:12 | Quercetin and rosemary |
| 12:37 | Protein, fish, and mercury |
| 13:08 | Advanced glycation end products, acrylamide, and coffee |
| 15:02 | Flavonoids and ketogenic diets |
| 15:50 | Heavy metals, crucifers, BPA, and blood sugar |
| 17:22 | Elimination approaches, lectins, and choline foods |
| 18:22 | Microbiome diversity and fiber |
| 19:03 | Smoothie protein, leucine, MSG, and aspartame |
| 20:16 | Intermittent fasting considerations |
| 20:36 | Resources and wrap-up |

## Destination Handoff

| Destination | Media/copy | Required order and pending controls |
| --- | --- | --- |
| RSS.com | `podcast-audio.mp3`, 3000 x 3000 podcast art, canonical HTML copy | Create structured Episode 8 in podcast `397420` first. Exact release time and explicit/AI fields remain pending. Capture the returned episode ID, GUID, enclosure, date, and URL. |
| Spotify | RSS-created episode plus `master-video.mp4` | Wait for the same Episode 8 item in show `7GGLljxmO0G3FLjPy8vfcw`, then use its `Upload video` action. Never create a second episode or upload the MP3 separately. Release confirmation remains pending. |
| Apple Podcasts | RSS fan-out | Verify the same GUID/item in public show `1870433419`; do not upload separately. |
| Amazon Music/Audible | RSS fan-out after one-time show claim | No stable show ID is recorded. Owner verification and claim remain pending; never submit the legacy Anchor feed. |
| YouTube | `master-video.mp4`, 16:9 thumbnail, SRT, explicit plain-text override, tags/chapters | Upload private first to channel `UCFA1nVv4lKMBlx81gjMAOFQ`. Audience, synthetic-media, paid-promotion, license, notifications, and final visibility remain pending. |
| Vimeo | `master-video.mp4`, 16:9 thumbnail, explicit plain-text override | Upload with `nobody` privacy first to account `253415660`. License, notifications, and final privacy remain pending. |
| Instagram | No approved vertical Reel | No long-form Instagram release is represented by this packet. Do not crop or publish the 21-minute horizontal master as a Reel. A separately edited, approved vertical asset and caption require a new packet. |
| Rumble | See `publishing/episode-8-rumble-human-handoff.md` | Human-only; no browser automation. |
| Website | 1600 x 900 WebP, MP3, summary, chapters/resources, verified remote references | Keep the Supabase row draft until selected platform IDs and URLs are verified. Publish through reviewed `main`, then verify the live episode page. |

## Website Resource Set

Use these exact links in the Episode 8 resource section:

1. `https://drmexperienced.com/affiliates/#humann-turmeric-chews` — owned guide entry for HumanN Turmeric Chews.
2. `https://drmexperienced.com/affiliates/#fgo-turmeric-ginger-tea` — owned guide entry for FGO Turmeric Ginger Tea.
3. `https://drmexperienced.com/affiliates/#purity-coffee` — owned guide entry for Purity Coffee.
4. `https://drmexperienced.com/affiliates/` — complete Dr. M Experienced affiliate and product guide.
5. `https://drmexperienced.com/affiliates/#doctors-supplement-store` — Doctors Supplement Store entry.
6. `https://drmexperienced.com/contact/` — request route for the brain-diet handout; do not claim an automatic download until one exists.
7. `https://drmexperienced.com/episodes/episode-7-the-brain-on-fire/` — related neuroinflammation episode.
8. `https://drmexperienced.com/episodes/episode-6-concussion-and-pathophysiology/` — related concussion-mechanisms episode.

Publisher research references, not approved affiliate URLs: HumanN's official
page is `https://humann.com/products/turmeric-chews`; FGO's official page is
`https://fromgreatorigins.com/products/turmeric-ginger-tea-bags`; Purity's
official pages are `https://puritycoffee.com/collections/whole-bean-coffee` and
`https://puritycoffee.com/pages/independent-laboratory-tests`. Do not substitute
these direct URLs for the owned guide routes in public copy without a deliberate
editorial decision.

The episode also mentions a membranes/neuroplasticity podcast without a
verified public episode identity. Do not invent or publish a placeholder link.

## Post-Release Evidence

Complete these only after authenticated and independent readback:

- RSS.com episode ID: **PENDING**
- RSS GUID: **PENDING**
- RSS enclosure URL: **PENDING**
- Spotify episode ID/URL: **PENDING**
- Apple episode ID/URL: **PENDING**
- Amazon show and episode ID/URL: **PENDING**
- YouTube video ID/URL: **PENDING**
- Vimeo video ID/URL: **PENDING**
- Website live URL and deployment run: **PENDING**
- Cross-platform title/copy/art/runtime verification: **PENDING**
