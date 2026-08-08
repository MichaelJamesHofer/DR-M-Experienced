export type AnalyticsEventProperties = {
  "affiliate product clicked": {
    brand_slug: string;
    placement: string;
    product_slug: string;
  };
  "contact form submitted": {
    subject: "business" | "other" | "podcast" | "press";
  };
  "content filter applied": {
    content_type: "affiliate" | "blog" | "episode";
    facet_count: number;
  };
  "content search used": {
    content_type: "affiliate" | "blog" | "episode";
    has_results: boolean;
  };
  "episode opened": {
    episode_slug: string;
    placement: string;
  };
  "episode player opened": {
    video_id: string;
  };
  "media item opened": {
    media_type: string;
    platform: string;
  };
  "newsletter subscribed": {
    placement: "footer" | "hero" | "inline";
  };
  "platform outbound clicked": {
    placement: string;
    platform: string;
  };
};

export type AnalyticsEventName = keyof AnalyticsEventProperties;

export type CaptureAnalyticsEvent = <EventName extends AnalyticsEventName>(
  eventName: EventName,
  properties: AnalyticsEventProperties[EventName],
) => void;
