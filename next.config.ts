import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * The CSP is permissive where Next.js leaves no choice and strict everywhere
 * else. Next inlines its bootstrap scripts and the SEO JSON-LD, so scripts
 * need 'unsafe-inline' (a nonce would mean rendering every page dynamically);
 * dev additionally needs 'unsafe-eval' for fast refresh. unpkg serves only the
 * SRI-pinned Swagger UI on /docs.
 *
 * `form-action` is deliberately absent: the OAuth consent form posts to us and
 * is then redirected to the client's own redirect URI, and Chrome applies
 * `form-action` to that redirect, which would break every MCP client sign-in.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://unpkg.com`,
  "style-src 'self' 'unsafe-inline' https://unpkg.com",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

/**
 * `distDir` is overridable so a verification build can be run while `next dev`
 * is serving the app. Both default to `.next`, and a production build clears
 * and rewrites it — which pulls the manifests out from under a running dev
 * server and leaves it throwing ENOENT for `_buildManifest.js` until it is
 * restarted. `npm run build:check` points somewhere else instead.
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
