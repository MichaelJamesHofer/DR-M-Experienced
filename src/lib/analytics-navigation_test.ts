import { getNavigationAnalyticsEvent } from "./analytics-navigation.ts";
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
Deno.test("navigation events contain only public identifiers", () => {
  const base = {
    origin: "https://drmexperienced.com",
    placement: "content" as const,
  };
  const episode = getNavigationAnalyticsEvent({
    ...base,
    href: "/episodes/episode-8-food-and-the-brain/?email=private#note",
  });
  assert(
    episode?.event === "episode opened" &&
      episode.properties.episode_slug === "episode-8-food-and-the-brain",
    "episode navigation missing",
  );
  const platform = getNavigationAnalyticsEvent({
    ...base,
    href: "https://www.youtube.com/watch?v=public&tracking=private",
  });
  assert(
    platform?.properties.platform === "youtube" &&
      !JSON.stringify(platform).includes("private"),
    "outbound URL leaked",
  );
  const affiliate = getNavigationAnalyticsEvent({
    ...base,
    href: "https://partner.example/?tracking=private",
    productSlug: "public-product",
    brandSlug: "public-brand",
  });
  assert(
    affiliate?.event === "affiliate product clicked" &&
      !JSON.stringify(affiliate).includes("private"),
    "partner URL leaked",
  );
  assert(
    getNavigationAnalyticsEvent({
      ...base,
      href: "mailto:private@example.com",
    }) === null,
    "email link captured",
  );
  assert(
    getNavigationAnalyticsEvent({
      ...base,
      href: "https://youtube.com.evil.example/",
    }) === null,
    "unapproved host captured",
  );
});
