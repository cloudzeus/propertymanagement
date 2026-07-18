import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: true },
  experimental: {
    // Media-library uploads (photos/videos) pass through proxy.ts; the default
    // body buffer is 10MB, which truncates larger files and breaks FormData parsing.
    proxyClientMaxBodySize: "100mb",
  },
};

export default withNextIntl(nextConfig);
