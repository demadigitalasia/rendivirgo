import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const productionSecurityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  {
    key: "Content-Security-Policy-Report-Only",
    value: [
      "default-src 'self'",
      "script-src 'self' https://www.googletagmanager.com",
      "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
      "img-src 'self' https://www.googletagmanager.com https://*.google-analytics.com",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel packages its own server output; standalone is for the Docker image.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    dangerouslyAllowLocalIP: true,
    // Optimizer output for /images/* sources only inherits the short upstream TTL
    // (max-age=0), so cold re-generation (~1s per variant) would otherwise recur
    // every 4h. 31 days per Next docs; replace fixed-name /images files via deploy.
    minimumCacheTTL: 2678400,
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
      {
        protocol: "https",
        hostname: "rendivirgo.com",
        pathname: "/uploads/**",
      },
    ],
  },
  async redirects() {
    // Product slug corrections (typo fixes): old indexed URLs must keep resolving.
    const slugRedirects = [
      ["orbicural-agate-cabochon", "orbicular-agate-cabochon"],
      ["orbicural-agate-cabochon-2", "orbicular-agate-cabochon-2"],
      ["orbicural-agate-cabochon-3", "orbicular-agate-cabochon-3"],
      ["orbicural-agate-cabochon-4", "orbicular-agate-cabochon-4"],
      ["orbicural-agate-cabochon-5", "orbicular-agate-cabochon-5"],
      ["orbicural-agate-cabochon-10", "orbicular-agate-cabochon-10"],
      ["orbicural-agate-cabochon-11", "orbicular-agate-cabochon-11"],
      ["orbicural-agate-cabochon-12", "orbicular-agate-cabochon-12"],
      ["orbicural-agate-cabochon-13", "orbicular-agate-cabochon-13"],
      ["orbicural-cabochon", "orbicular-jasper-cabochon"],
      ["orbicural-cabochon-2", "orbicular-jasper-cabochon-2"],
      ["orbicular-cabochon-1", "orbicular-jasper-cabochon-1"],
      ["bumbelbee-jasper-cabochon", "bumblebee-jasper-cabochon"],
      ["bumbelbee-jasper-cabochon-2", "bumblebee-jasper-cabochon-2"],
      ["bumbelbee-jasper-cabochons", "bumblebee-jasper-cabochons"],
    ].map(([from, to]) => ({
      source: `/shop/cabochons/${from}`,
      destination: `/shop/cabochons/${to}`,
      permanent: true,
    }));
    return [
      ...slugRedirects,
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.rendivirgo.com" }],
        destination: "https://rendivirgo.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        ...securityHeaders,
        ...(process.env.NODE_ENV === "production" ? productionSecurityHeaders : []),
      ],
    }];
  },
};

export default nextConfig;
