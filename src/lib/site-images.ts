const siteOrigins = new Set(["https://drmexperienced.com", "https://www.drmexperienced.com"]);

export function siteImageSrc(src: string | undefined) {
  if (!src) return undefined;
  if (src.startsWith("/")) return src;

  try {
    const url = new URL(src);
    if (siteOrigins.has(url.origin)) {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return undefined;
  }

  return src;
}
