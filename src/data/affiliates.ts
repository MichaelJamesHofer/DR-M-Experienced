import type { Episode } from "./episodes";

export type AffiliateCategory = {
  slug: string;
  label: string;
  description: string;
  displayOrder: number;
};

export type AffiliateProduct = {
  slug: string;
  name: string;
  brand?: string;
  categorySlug: string;
  category: string;
  summary: string;
  drmThoughts: string;
  reasonsToLike: string[];
  usedFor: string[];
  featuredProducts?: string[];
  purchaseNote?: string;
  cautionNote?: string;
  affiliateUrl?: string;
  directUrl?: string;
  imageUrl?: string;
  couponCode?: string;
  discountNote?: string;
  episodeSlugs?: string[];
  autoLinkTopicSlugs?: string[];
  tags?: string[];
  sortOrder: number;
  dateAdded: string;
  lastReviewed: string;
  sourceNote: string;
};

export type AffiliateBrandProfile = {
  logoSrc: string;
  logoAlt: string;
  accent: string;
  logoSurface: string;
};

export const AFFILIATE_BRAND_PROFILES: Record<string, AffiliateBrandProfile> = {
  airestech: {
    logoSrc: "/images/affiliates/airestech.png",
    logoAlt: "Aires logo",
    accent: "#ab8c52",
    logoSurface: "#ffffff",
  },
  "block-blue-light": {
    logoSrc: "/images/affiliates/block-blue-light.png",
    logoAlt: "BlockBlueLight logo",
    accent: "#02c4ff",
    logoSurface: "#ffffff",
  },
  "safe-living-technologies": {
    logoSrc: "/images/affiliates/safe-living-technologies.png",
    logoAlt: "Safe Living Technologies logo",
    accent: "#08ab53",
    logoSurface: "#ffffff",
  },
  "desbio-dbscript": {
    logoSrc: "/images/affiliates/desbio-dbscript.png",
    logoAlt: "DBscript logo",
    accent: "#105d94",
    logoSurface: "#ffffff",
  },
  best365labs: {
    logoSrc: "/images/affiliates/best365labs.svg",
    logoAlt: "Best 365 Labs logo",
    accent: "#00add7",
    logoSurface: "#ffffff",
  },
  "doctors-supplement-store": {
    logoSrc: "/images/affiliates/doctors-supplement-store.png",
    logoAlt: "Doctors Supplement Store logo",
    accent: "#88c570",
    logoSurface: "#ffffff",
  },
  "abeytu-naturals": {
    logoSrc: "/images/affiliates/abeytu-naturals.png",
    logoAlt: "Abeytu Naturals logo",
    accent: "#2a533f",
    logoSurface: "#2a533f",
  },
};

export const AFFILIATE_DISCLOSURE =
  "Some product links may be affiliate links. If you purchase through those links, Dr. M Experienced may earn a commission at no additional cost to you. Product mentions are educational and are not medical advice.";

export const AFFILIATE_CATEGORIES: AffiliateCategory[] = [
  {
    slug: "emf-rf-protection",
    label: "EMF / RF Protection",
    description:
      "Wearable, room, testing, and shielding tools connected to Dr. M's EMF and environmental-exposure conversations.",
    displayOrder: 10,
  },
  {
    slug: "sleep-light-environment",
    label: "Sleep & Light Environment",
    description:
      "Light-hygiene and circadian-support tools for sleep, insomnia, and evening routines.",
    displayOrder: 20,
  },
  {
    slug: "home-environment",
    label: "Home Environment",
    description:
      "Assessment and mitigation resources for home, bedroom, work, and travel environments.",
    displayOrder: 30,
  },
  {
    slug: "homeopathics-supplements",
    label: "Homeopathics & Supplements",
    description:
      "Homeopathic, drainage, detoxification, and supplement resources that need stronger clinical context.",
    displayOrder: 40,
  },
  {
    slug: "supplements",
    label: "Supplements",
    description:
      "Supplement dispensaries and product lines connected to functional-medicine and episode follow-up topics.",
    displayOrder: 50,
  },
  {
    slug: "food-and-nutrition",
    label: "Food & Nutrition",
    description:
      "Food and beverage resources connected to Dr. M's nutrition and brain-health discussions.",
    displayOrder: 60,
  },
];

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  {
    slug: "airestech",
    name: "EMF and RF Protection Devices",
    brand: "Airestech",
    categorySlug: "emf-rf-protection",
    category: "EMF / RF Protection",
    summary:
      "Wearable, phone, and room-focused EMF/RF protection devices for listeners who want a practical way to reduce exposure in daily environments.",
    drmThoughts:
      "Dr. M started using an Airestech Zone after years of EMF/RF-related headaches at his Bellevue clinic. After trying shielding paint and even a Swiss Shield canopy, he found the Zone helped enough that he now wears it daily and travels with it.",
    reasonsToLike: [
      "Includes wearable options as well as room-level devices, so listeners can match the tool to the exposure setting.",
      "Relevant for people following Dr. M's EMF/RF discussions and wanting a product source to research.",
      "The current partner link and code are active through Airestech's partner program.",
    ],
    usedFor: [
      "Wearable EMF/RF exposure support",
      "Cell-phone exposure mitigation",
      "Bedroom and hotel-room protection",
      "Larger-room protection with the Zone Max",
    ],
    featuredProducts: ["Go", "Flex", "Zone", "Zone Max"],
    affiliateUrl: "https://airestech.com/davidmusnick",
    couponCode: "DRDMUSNICK",
    discountNote: "Use code DRDMUSNICK for at least 25% savings.",
    episodeSlugs: ["episode-4-emf"],
    autoLinkTopicSlugs: ["emf"],
    tags: ["emf", "rf", "wearable", "room-protection", "travel"],
    sortOrder: 10,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "David Musnick forwarded affiliate setup notes for Airestech.",
  },
  {
    slug: "block-blue-light",
    name: "Blue Light Blocking Glasses & Sleep Lighting",
    brand: "BlockBlueLight",
    categorySlug: "sleep-light-environment",
    category: "Sleep & Light Environment",
    summary:
      "Blue-light blocking glasses, sleep-friendly reading lights, and home lighting products for reducing artificial light exposure in the evening.",
    drmThoughts:
      "Dr. M likes this as a practical sleep-hygiene tool: glasses and lighting that make it easier to wind down without flooding the eyes with bright blue light before bed.",
    reasonsToLike: [
      "Useful for listeners working on insomnia, circadian rhythm, and evening screen or light exposure.",
      "Includes both wearable glasses and room-level lighting options, so people can address more than one source of nighttime light.",
      "The referral link applies the listener discount automatically.",
    ],
    usedFor: [
      "Evening screen use",
      "Reading before bed",
      "Sleep-supportive home lighting",
      "Circadian rhythm and insomnia routines",
    ],
    affiliateUrl: "https://www.blockbluelight.com/?ref=drmexperienced",
    discountNote: "Listener discount is applied through the affiliate link.",
    episodeSlugs: ["episode-3-insomnia", "episode-4-emf"],
    autoLinkTopicSlugs: ["sleep", "insomnia"],
    tags: ["sleep", "insomnia", "circadian-rhythm", "light-hygiene"],
    sortOrder: 20,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "Existing affiliate entry reviewed during affiliate catalog pass.",
  },
  {
    slug: "safe-living-technologies",
    name: "EMF Testing & Shielding Tools",
    brand: "Safe Living Technologies",
    categorySlug: "home-environment",
    category: "Home Environment",
    summary:
      "EMF meters, testing resources, and shielding products for people who want a more concrete look at their home or work environment.",
    drmThoughts:
      "Dr. M flagged Safe Living Technologies for EMF testing and shielding, especially for listeners who want to measure first and make practical changes based on what they find.",
    reasonsToLike: [
      "Focused on assessment tools as well as shielding products.",
      "Pairs well with a measured, room-by-room approach to reducing exposure instead of guessing.",
      "Useful for listeners following the EMF episode and wanting product sources to research.",
    ],
    usedFor: [
      "Home EMF testing",
      "Bedroom and workspace assessment",
      "Shielding product research",
      "Reducing avoidable environmental exposures",
    ],
    directUrl: "https://safelivingtechnologies.com/",
    couponCode: "DrMExperienced",
    episodeSlugs: ["episode-4-emf"],
    autoLinkTopicSlugs: ["emf"],
    tags: ["emf", "shielding", "testing", "home-environment"],
    sortOrder: 30,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "Existing EMF resource reviewed against current episode context.",
  },
  {
    slug: "desbio-dbscript",
    name: "Homeopathic and Drainage Product Access",
    brand: "DesBio / DBscript",
    categorySlug: "homeopathics-supplements",
    category: "Homeopathics & Supplements",
    summary:
      "A DBscript store for DesBio homeopathic and supplement products that Dr. M may reference for emotional support, drainage, detoxification, and functional-medicine conversations.",
    drmThoughts:
      "Dr. M describes DesBio as a leading source for homeopathic products used in areas such as anxiety, mood, motivation, drainage, detoxification, and chronic-infection protocols.",
    reasonsToLike: [
      "The direct DBscript link gives listeners one place to search for DesBio products Dr. M mentions.",
      "The line includes broadly relevant emotional-support, drainage, detox, and brain-support formulas.",
      "It can support future podcast follow-up without turning an episode page into a full treatment protocol.",
    ],
    usedFor: [
      "Emotional-support product research",
      "Drainage and detoxification conversations",
      "Brain and nervous-system support topics",
      "Clinician-guided chronic-infection protocol discussions",
    ],
    featuredProducts: [
      "Esteem",
      "Rage",
      "Anxious",
      "Motivation",
      "Grief",
      "Adrenal Support",
      "Allergy Rescue",
      "Appetite Control",
      "Celergesic",
      "Cerebromax",
      "Comprehensive Homeopathic Detox Kit",
      "Crave Control",
      "Dizzy",
      "Dynamic Brain",
      "Ear Ring",
      "Emotional Detox and Drainage",
      "GLP Support",
      "Headache",
      "HeadSSR",
      "Herx",
      "Leaky Gut Formula",
    ],
    directUrl: "https://dbscript.com/?direct=DrMEx",
    purchaseNote: "Open the DBscript link, then search for the product name.",
    cautionNote:
      "DesBio also makes products for chronic viral, bacterial, and tickborne-infection protocols. Dr. M does not recommend those generically; review them through a consult or your own clinician.",
    episodeSlugs: ["brain-fog-part-1", "brain-fog-part-2"],
    autoLinkTopicSlugs: ["brain-fog", "mood", "detox", "drainage", "chronic-infection"],
    tags: ["homeopathics", "desbio", "detox", "drainage", "brain-health"],
    sortOrder: 40,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "David Musnick forwarded DBscript setup and product-list notes.",
  },
  {
    slug: "best365labs",
    name: "Methylene Blue & Brain/Energy Supplements",
    brand: "Best365Labs",
    categorySlug: "supplements",
    category: "Supplements",
    summary:
      "A supplement source Dr. M noted for methylene blue and other brain and energy related products.",
    drmThoughts:
      "Dr. M pointed to Best365Labs in the context of brain and energy support. These products should be considered in a clinical context, especially for people with medications, complex conditions, or sensitivity to supplements.",
    reasonsToLike: [
      "Relevant to the brain fog and energy conversations already covered on the show.",
      "Gives listeners one named source to research when methylene blue or mitochondrial-support topics come up.",
      "Includes a public listener code for the Dr. M Experienced audience.",
    ],
    usedFor: [
      "Brain-support supplement research",
      "Energy and mitochondrial support conversations",
      "Brain fog protocol discussions with a clinician",
      "Functional medicine supplement planning",
    ],
    directUrl: "https://best365labs.com/",
    couponCode: "DrME",
    episodeSlugs: ["brain-fog-part-1", "brain-fog-part-2"],
    autoLinkTopicSlugs: ["brain-fog", "energy", "mitochondria"],
    tags: ["brain-health", "energy", "mitochondria", "supplements"],
    sortOrder: 50,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "Existing supplement resource reviewed during affiliate catalog pass.",
  },
  {
    slug: "doctors-supplement-store",
    name: "Dr. M Experienced Supplement Dispensary",
    brand: "Doctors Supplement Store",
    categorySlug: "supplements",
    category: "Supplements",
    summary:
      "A DSS supplement dispensary for the Dr. M Experienced audience, with thousands of high-quality practitioner-focused supplement products.",
    drmThoughts:
      "Dr. M flagged DSS as a way to give podcast listeners one place to research and purchase high-quality supplements connected to future show notes, webinars, and protocol discussions while keeping podcast activity organized.",
    reasonsToLike: [
      "Broad supplement catalog rather than a single-product line.",
      "Separate Dr. M Experienced dispensary URL keeps podcast-related supplement activity organized.",
      "Useful as a central destination when future episodes or webinars mention supplement categories.",
    ],
    usedFor: [
      "Practitioner-grade supplement research",
      "Podcast and webinar follow-up resources",
      "Brain, immune, orthopedic, and functional-medicine supplement categories",
      "Centralized supplement ordering for listeners",
    ],
    directUrl: "https://dssorders.com/DrMExperienced",
    purchaseNote: "This is the Dr. M Experienced dispensary URL.",
    episodeSlugs: ["episode-8-food-and-the-brain"],
    tags: ["supplements", "dispensary", "brain-health", "immune-support", "orthopedics"],
    sortOrder: 60,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "David Musnick forwarded DSS dispensary URL and catalog notes.",
  },
  {
    slug: "abeytu-naturals",
    name: "Blood & Red Cell Support Supplements",
    brand: "Abeytu Naturals",
    categorySlug: "supplements",
    category: "Supplements",
    summary:
      "A supplement company Dr. M highlighted for blood-health and red-cell function support.",
    drmThoughts:
      "Dr. M's note on Abeytu Naturals was centered on helping clean the blood and improve red-cell function. It may fit conversations about oxygen delivery and whole-body function, but listeners should review supplement choices with their own clinician.",
    reasonsToLike: [
      "Connects to the broader functional-medicine lens of oxygen delivery, circulation, and cellular function.",
      "The public discount link gives listeners a straightforward way to find the line Dr. M referenced.",
      "A useful category to discuss when red-cell function is part of a larger health plan.",
    ],
    usedFor: [
      "Blood-health supplement research",
      "Red-cell function conversations",
      "Oxygen-delivery and circulation support discussions",
      "Clinician-guided supplement planning",
    ],
    affiliateUrl: "https://abeytunaturals.com/discount/DRDAVID10",
    directUrl: "https://abeytunaturals.com/",
    couponCode: "DRDAVID10",
    discountNote: "Use code DRDAVID10 for 10% off.",
    autoLinkTopicSlugs: ["blood-health", "red-cell-function", "circulation"],
    tags: ["blood-health", "red-cell-function", "circulation", "supplements"],
    sortOrder: 70,
    dateAdded: "2026-06-17",
    lastReviewed: "2026-06-17",
    sourceNote: "David Musnick forwarded Abeytu discount and blood-health notes.",
  },
  {
    slug: "humann-turmeric-chews",
    name: "Turmeric Chews",
    brand: "HumanN",
    categorySlug: "supplements",
    category: "Supplements",
    summary:
      "The turmeric and curcumin chew Dr. M names in Episode 8 as one convenient way to include turmeric.",
    drmThoughts:
      "Dr. M mentions HumanN Turmeric Chews while discussing practical ways to include turmeric in a brain-focused food plan. This official product page is provided for listeners who want to research the exact item named in the episode.",
    reasonsToLike: [
      "Provides the exact branded turmeric chew named in Episode 8.",
      "The direct link goes to HumanN's official product page.",
      "A chew format gives listeners another option to compare with turmeric used as a spice or tea.",
    ],
    usedFor: [
      "Researching the turmeric chew mentioned in Episode 8",
      "Comparing turmeric and curcumin formats",
      "Following the episode's discussion of Nrf2-supportive foods",
    ],
    directUrl: "https://humann.com/products/turmeric-chews",
    purchaseNote: "Direct official product link; no Dr. M affiliate URL is currently recorded.",
    cautionNote:
      "Supplement choices are not one-size-fits-all and should be reviewed with an appropriate clinician when relevant.",
    episodeSlugs: ["episode-8-food-and-the-brain"],
    autoLinkTopicSlugs: ["nrf2"],
    tags: ["brain-health", "nutrition", "turmeric", "curcumin", "supplements"],
    sortOrder: 80,
    dateAdded: "2026-08-25",
    lastReviewed: "2026-08-25",
    sourceNote: "Named by Dr. M in Episode 8; official HumanN product page verified 2026-08-25.",
  },
  {
    slug: "fgo-turmeric-ginger-tea",
    name: "Turmeric Ginger Tea",
    brand: "FGO / From Great Origins",
    categorySlug: "food-and-nutrition",
    category: "Food & Nutrition",
    summary:
      "The turmeric, ginger, and cinnamon tea Dr. M names in Episode 8 as a food-and-beverage option for turmeric.",
    drmThoughts:
      "Dr. M mentions FGO Turmeric Ginger Tea as a practical alternative to using turmeric only as a spice or supplement. This official product page is provided for listeners who want to research the exact tea named in the episode.",
    reasonsToLike: [
      "Provides the exact branded turmeric tea named in Episode 8.",
      "The direct link goes to From Great Origins' official product page.",
      "A tea format gives listeners another way to compare turmeric options.",
    ],
    usedFor: [
      "Researching the turmeric tea mentioned in Episode 8",
      "Comparing food, beverage, and supplement forms of turmeric",
      "Following the episode's brain-health nutrition discussion",
    ],
    directUrl: "https://fromgreatorigins.com/products/turmeric-ginger-tea-bags",
    purchaseNote: "Direct official product link; no Dr. M affiliate URL is currently recorded.",
    cautionNote:
      "Food, beverage, and supplement choices should be individualized for allergies, medications, and other health considerations.",
    episodeSlugs: ["episode-8-food-and-the-brain"],
    autoLinkTopicSlugs: ["nrf2"],
    tags: ["brain-health", "nutrition", "turmeric", "ginger", "tea"],
    sortOrder: 90,
    dateAdded: "2026-08-25",
    lastReviewed: "2026-08-25",
    sourceNote:
      "Named by Dr. M in Episode 8; official From Great Origins product page verified 2026-08-25.",
  },
  {
    slug: "purity-coffee",
    name: "Organic Whole Bean Coffee",
    brand: "Purity Coffee",
    categorySlug: "food-and-nutrition",
    category: "Food & Nutrition",
    summary:
      "The organic whole-bean coffee brand Dr. M names in Episode 8 while discussing coffee, acrylamide, mold, and product testing.",
    drmThoughts:
      "Dr. M points listeners to Purity Coffee while explaining why he pays attention to how coffee is sourced and tested. The brand also publishes laboratory-testing information for listeners who want to review it.",
    reasonsToLike: [
      "Provides the exact coffee brand named in Episode 8.",
      "The direct link goes to Purity Coffee's official whole-bean collection.",
      "Purity publishes a separate laboratory-information page for listeners evaluating its testing claims.",
    ],
    usedFor: [
      "Researching the coffee brand mentioned in Episode 8",
      "Comparing organic whole-bean coffee options",
      "Reviewing a brand's published coffee-testing information",
    ],
    directUrl: "https://puritycoffee.com/collections/whole-bean-coffee",
    purchaseNote:
      "Direct official product-category link; no Dr. M affiliate URL is currently recorded. Purity's laboratory information is linked in the Episode 8 show notes.",
    cautionNote:
      "Coffee and caffeine tolerance vary; consider individual sleep, medication, pregnancy, and medical context.",
    episodeSlugs: ["episode-8-food-and-the-brain"],
    autoLinkTopicSlugs: ["nutrition"],
    tags: ["brain-health", "nutrition", "coffee", "organic", "food-quality"],
    sortOrder: 100,
    dateAdded: "2026-08-25",
    lastReviewed: "2026-08-25",
    sourceNote:
      "Named by Dr. M in Episode 8; official Purity Coffee product and laboratory-information pages verified 2026-08-25.",
  },
];

export function affiliateDisplayName(product: AffiliateProduct) {
  return product.brand ?? product.name;
}

export function affiliateBrandProfile(product: Pick<AffiliateProduct, "slug">) {
  return AFFILIATE_BRAND_PROFILES[product.slug];
}

export function affiliateCategoryForSlug(categorySlug: string) {
  return AFFILIATE_CATEGORIES.find((category) => category.slug === categorySlug);
}

export function affiliateCategoryLabel(categorySlug: string) {
  return affiliateCategoryForSlug(categorySlug)?.label ?? categorySlug;
}

export function normalizedTopicSlug(topic: string) {
  return topic.trim().toLowerCase();
}

export function productMatchesEpisode(
  product: AffiliateProduct,
  episode: Pick<Episode, "slug" | "topics">
) {
  if (product.episodeSlugs?.includes(episode.slug)) {
    return true;
  }

  const episodeTopics = new Set(episode.topics.map(normalizedTopicSlug));
  return product.autoLinkTopicSlugs?.some((topic) => episodeTopics.has(normalizedTopicSlug(topic))) ?? false;
}

export function affiliateProductsForEpisode(
  episode: Pick<Episode, "slug" | "topics">,
  products: AffiliateProduct[] = AFFILIATE_PRODUCTS
) {
  return products.filter((product) => productMatchesEpisode(product, episode)).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
}
