export type SiteMediaItem = {
  id: string;
  url: string;
  filename: string;
  label?: string;
  alt?: string;
  tags?: string[];
  uploadedAt: string;
};

export type SiteMediaGalleryStore = {
  items: SiteMediaItem[];
};
