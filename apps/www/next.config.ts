import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    config.experiments = {
      layers: true,
      asyncWebAssembly: true,
      topLevelAwait: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        zod: false,
        "chart.js": false,
      };
    } else
      config.resolve.fallback = {
        ...config.resolve.fallback,
      };

    config.resolve.fallback = {
      ...config.resolve.fallback,
      ioredis: false,
      axios: false,
    };

    return config;
  },
};

const withNextIntl = createNextIntlPlugin();

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(withNextIntl(nextConfig));

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
