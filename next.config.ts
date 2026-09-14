import type { NextConfig } from "next";
import path from "path";

// Compatibility CSP, not a strict script policy: unsafe-inline permits inline
// scripts, so script-safe serialization remains essential for user-authored JSON-LD.
// Nonce-based scripts and removal of unsafe-eval require separate compatibility
// verification; this release preserves the existing policy without relaxing it.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self' https: data: blob:",
      // Script and style permissions are distinct. These legacy allowances are
      // not evidence that every listed allowance is required by a dependency.
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.supabase.co",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data:",
      // Phoenix WebSocket + Supabase Realtime + Renders' own wss endpoints
      "connect-src 'self' https: wss://*.onrender.com wss://*.supabase.co",
      "frame-src 'self' https://*.youtube.com https://*.vimeo.com",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  trailingSlash: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        source: "/:all*(svg|png|jpg|jpeg|gif|webp|ico|mp4|webm)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
