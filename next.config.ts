import type { NextConfig } from "next";
import path from "path";

// 2026-08-13: Added a Content-Security-Policy (CSP). QuizWorld hosts user-generated
// quizzes, and a strict CSP is a meaningful defense-in-depth against stored XSS.
// The policy is intentionally permissive where it has to be (frame-src same origin,
// script-src 'self' 'unsafe-inline' because Next.js inlines styles for hydration).
// nonce-based strict CSP would be ideal but requires per-request nonces in middleware.
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self' https: data: blob:",
      // 'unsafe-inline' is required for Next.js hydration styles; we should
      // migrate to nonces eventually. Many Supabase flows need 'unsafe-eval'
      // (their JS SDK uses new Function in places) — keep it for now.
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
