export type AffiliateProduct = {
  slug: string;
  name: string;
  brand?: string;
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
  tags?: string[];
};

export const AFFILIATE_DISCLOSURE =
  "Some product links may be affiliate links. If you purchase through those links, Dr. M's Experienced may earn a commission at no additional cost to you. Product mentions are educational and are not medical advice.";

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [
  {
    slug: "airestech",
    name: "EMF and RF Protection Devices",
    brand: "Airestech",
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
    tags: ["emf", "rf", "wearable", "room-protection", "travel"],
  },
  {
    slug: "block-blue-light",
    name: "Blue Light Blocking Glasses & Sleep Lighting",
    brand: "BlockBlueLight",
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
    tags: ["sleep", "insomnia", "circadian-rhythm", "light-hygiene"],
  },
  {
    slug: "safe-living-technologies",
    name: "EMF Testing & Shielding Tools",
    brand: "Safe Living Technologies",
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
    tags: ["emf", "shielding", "testing", "home-environment"],
  },
  {
    slug: "desbio-dbscript",
    name: "Homeopathic and Drainage Product Access",
    brand: "DesBio / DBscript",
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
    tags: ["homeopathics", "desbio", "detox", "drainage", "brain-health"],
  },
  {
    slug: "best365labs",
    name: "Methylene Blue & Brain/Energy Supplements",
    brand: "Best365Labs",
    category: "Supplements",
    summary:
      "A supplement source Dr. M noted for methylene blue and other brain and energy related products.",
    drmThoughts:
      "Dr. M pointed to Best365Labs in the context of brain and energy support. These products should be considered in a clinical context, especially for people with medications, complex conditions, or sensitivity to supplements.",
    reasonsToLike: [
      "Relevant to the brain fog and energy conversations already covered on the show.",
      "Gives listeners one named source to research when methylene blue or mitochondrial-support topics come up.",
      "Includes a public listener code for the Dr. M's Experienced audience.",
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
    tags: ["brain-health", "energy", "mitochondria", "supplements"],
  },
  {
    slug: "doctors-supplement-store",
    name: "Dr. M's Experienced Supplement Dispensary",
    brand: "Doctors Supplement Store",
    category: "Supplements",
    summary:
      "A DSS supplement dispensary for the Dr. M's Experienced audience, with thousands of high-quality practitioner-focused supplement products.",
    drmThoughts:
      "Dr. M flagged DSS as a way to give podcast listeners one place to research and purchase high-quality supplements connected to future show notes, webinars, and protocol discussions while keeping podcast activity organized.",
    reasonsToLike: [
      "Broad supplement catalog rather than a single-product line.",
      "Separate Dr. M's Experienced dispensary URL keeps podcast-related supplement activity organized.",
      "Useful as a central destination when future episodes or webinars mention supplement categories.",
    ],
    usedFor: [
      "Practitioner-grade supplement research",
      "Podcast and webinar follow-up resources",
      "Brain, immune, orthopedic, and functional-medicine supplement categories",
      "Centralized supplement ordering for listeners",
    ],
    directUrl: "https://dssorders.com/DrMExperienced",
    purchaseNote: "This is the Dr. M's Experienced dispensary URL.",
    tags: ["supplements", "dispensary", "brain-health", "immune-support", "orthopedics"],
  },
  {
    slug: "abeytu-naturals",
    name: "Blood & Red Cell Support Supplements",
    brand: "Abeytu Naturals",
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
    tags: ["blood-health", "red-cell-function", "circulation", "supplements"],
  },
];

export function affiliateDisplayName(product: AffiliateProduct) {
  return product.brand ?? product.name;
}

export function affiliateProductsForEpisode(episodeSlug: string) {
  return AFFILIATE_PRODUCTS.filter((product) => product.episodeSlugs?.includes(episodeSlug));
}
