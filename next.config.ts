import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [
      {
        // PWA service worker: ποτέ cached από browser/CDN, ώστε κάθε deploy να φτάνει στις συσκευές.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  experimental: {
    // Media-library uploads (photos/videos) pass through proxy.ts; the default
    // body buffer is 10MB, which truncates larger files and breaks FormData parsing.
    proxyClientMaxBodySize: "100mb",
  },
};

export default withNextIntl(nextConfig);
