import type { NextConfig } from "next";

// Facultatif : si API_PROXY_TARGET est défini (ex. https://api.exemple.com), le frontend
// relaie /api/v1/* vers l'API. Avec NEXT_PUBLIC_API_URL=/api/v1, le cookie de session
// devient « first-party » : utile quand le frontend et l'API sont sur des domaines
// différents (Safari bloque les cookies tiers, même avec SameSite=None).
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  output: "standalone",
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return apiProxyTarget
      ? [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` }]
      : [];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
