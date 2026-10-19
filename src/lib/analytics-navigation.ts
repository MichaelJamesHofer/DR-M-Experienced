const PLATFORM_HOSTS: Record<string, string> = {
  "youtube.com": "youtube",
  "youtu.be": "youtube",
  "vimeo.com": "vimeo",
  "open.spotify.com": "spotify",
  "podcasts.apple.com": "apple",
  "rumble.com": "rumble",
  "instagram.com": "instagram",
  "tiktok.com": "tiktok",
};
const PUBLIC_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type NavigationContext = {
  href: string;
  origin: string;
  placement: "header" | "footer" | "content";
  productSlug?: string;
  brandSlug?: string;
};

// Capture only public content identifiers and fixed platform names, never link text or URLs.
export function getNavigationAnalyticsEvent(context: NavigationContext) {
  let url: URL;
  try {
    url = new URL(context.href, context.origin);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(url.protocol)) return null;
  const { placement, productSlug, brandSlug } = context;
  if (
    productSlug && brandSlug && PUBLIC_SLUG.test(productSlug) &&
    PUBLIC_SLUG.test(brandSlug)
  ) {
    return {
      event: "affiliate product clicked",
      properties: {
        product_slug: productSlug,
        brand_slug: brandSlug,
        placement,
      },
    };
  }
  if (url.origin === context.origin) {
    const episode = url.pathname.match(
      /^\/episodes\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/,
    );
    return episode
      ? {
        event: "episode opened",
        properties: { episode_slug: episode[1], placement },
      }
      : null;
  }
  const platform = PLATFORM_HOSTS[url.hostname.replace(/^www\./, "")];
  return platform
    ? {
      event: "platform outbound clicked",
      properties: { platform, placement },
    }
    : null;
}
