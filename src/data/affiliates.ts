export type AffiliateProduct = {
  slug: string;
  name: string;
  brand?: string;
  category: string;
  summary: string;
  drmThoughts: string;
  reasonsToLike: string[];
  usedFor: string[];
  affiliateUrl?: string;
  directUrl?: string;
  imageUrl?: string;
  couponCode?: string;
  episodeSlugs?: string[];
  tags?: string[];
};

export const AFFILIATE_DISCLOSURE =
  "Some product links may be affiliate links. If you purchase through those links, Dr. M's Experienced may earn a commission at no additional cost to you. Product mentions are educational and are not medical advice.";

export const AFFILIATE_PRODUCTS: AffiliateProduct[] = [];
