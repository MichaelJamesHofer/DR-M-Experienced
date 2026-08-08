#!/usr/bin/env node

import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const fontFromBuffer = require("next/dist/compiled/@next/font/dist/fontkit").default;

const VERSION = "1.0.0-rc1";
const PACKAGE_STATE = "review_owner_approval_required";
const SHOW = {
  fullTitle: "Dr. M Experienced, with Dr. David Musnick",
  shortTitle: "Dr. M Experienced",
  displayWordmark: "DR. M EXPERIENCED,",
  hostLine: "with Dr. David Musnick",
};
const COLORS = {
  midnight: "#0A0F1A",
  slate: "#111827",
  raised: "#1E293B",
  cyan: "#22D3EE",
  copper: "#F59E0B",
  cloud: "#F1F5F9",
  paper: "#F8FAFC",
  muted: "#475569",
};

const repoRoot = process.cwd();
const packageRoot = path.join(repoRoot, "publishing", "brand", "show-package", VERSION);
const sourceRoot = path.join(packageRoot, "source");
const exportRoot = path.join(packageRoot, "exports");
const publicRoot = path.join(repoRoot, "public", "images", "brand", "show", VERSION);
const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "drm-show-brand-"));

const sourceConfigPath =
  process.env.DRM_PUBLISH_SOURCES_CONFIG ??
  path.join(process.env.HOME ?? "", ".config", "drm-publisher", "sources.json");
const sourceConfig = JSON.parse(await fs.readFile(sourceConfigPath, "utf8"));
const projectBinaryRoot = sourceConfig?.roots?.dropbox;
if (!projectBinaryRoot || typeof projectBinaryRoot !== "string") {
  throw new Error("The configured Dropbox project root is missing.");
}
const dropboxMasterRoot = path.join(projectBinaryRoot, "brand", "masters");
const dropboxVersionRoot = path.join(dropboxMasterRoot, VERSION);

const fontFiles = {
  display: "/usr/share/fonts/opentype/inter/InterDisplay-Bold.otf",
  text: "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
};
const [displayFont, textFont] = await Promise.all(
  Object.values(fontFiles).map(async (file) => fontFromBuffer(await fs.readFile(file)))
);

await Promise.all(
  [sourceRoot, exportRoot, publicRoot, dropboxMasterRoot, dropboxVersionRoot].map((directory) =>
    fs.mkdir(directory, { recursive: true })
  )
);

const svgHeader = (width, height, label) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`;

function escapeXml(value) {
  return value.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;");
}

function outlinedText(font, text, size, x, baseline, fill) {
  const run = font.layout(text);
  const scale = size / font.unitsPerEm;
  let cursor = 0;
  let paths = "";
  for (let index = 0; index < run.glyphs.length; index += 1) {
    const glyph = run.glyphs[index];
    const position = run.positions[index];
    const glyphX = x + (cursor + position.xOffset) * scale;
    const glyphY = baseline - position.yOffset * scale;
    paths += `<path d="${glyph.path.toSVG()}" transform="translate(${glyphX.toFixed(3)} ${glyphY.toFixed(
      3
    )}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})" fill="${fill}"/>`;
    cursor += position.xAdvance;
  }
  return { svg: `<g aria-label="${escapeXml(text)}">${paths}</g>`, width: cursor * scale };
}

function centeredText(font, text, size, centerX, baseline, fill) {
  const measurement = outlinedText(font, text, size, 0, baseline, fill);
  return outlinedText(font, text, size, centerX - measurement.width / 2, baseline, fill);
}

function cutlineMark(x, y, size, primary = COLORS.cyan, accent = COLORS.copper, showAccent = true) {
  const scale = size / 64;
  return `<g transform="translate(${x} ${y}) scale(${scale})" aria-label="Cutline M mark">
    <path d="M11 51V15H20L32 36L44 15H53V51H43V35L32 54L21 35V51ZM17 51H23L48 20H42Z" fill="${primary}" fill-rule="evenodd"/>
${showAccent ? `    <rect x="42" y="16" width="7" height="7" fill="${accent}"/>\n` : ""}  </g>`;
}

function contourField(width, height, color, opacity = 0.16) {
  const paths = [
    `M${-0.03 * width} ${0.18 * height} C${0.18 * width} ${0.02 * height}, ${0.32 * width} ${
      0.35 * height
    }, ${0.53 * width} ${0.16 * height} S${0.82 * width} ${0.02 * height}, ${1.04 * width} ${
      0.2 * height
    }`,
    `M${-0.05 * width} ${0.32 * height} C${0.17 * width} ${0.14 * height}, ${0.34 * width} ${
      0.48 * height
    }, ${0.56 * width} ${0.3 * height} S${0.83 * width} ${0.13 * height}, ${1.05 * width} ${
      0.33 * height
    }`,
    `M${-0.04 * width} ${0.48 * height} C${0.18 * width} ${0.28 * height}, ${0.35 * width} ${
      0.63 * height
    }, ${0.59 * width} ${0.44 * height} S${0.86 * width} ${0.28 * height}, ${1.04 * width} ${
      0.51 * height
    }`,
    `M${-0.06 * width} ${0.66 * height} C${0.16 * width} ${0.44 * height}, ${0.36 * width} ${
      0.8 * height
    }, ${0.61 * width} ${0.61 * height} S${0.88 * width} ${0.46 * height}, ${1.06 * width} ${
      0.7 * height
    }`,
  ];
  return `<g fill="none" stroke="${color}" stroke-width="${Math.max(1.5, width / 1200)}" opacity="${opacity}">${paths
    .map((data) => `<path d="${data}"/>`)
    .join("")}</g>`;
}

async function writeText(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, `${value.trim()}\n`);
}

async function writeBuffer(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, value);
}

async function renderSvg(svg, output, options = {}) {
  let pipeline = sharp(Buffer.from(svg), { density: options.density ?? 144 });
  if (options.width || options.height) {
    pipeline = pipeline.resize(options.width, options.height, { fit: options.fit ?? "fill" });
  }
  if (options.format === "jpg") {
    await pipeline.flatten({ background: options.background ?? COLORS.paper }).jpeg({ quality: 92, chromaSubsampling: "4:4:4" }).toFile(output);
  } else {
    await pipeline.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(output);
  }
}

async function fileEvidence(file) {
  const buffer = await fs.readFile(file);
  const metadata = await sharp(buffer, { animated: true }).metadata().catch(() => null);
  const stat = await fs.stat(file);
  return {
    sizeBytes: stat.size,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
    ...(metadata?.width ? { width: metadata.width } : {}),
    ...(metadata?.height ? { height: metadata.height } : {}),
  };
}

function relativeRepo(file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}

const logoHorizontal = (() => {
  const wordmark = outlinedText(displayFont, "DR. M EXPERIENCED,", 92, 330, 142, COLORS.midnight);
  const host = outlinedText(textFont, "with Dr. David Musnick", 38, 334, 215, COLORS.muted);
  return `${svgHeader(1440, 320, "Dr. M Experienced, with Dr. David Musnick horizontal logo")}
    <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
    ${cutlineMark(54, 48, 224)}
    ${wordmark.svg}
    ${host.svg}
  </svg>`;
})();

const logoHorizontalDark = (() => {
  const wordmark = outlinedText(displayFont, "DR. M EXPERIENCED,", 92, 330, 142, COLORS.cloud);
  const host = outlinedText(textFont, "with Dr. David Musnick", 38, 334, 215, "#B6C2D1");
  return `${svgHeader(1440, 320, "Dr. M Experienced, with Dr. David Musnick logo for dark fields")}
    <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
    ${cutlineMark(54, 48, 224)}
    ${wordmark.svg}
    ${host.svg}
  </svg>`;
})();

const logoStacked = (() => {
  const drM = centeredText(displayFont, "DR. M", 132, 500, 565, COLORS.midnight);
  const experienced = centeredText(displayFont, "EXPERIENCED,", 92, 500, 690, COLORS.midnight);
  const host = centeredText(textFont, "with Dr. David Musnick", 42, 500, 778, COLORS.muted);
  return `${svgHeader(1000, 1000, "Dr. M Experienced, with Dr. David Musnick stacked logo")}
    <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
    ${cutlineMark(350, 90, 300)}
    ${drM.svg}${experienced.svg}${host.svg}
  </svg>`;
})();

const logoStackedDark = (() => {
  const drM = centeredText(displayFont, "DR. M", 132, 500, 565, COLORS.cloud);
  const experienced = centeredText(displayFont, "EXPERIENCED,", 92, 500, 690, COLORS.cloud);
  const host = centeredText(textFont, "with Dr. David Musnick", 42, 500, 778, "#B6C2D1");
  return `${svgHeader(1000, 1000, "Dr. M Experienced, with Dr. David Musnick stacked logo for dark fields")}
    <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
    ${cutlineMark(350, 90, 300)}
    ${drM.svg}${experienced.svg}${host.svg}
  </svg>`;
})();

const logoMark = `${svgHeader(512, 512, "Dr. M Experienced Cutline M mark")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
  ${cutlineMark(0, 0, 512)}
</svg>`;

const logoMarkOneColor = `${svgHeader(512, 512, "Dr. M Experienced one-color Cutline M mark")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline</metadata>
  ${cutlineMark(0, 0, 512, COLORS.midnight, COLORS.midnight, false)}
</svg>`;

const sourceFiles = {
  "logo-horizontal.svg": logoHorizontal,
  "logo-horizontal-on-dark.svg": logoHorizontalDark,
  "logo-stacked.svg": logoStacked,
  "logo-stacked-on-dark.svg": logoStackedDark,
  "logo-mark.svg": logoMark,
  "logo-mark-one-color.svg": logoMarkOneColor,
};
await Promise.all(Object.entries(sourceFiles).map(([name, svg]) => writeText(path.join(sourceRoot, name), svg)));

await Promise.all([
  renderSvg(logoHorizontal, path.join(exportRoot, "logo-horizontal-fullcolor-light-2x.png"), { width: 1440, height: 320 }),
  renderSvg(logoHorizontal, path.join(exportRoot, "logo-horizontal-fullcolor-light-4x.png"), { width: 2880, height: 640 }),
  renderSvg(logoHorizontalDark, path.join(exportRoot, "logo-horizontal-fullcolor-dark-2x.png"), { width: 1440, height: 320 }),
  renderSvg(logoStacked, path.join(exportRoot, "logo-stacked-fullcolor-light-2x.png"), { width: 1000, height: 1000 }),
  renderSvg(logoStackedDark, path.join(exportRoot, "logo-stacked-fullcolor-dark-2x.png"), { width: 1000, height: 1000 }),
  ...[512, 180, 48, 32, 24, 16].map((size) =>
    renderSvg(logoMark, path.join(exportRoot, `logo-mark-${size}.png`), { width: size, height: size })
  ),
]);

const heroBasePath = path.join(
  repoRoot,
  "public",
  "images",
  "brand",
  "hero-cartography-v3",
  "desktop-base-4096.webp"
);
const heroForegroundPath = path.join(
  repoRoot,
  "public",
  "images",
  "brand",
  "hero-cartography-v3",
  "desktop-foreground-4096.webp"
);
const heroComposite = await sharp(heroBasePath)
  .composite([{ input: heroForegroundPath, blend: "over" }])
  // librsvg silently drops embedded WebP data URIs in some Sharp builds.
  // JPEG keeps the generated source portable across the SVG and video exporters.
  .jpeg({ quality: 94, chromaSubsampling: "4:4:4" })
  .toBuffer();
const heroDataUri = `data:image/jpeg;base64,${heroComposite.toString("base64")}`;

const coverWordDrM = centeredText(displayFont, "DR. M", 300, 1500, 650, COLORS.midnight);
const coverWordExperienced = centeredText(displayFont, "EXPERIENCED,", 225, 1500, 945, COLORS.midnight);
const coverHost = centeredText(textFont, "with Dr. David Musnick", 92, 1500, 1135, COLORS.muted);
const coverSvg = `${svgHeader(3000, 3000, "Dr. M Experienced, with Dr. David Musnick podcast cover")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; direction=cutline-cartography</metadata>
  <rect width="3000" height="3000" fill="${COLORS.paper}"/>
  ${contourField(3000, 1450, COLORS.muted, 0.12)}
  <image href="${heroDataUri}" x="0" y="1450" width="3000" height="1550" preserveAspectRatio="xMidYMid slice"/>
  <rect x="0" y="1390" width="3000" height="95" fill="${COLORS.paper}" opacity="0.78"/>
  ${cutlineMark(1375, 100, 250)}
  ${coverWordDrM.svg}${coverWordExperienced.svg}${coverHost.svg}
  <path d="M390 2700 C820 2625 1040 2430 1300 2320 S1880 2240 2250 1880" fill="none" stroke="${COLORS.copper}" stroke-width="20" stroke-linecap="round"/>
  <circle cx="2250" cy="1880" r="40" fill="${COLORS.paper}" stroke="${COLORS.copper}" stroke-width="18"/>
</svg>`;
await writeText(path.join(sourceRoot, "podcast-cover-layout.svg"), coverSvg);
await renderSvg(coverSvg, path.join(exportRoot, "podcast-cover-3000x3000.jpg"), {
  width: 3000,
  height: 3000,
  format: "jpg",
  background: COLORS.paper,
});

const avatarSvg = `${svgHeader(1200, 1200, "Dr. M Experienced avatar")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; circle-safe=true</metadata>
  <rect width="1200" height="1200" fill="${COLORS.midnight}"/>
  ${contourField(1200, 1200, COLORS.cyan, 0.13)}
  <circle cx="600" cy="600" r="430" fill="${COLORS.slate}" stroke="${COLORS.raised}" stroke-width="12"/>
  ${cutlineMark(292, 292, 616)}
</svg>`;
await writeText(path.join(sourceRoot, "avatar-layout.svg"), avatarSvg);
await renderSvg(avatarSvg, path.join(exportRoot, "avatar-1200x1200.png"), { width: 1200, height: 1200 });

const bannerWordmark = outlinedText(displayFont, "DR. M EXPERIENCED,", 116, 745, 685, COLORS.midnight);
const bannerHost = outlinedText(textFont, "with Dr. David Musnick", 48, 750, 770, COLORS.muted);
const bannerSvg = `${svgHeader(2560, 1440, "Dr. M Experienced, with Dr. David Musnick YouTube banner")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; safe-area=1544x423</metadata>
  <rect width="2560" height="1440" fill="${COLORS.paper}"/>
  <image href="${heroDataUri}" x="0" y="0" width="2560" height="1440" preserveAspectRatio="xMidYMid slice"/>
  <rect x="508" y="508" width="1544" height="423" fill="${COLORS.paper}" opacity="0.84"/>
  ${cutlineMark(575, 580, 190)}
  ${bannerWordmark.svg}${bannerHost.svg}
  <path d="M1810 842 C1870 805 1912 756 1950 682" fill="none" stroke="${COLORS.copper}" stroke-width="12" stroke-linecap="round"/>
  <circle cx="1950" cy="682" r="20" fill="${COLORS.paper}" stroke="${COLORS.copper}" stroke-width="10"/>
</svg>`;
await writeText(path.join(sourceRoot, "youtube-banner-layout.svg"), bannerSvg);
await renderSvg(bannerSvg, path.join(exportRoot, "youtube-banner-2560x1440.png"), { width: 2560, height: 1440 });

const ogWordmark = outlinedText(displayFont, "DR. M EXPERIENCED,", 74, 305, 260, COLORS.midnight);
const ogHost = outlinedText(textFont, "with Dr. David Musnick", 31, 310, 318, COLORS.muted);
const ogTagline = outlinedText(textFont, "Practical, research-informed health education", 29, 310, 395, COLORS.midnight);
const ogSvg = `${svgHeader(1200, 630, "Dr. M Experienced, with Dr. David Musnick social sharing image")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; inner-margin=72</metadata>
  <rect width="1200" height="630" fill="${COLORS.paper}"/>
  <image href="${heroDataUri}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice" opacity="0.92"/>
  <rect x="72" y="118" width="1056" height="394" fill="${COLORS.paper}" opacity="0.82"/>
  ${cutlineMark(112, 195, 154)}
  ${ogWordmark.svg}${ogHost.svg}${ogTagline.svg}
</svg>`;
await writeText(path.join(sourceRoot, "open-graph-layout.svg"), ogSvg);
await renderSvg(ogSvg, path.join(exportRoot, "open-graph-1200x630.jpg"), {
  width: 1200,
  height: 630,
  format: "jpg",
  background: COLORS.paper,
});

const letterLogo = outlinedText(displayFont, "DR. M EXPERIENCED,", 82, 420, 250, COLORS.midnight);
const letterHost = outlinedText(textFont, "with Dr. David Musnick", 32, 425, 310, COLORS.muted);
const letterFooter = centeredText(textFont, "drmexperienced.com  |  Educational content, not individualized medical advice.", 29, 1275, 3140, COLORS.muted);
const letterheadSvg = `${svgHeader(2550, 3300, "Dr. M Experienced, with Dr. David Musnick US Letter letterhead")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; page=US-Letter-300dpi</metadata>
  <rect width="2550" height="3300" fill="#FFFFFF"/>
  ${cutlineMark(210, 142, 180)}
  ${letterLogo.svg}${letterHost.svg}
  <rect x="210" y="390" width="2130" height="8" fill="${COLORS.cyan}"/>
  <rect x="210" y="390" width="180" height="8" fill="${COLORS.copper}"/>
  <rect x="210" y="3025" width="2130" height="3" fill="#CBD5E1"/>
  ${letterFooter.svg}
</svg>`;
await writeText(path.join(sourceRoot, "letterhead-us-letter.svg"), letterheadSvg);
const letterheadPng = path.join(tempRoot, "letterhead-us-letter.png");
await renderSvg(letterheadSvg, letterheadPng, { width: 2550, height: 3300 });
const letterheadJpeg = await sharp(letterheadPng).flatten({ background: "#FFFFFF" }).jpeg({ quality: 92 }).toBuffer();

function pdfFromJpeg(jpeg, pixelWidth, pixelHeight) {
  const chunks = [Buffer.from("%PDF-1.4\n%\xFF\xFF\xFF\xFF\n", "binary")];
  const offsets = [0];
  let length = chunks[0].length;
  const addObject = (number, values) => {
    offsets[number] = length;
    const parts = [Buffer.from(`${number} 0 obj\n`)];
    for (const value of values) parts.push(Buffer.isBuffer(value) ? value : Buffer.from(value));
    parts.push(Buffer.from("\nendobj\n"));
    for (const part of parts) {
      chunks.push(part);
      length += part.length;
    }
  };
  addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  addObject(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  addObject(3, [
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>",
  ]);
  addObject(4, [
    `<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);
  const content = Buffer.from("q\n612 0 0 792 0 0 cm\n/Im0 Do\nQ\n");
  addObject(5, [`<< /Length ${content.length} >>\nstream\n`, content, "endstream"]);
  const xrefOffset = length;
  const xref = ["xref", "0 6", "0000000000 65535 f "];
  for (let index = 1; index <= 5; index += 1) xref.push(`${String(offsets[index]).padStart(10, "0")} 00000 n `);
  chunks.push(
    Buffer.from(`${xref.join("\n")}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)
  );
  return Buffer.concat(chunks);
}

await writeBuffer(path.join(exportRoot, "letterhead-us-letter.pdf"), pdfFromJpeg(letterheadJpeg, 2550, 3300));

const lowerName = outlinedText(displayFont, "David Musnick, MD", 62, 280, 925, COLORS.cloud);
const lowerRole = outlinedText(textFont, "Host, Dr. M Experienced", 34, 282, 990, "#B6C2D1");
const lowerThirdSvg = `${svgHeader(1920, 1080, "David Musnick lower third")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; title-safe=true</metadata>
  <rect x="110" y="790" width="1030" height="235" rx="6" fill="${COLORS.slate}" opacity="0.96"/>
  <rect x="110" y="790" width="12" height="235" fill="${COLORS.cyan}"/>
  <rect x="122" y="790" width="86" height="12" fill="${COLORS.copper}"/>
  ${cutlineMark(155, 835, 98)}
  ${lowerName.svg}${lowerRole.svg}
</svg>`;
await writeText(path.join(sourceRoot, "lower-third-1920x1080.svg"), lowerThirdSvg);
await renderSvg(lowerThirdSvg, path.join(exportRoot, "lower-third-1920x1080.png"), { width: 1920, height: 1080 });

const introWordmark = centeredText(displayFont, "DR. M EXPERIENCED,", 105, 960, 550, COLORS.midnight);
const introHost = centeredText(textFont, "with Dr. David Musnick", 45, 960, 635, COLORS.muted);
const introSvg = `${svgHeader(1920, 1080, "Dr. M Experienced, with Dr. David Musnick intro sting end frame")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; duration=1.2s; audio=silent</metadata>
  <rect width="1920" height="1080" fill="${COLORS.paper}"/>
  <image href="${heroDataUri}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity="0.52"/>
  ${cutlineMark(850, 145, 220)}
  ${introWordmark.svg}${introHost.svg}
  <path d="M520 840 C780 770 1030 850 1240 790 S1420 735 1540 670" fill="none" stroke="${COLORS.copper}" stroke-width="10" stroke-linecap="round"/>
  <circle cx="1540" cy="670" r="18" fill="${COLORS.paper}" stroke="${COLORS.copper}" stroke-width="8"/>
</svg>`;
await writeText(path.join(sourceRoot, "intro-sting-end-frame.svg"), introSvg);
const introStill = path.join(tempRoot, "intro-sting.png");
await renderSvg(introSvg, introStill, { width: 1920, height: 1080 });

const endTitle = centeredText(displayFont, "CONTINUE LEARNING", 70, 960, 205, COLORS.midnight);
const endHost = centeredText(textFont, "Dr. M Experienced, with Dr. David Musnick", 34, 960, 265, COLORS.muted);
const endNext = centeredText(textFont, "NEXT EPISODE", 30, 670, 850, COLORS.muted);
const endSubscribe = centeredText(textFont, "SUBSCRIBE", 30, 1390, 850, COLORS.muted);
const endSvg = `${svgHeader(1920, 1080, "Dr. M Experienced end screen")}
  <metadata>version=${VERSION}; status=${PACKAGE_STATE}; duration=7s; audio=silent</metadata>
  <rect width="1920" height="1080" fill="${COLORS.paper}"/>
  <image href="${heroDataUri}" x="0" y="0" width="1920" height="1080" preserveAspectRatio="xMidYMid slice" opacity="0.46"/>
  ${cutlineMark(180, 110, 118)}
  ${endTitle.svg}${endHost.svg}
  <rect x="320" y="390" width="700" height="394" rx="6" fill="none" stroke="${COLORS.cyan}" stroke-width="5" opacity="0.75"/>
  <circle cx="1390" cy="585" r="188" fill="none" stroke="${COLORS.cyan}" stroke-width="5" opacity="0.75"/>
  ${endNext.svg}${endSubscribe.svg}
</svg>`;
await writeText(path.join(sourceRoot, "end-screen-1920x1080.svg"), endSvg);
const endStill = path.join(tempRoot, "end-screen.png");
await renderSvg(endSvg, endStill, { width: 1920, height: 1080 });

const videoArgs = (input, duration, fadeOutStart, output) => [
  "-y",
  "-loop",
  "1",
  "-i",
  input,
  "-t",
  String(duration),
  "-vf",
  `fps=30,fade=t=in:st=0:d=0.25:color=white,fade=t=out:st=${fadeOutStart}:d=0.25:color=white,format=yuv420p`,
  "-an",
  "-c:v",
  "libx264",
  "-preset",
  "medium",
  "-crf",
  "18",
  "-movflags",
  "+faststart",
  "-map_metadata",
  "-1",
  output,
];
execFileSync("ffmpeg", videoArgs(introStill, 1.2, 0.95, path.join(exportRoot, "intro-sting-silent-1920x1080.mp4")), {
  stdio: "ignore",
});
execFileSync("ffmpeg", videoArgs(endStill, 7, 6.75, path.join(exportRoot, "end-screen-silent-1920x1080.mp4")), {
  stdio: "ignore",
});

const motionSpec = {
  schemaVersion: 1,
  packageVersion: VERSION,
  status: PACKAGE_STATE,
  introSting: {
    file: "exports/intro-sting-silent-1920x1080.mp4",
    durationSeconds: 1.2,
    placement: "after the cold open",
    audio: "silent",
    animation: "0.25 second eased reveal, stable identity hold, 0.25 second exit",
    soundVersionGate: "Add only owner-approved, rights-cleared sound in a later revision.",
  },
  endScreen: {
    file: "exports/end-screen-silent-1920x1080.mp4",
    durationSeconds: 7,
    overlayRegions: {
      nextEpisode: { x: 320, y: 390, width: 700, height: 394 },
      subscribe: { centerX: 1390, centerY: 585, diameter: 376 },
    },
  },
  lowerThird: {
    file: "exports/lower-third-1920x1080.png",
    enterMilliseconds: 220,
    exitMilliseconds: 180,
    titleSafe: true,
  },
};
await writeText(path.join(packageRoot, "motion-spec.json"), JSON.stringify(motionSpec, null, 2));

const publishCopies = [
  [path.join(sourceRoot, "logo-horizontal.svg"), "logo-horizontal.svg"],
  [path.join(sourceRoot, "logo-stacked.svg"), "logo-stacked.svg"],
  [path.join(sourceRoot, "logo-mark.svg"), "logo-mark.svg"],
  [path.join(exportRoot, "avatar-1200x1200.png"), "avatar.png"],
  [path.join(exportRoot, "podcast-cover-3000x3000.jpg"), "podcast-cover-3000x3000.jpg"],
  [path.join(exportRoot, "youtube-banner-2560x1440.png"), "youtube-banner-2560x1440.png"],
  [path.join(exportRoot, "open-graph-1200x630.jpg"), "open-graph-1200x630.jpg"],
];

for (const [source, name] of publishCopies) {
  await fs.copyFile(source, path.join(publicRoot, name));
  await fs.copyFile(source, path.join(dropboxMasterRoot, name));
}
for (const [source, name] of [
  [path.join(sourceRoot, "letterhead-us-letter.svg"), "letterhead-us-letter.svg"],
  [path.join(exportRoot, "letterhead-us-letter.pdf"), "letterhead-us-letter.pdf"],
  [path.join(sourceRoot, "lower-third-1920x1080.svg"), "lower-third-1920x1080.svg"],
  [path.join(exportRoot, "lower-third-1920x1080.png"), "lower-third-1920x1080.png"],
  [path.join(exportRoot, "intro-sting-silent-1920x1080.mp4"), "intro-sting-silent-1920x1080.mp4"],
  [path.join(exportRoot, "end-screen-silent-1920x1080.mp4"), "end-screen-silent-1920x1080.mp4"],
]) {
  await fs.copyFile(source, path.join(dropboxMasterRoot, name));
}

const packageFiles = [];
for (const directory of [sourceRoot, exportRoot]) {
  for (const name of (await fs.readdir(directory)).sort()) {
    const file = path.join(directory, name);
    const stat = await fs.stat(file);
    if (!stat.isFile()) continue;
    const buffer = await fs.readFile(file);
    const metadata = await sharp(buffer, { animated: true }).metadata().catch(() => null);
    packageFiles.push({
      path: relativeRepo(file),
      role: name.replace(/\.[^.]+$/, ""),
      mediaType:
        name.endsWith(".svg")
          ? "image/svg+xml"
          : name.endsWith(".png")
            ? "image/png"
            : name.endsWith(".jpg")
              ? "image/jpeg"
              : name.endsWith(".pdf")
                ? "application/pdf"
                : "video/mp4",
      sizeBytes: stat.size,
      sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
      ...(metadata?.width ? { width: metadata.width } : {}),
      ...(metadata?.height ? { height: metadata.height } : {}),
    });
  }
}

const mounted = {};
for (const [, name] of publishCopies) mounted[name] = await fileEvidence(path.join(dropboxMasterRoot, name));

const packageManifest = {
  schemaVersion: 1,
  packageVersion: VERSION,
  status: PACKAGE_STATE,
  generatedAt: "2026-08-08T20:30:00Z",
  show: SHOW,
  direction: {
    mark: "Cutline",
    rationale: "The strongest premium emblem from Identity Round 01, paired with the approved mountain-path architecture.",
    palette: COLORS,
    wordmark: "Outlined Inter Display geometry for the identity only; Geist remains the product and editorial typeface.",
    portraitDependency: false,
  },
  sourceArt: {
    family: "Layered Cartographic Hero V3",
    generationMethod: "Existing OpenAI built-in image generation outputs with documented local restoration and responsive exports.",
    sourceBrief: "publishing/brand/concepts/hero-brand-cartography-v3.md",
  },
  approval: {
    ownerVisualApprovalRequired: true,
    remotePublishingAuthorized: false,
    approvedDestinations: [],
    decisionRequired: [
      "Approve or reject the Cutline mark as the show identity.",
      "Approve or request revision of the exact portrait-free podcast cover.",
      "Approve the warm amber waypoint as the copper accent.",
      "Approve the outlined Inter Display wordmark exception to the Geist product type system.",
    ],
  },
  mountedCatalogAssets: {
    "show-logo-horizontal": { uri: "dropbox:brand/masters/logo-horizontal.svg", ...mounted["logo-horizontal.svg"] },
    "show-logo-stacked": { uri: "dropbox:brand/masters/logo-stacked.svg", ...mounted["logo-stacked.svg"] },
    "show-logo-mark": { uri: "dropbox:brand/masters/logo-mark.svg", ...mounted["logo-mark.svg"] },
    "show-avatar": { uri: "dropbox:brand/masters/avatar.png", ...mounted["avatar.png"] },
    "show-podcast-cover": {
      uri: "dropbox:brand/masters/podcast-cover-3000x3000.jpg",
      ...mounted["podcast-cover-3000x3000.jpg"],
    },
    "show-youtube-banner": {
      uri: "dropbox:brand/masters/youtube-banner-2560x1440.png",
      ...mounted["youtube-banner-2560x1440.png"],
    },
    "show-open-graph": { uri: "dropbox:brand/masters/open-graph-1200x630.jpg", ...mounted["open-graph-1200x630.jpg"] },
  },
  files: packageFiles,
};
await writeText(path.join(packageRoot, "package-manifest.json"), JSON.stringify(packageManifest, null, 2));

for (const item of packageFiles) {
  const source = path.join(repoRoot, item.path);
  const relative = path.relative(packageRoot, source);
  await fs.mkdir(path.dirname(path.join(dropboxVersionRoot, relative)), { recursive: true });
  await fs.copyFile(source, path.join(dropboxVersionRoot, relative));
}
await fs.copyFile(path.join(packageRoot, "motion-spec.json"), path.join(dropboxVersionRoot, "motion-spec.json"));
await fs.copyFile(path.join(packageRoot, "package-manifest.json"), path.join(dropboxVersionRoot, "package-manifest.json"));

await fs.rm(tempRoot, { recursive: true, force: true });
process.stdout.write(
  `Built Dr. M show brand package ${VERSION}\n` +
    `Repository: ${packageRoot}\n` +
    `Dropbox: ${dropboxVersionRoot}\n` +
    `State: ${PACKAGE_STATE}\n`
);
