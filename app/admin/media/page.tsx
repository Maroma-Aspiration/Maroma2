import MediaGalleryClient from "./media-gallery-client";
import "./media-gallery.css";

export const metadata = {
  title: "Media gallery | Maroma admin",
};

export default function AdminMediaPage() {
  return <MediaGalleryClient />;
}
