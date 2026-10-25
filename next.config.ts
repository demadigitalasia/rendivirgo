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
    value: "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Vercel packages its own server output; standalone is for the Docker image.
  output: process.env.VERCEL ? undefined : "standalone",
  images: {
    dangerouslyAllowLocalIP: true,
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
