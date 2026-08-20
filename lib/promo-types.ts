export type PromoAnimation = "marquee" | "fade" | "slide" | "pulse";
export type PromoMediaKind = "none" | "image" | "video";

export type PromoBanner = {
  id: string;
  title: string;
  body: string;
  mediaUrl: string;
  mediaKind: PromoMediaKind;
  animation: PromoAnimation;
  ctaLabel: string;
  ctaHref: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};
