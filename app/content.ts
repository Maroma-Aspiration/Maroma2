export type HeroVideo = {
  src: string;
  /** Optional mobile hero (maroma.com uses a YouTube Short on phones). */
  mobileSrc?: string;
  poster: string;
  caption: string;
};

export type CarouselSlide = {
  id?: string;
  label: string;
  description: string;
  image: string;
  color: string;
};

export type Highlight = {
  title: string;
  detail: string;
};

export type SiteContent = {
  brand: string;
  nav: string[];
  hero: {
    eyebrow: string;
    headline: string;
    subhead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    video: HeroVideo;
    phrases: string[];
  };
  carousel: {
    title: string;
    subtitle: string;
    slides: CarouselSlide[];
  };
  highlights: Highlight[];
};

export const contentStorageKey = "maroma-admin-content";

export const siteContent: SiteContent = {
  brand: "Maroma",
  nav: [
    "Home",
    "Face Care",
    "Body Care",
    "Hair Care",
    "Baby",
    "Man",
    "Perfumes",
    "Home Care",
    "Colibri",
    "Gifting",
    "Offers"
  ],
  hero: {
    eyebrow: "Conscious luxury",
    headline: "Auroville-crafted ritual care",
    subhead: "",
    ctaPrimary: "Shop by Care",
    ctaSecondary: "Discover Rituals",
    video: {
      src: "https://www.youtube.com/watch?v=S_uYmuKyMRg",
      mobileSrc: "https://www.youtube.com/watch?v=tF9-sa_s-q0",
      poster: "https://img.youtube.com/vi/S_uYmuKyMRg/maxresdefault.jpg",
      caption: "Maroma hero (from maroma.com)"
    },
    phrases: []
  },
  carousel: {
    title: "Loved for a reason",
    subtitle: "See what people\nAre loving right now",
    slides: [
      {
        label: "Face Serum",
        description: "Nourishing botanical serum for smooth, radiant skin.",
        image: "/staging-media/wp-content/uploads/2025/12/auroville-maroma-body-care-saffron-serum-01.jpg",
        color: "#f2eee8"
      },
      {
        label: "Aromatherapy",
        description: "Mood-led aromatherapy spray designed to clear and uplift.",
        image: "/staging-media/wp-content/uploads/2025/08/auroville-maroma-body-care-aromatherapy-100-natural-clear-mind-body-spray-10ml-01.webp",
        color: "#f6f1ec"
      },
      {
        label: "Incense",
        description: "Clean-burning incense blends to ground your evening ritual.",
        image: "/staging-media/wp-content/uploads/2025/09/Cedarwood-Incense-01.webp",
        color: "#f4efe9"
      },
      {
        label: "Moringa Serum",
        description: "Anti-aging serum with cold-pressed moringa oil.",
        image: "/staging-media/wp-content/uploads/2025/12/AY16-B58_Moringa-Serum-01.jpg",
        color: "#eff3ef"
      },
      {
        label: "Face Sunscreen",
        description: "Natural SPF protection for delicate facial skin.",
        image: "/staging-media/wp-content/uploads/2025/12/Ultra-Wide-Spectrum-Face-Sunscreen-SPF-01.jpg",
        color: "#f2f2ef"
      }
    ]
  },
  highlights: [
    {
      title: "Vegan and cruelty-free",
      detail: "No synthetics, no palm oil. Ever."
    },
    {
      title: "Small batch",
      detail: "Hand-finished in Auroville."
    },
    {
      title: "Mood-led navigation",
      detail: "Shop by Calm, Focus, Uplift, Sensual, Ground."
    }
  ]
};
