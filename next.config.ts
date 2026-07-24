import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Cloudflare Tunnel hosts to load Next.js client JS in development.
  // Without this, the tunnel page gets HTML but no JS → form falls back to GET
  // and auth appears to "bounce" back to /login.
  allowedDevOrigins: [
    "match-sbjct-measure-sue.trycloudflare.com",
    "*.trycloudflare.com",
  ],
};

export default nextConfig;
