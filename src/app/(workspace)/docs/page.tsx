'use client';

import { useEffect } from 'react';
import { oauthApi } from '@/lib/api-client';

const SWAGGER_VERSION = '5.17.14';
const CLIENT_ID_KEY = 'tbo-docs-oauth-client-id';

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

function redirectUri() {
  return `${window.location.origin}/oauth2-redirect.html`;
}

async function ensureClientId() {
  const cached = window.localStorage.getItem(CLIENT_ID_KEY);
  if (cached) return cached;

  const { client_id: clientId } = await oauthApi.register({
    client_name: 'The Byte Office API docs',
    redirect_uris: [redirectUri()],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  });
  window.localStorage.setItem(CLIENT_ID_KEY, clientId);
  return clientId;
}

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
      onload: async () => {
        // @ts-expect-error SwaggerUIBundle is injected by the CDN script.
        const ui = window.SwaggerUIBundle({
          url: '/api/openapi',
          dom_id: '#swagger-ui',
          deepLinking: true,
          persistAuthorization: false,
          displayRequestDuration: true,
          tryItOutEnabled: true,
          oauth2RedirectUrl: redirectUri(),
        });

        try {
          ui.initOAuth({
            clientId: await ensureClientId(),
            scopes: 'finance:read personal:read tbo:read',
            usePkceWithAuthorizationCodeGrant: true,
          });
        } catch {}
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
          Swagger docs for the HTTP MCP endpoint and the tool REST wrappers. Click Authorize to approve access; tick a
          <code className="rounded bg-slate-100 px-1 py-0.5">:write</code> scope only when you intend to change data,
          because writes made here apply immediately.
        </p>
      </div>
      <div id="swagger-ui" className="px-2 py-4" />
    </div>
  );
}
