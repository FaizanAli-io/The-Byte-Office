import type { NextConfig } from 'next';

/**
 * `distDir` is overridable so a verification build can be run while `next dev`
 * is serving the app. Both default to `.next`, and a production build clears
 * and rewrites it — which pulls the manifests out from under a running dev
 * server and leaves it throwing ENOENT for `_buildManifest.js` until it is
 * restarted. `npm run build:check` points somewhere else instead.
 */
const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
