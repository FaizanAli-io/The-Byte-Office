'use client';

import { useEffect } from 'react';

/**
 * Swagger UI for the MCP endpoint and the REST tool wrappers.
 *
 * This page sits behind the finance session (see the middleware matcher) and
 * is disallowed in robots.txt: it describes a private API and invites you to
 * paste `MCP_API_KEY`, which can write to the ledger.
 *
 * The assets are pinned to an exact version with subresource integrity rather
 * than floating on `@5`. A script loaded onto this origin runs in an
 * authenticated context, so a compromised or swapped CDN build could read the
 * key as it is typed.
 */
const SWAGGER_VERSION = '5.17.14';
const ASSETS = {
  css: {
    href: `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui.css`,
    integrity: 'sha384-wxLW6kwyHktdDGr6Pv1zgm/VGJh99lfUbzSn6HNHBENZlCN7W602k9VkGdxuFvPn',
  },
  script: {
    src: `https://unpkg.com/swagger-ui-dist@${SWAGGER_VERSION}/swagger-ui-bundle.js`,
    integrity: 'sha384-wmyclcVGX/WhUkdkATwhaK1X1JtiNrr2EoYJ+diV3vj4v6OC5yCeSu+yW13SYJep',
  },
};

export default function DocsPage() {
  useEffect(() => {
    const link = Object.assign(document.createElement('link'), {
      rel: 'stylesheet',
      href: ASSETS.css.href,
      integrity: ASSETS.css.integrity,
      crossOrigin: 'anonymous',
    });
    document.head.appendChild(link);

    const script = Object.assign(document.createElement('script'), {
      src: ASSETS.script.src,
      integrity: ASSETS.script.integrity,
      crossOrigin: 'anonymous',
      async: true,
      onload: () => {
        // @ts-expect-error SwaggerUIBundle is injected by the CDN script.
        window.SwaggerUIBundle({
          url: '/api/openapi',
          dom_id: '#swagger-ui',
          deepLinking: true,
          // Never keep the API key in localStorage; retype it per session.
          persistAuthorization: false,
          displayRequestDuration: true,
          tryItOutEnabled: true,
        });
      },
    });
    document.body.appendChild(script);

    return () => {
      link.remove();
      script.remove();
    };
  }, []);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-semibold">The Byte Office MCP API</h1>
        <p className="mt-1 text-sm text-slate-600">
          Swagger docs for the HTTP MCP endpoint and finance tool REST wrappers. Click Authorize and paste your{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">MCP_API_KEY</code> before trying protected calls. The key
          is not stored, so you will need to re-enter it after a reload.
        </p>
      </div>
      <div id="swagger-ui" className="px-2 py-4" />
    </div>
  );
}
