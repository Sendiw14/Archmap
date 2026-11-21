import path from "node:path";
import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
/** Set on real HTTPS deployments only: upgrading to https breaks plain-http localhost and CI. */
const httpsOnly = process.env.ARCHMAP_HTTPS_ONLY === "1";

/**
 * The browser only ever talks to its own origin: /v1 and /health are proxied to the API.
 * That keeps the SameSite=Strict management cookie and the API's Origin check working.
 * Rewrites are evaluated at build time for `next start`, so set ARCHMAP_API_URL when building.
 */
const API_URL = (process.env.ARCHMAP_API_URL ?? "http://localhost:4000").replace(/\/+$/, "");

/**
 * Content Security Policy. Next.js emits inline bootstrap scripts, so script-src needs
 * 'unsafe-inline' (nonces would force every page to render dynamically). Everything else is
 * locked to same origin: no third-party scripts, frames, forms or connections.
 * Dev additionally needs 'unsafe-eval' (React refresh) and a websocket (HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(httpsOnly ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(httpsOnly
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
    : []),
];

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Workspace packages export raw .ts source.
  transpilePackages: ["@archmap/graph-schema", "@archmap/graph-core", "@archmap/contracts"],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
  async rewrites() {
    return [
      { source: "/v1/:path*", destination: `${API_URL}/v1/:path*` },
      { source: "/health/:path*", destination: `${API_URL}/health/:path*` },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Temporary results must never be indexed, even if a crawler ignores the meta tag.
      {
        source: "/analyses/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default config;
