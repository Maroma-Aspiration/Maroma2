export type HomepagePlace = {
  id: string;
  name: string;
  description: string;
  images: string[];
};

export type HomepageVideo = {
  id: string;
  title: string;
  url: string;
};

export type HomepageTestimonial = {
  id: string;
  quote: string;
  attribution: string;
  source: "site" | "google";
};

export type HomepageContent = {
  aboutTitle: string;
  aboutBody: string;
  places: HomepagePlace[];
  videos: HomepageVideo[];
  testimonials: HomepageTestimonial[];
  updatedAt: string;
};

export const defaultHomepageContent = (): HomepageContent => ({
  aboutTitle: "About Maroma",
  aboutBody:
    "Maroma makes botanical care, natural perfume, incense, and home rituals in Auroville, India. Our work is vegan (with the exception of honey), cruelty-free, and rooted in the community that has crafted fragrance here for decades.",
  places: [
    {
      id: "cafe",
      name: "Café",
      description: "Visit the Maroma café in Auroville.",
      images: [],
    },
    {
      id: "outlet",
      name: "Outlet store",
      description: "Shop the full range at the Auroville outlet.",
      images: [],
    },
    {
      id: "spa",
      name: "Spa",
      description: "Book treatments at Maroma Spa.",
      images: [],
    },
  ],
  videos: [],
  testimonials: [],
  updatedAt: new Date().toISOString(),
});
