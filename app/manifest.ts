import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Maroma Production",
    short_name: "Production",
    description: "Maroma order fulfillment board for prepare, pack, and ship.",
    start_url: "/admin/orders",
    scope: "/admin/",
    display: "standalone",
    orientation: "any",
    background_color: "#0f1412",
    theme_color: "#1f4f46",
    icons: [
      {
        src: "/icons/production-icon-192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/production-icon-512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
