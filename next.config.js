/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "firebasestorage.app", pathname: "/**" },
      { protocol: "https", hostname: "*.firebasestorage.app", pathname: "/**" },
      { protocol: "https", hostname: "storage.googleapis.com", pathname: "/**" },
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "public.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "*.blob.vercel-storage.com", pathname: "/**" },
      { protocol: "https", hostname: "maromashopping.com", pathname: "/**" },
      { protocol: "https", hostname: "www.maromashopping.com", pathname: "/**" },
      { protocol: "https", hostname: "*.vercel.app", pathname: "/**" },
    ],
  },
  async redirects() {
    return [
      { source: "/join-curations", destination: "/curations", permanent: false },
      { source: "/join-maroma-curations", destination: "/curations", permanent: false },
      { source: "/offers", destination: "/promo", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/staging-media/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/key-ingredients/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
      {
        source: "/newsletter/display/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

module.exports = nextConfig;
