'use client';

import { useEffect } from 'react';

export default function DocsPage() {
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
    script.async = true;
    script.onload = () => {
      // @ts-expect-error SwaggerUIBundle is injected by the CDN script.
      window.SwaggerUIBundle({
        url: '/api/openapi',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        displayRequestDuration: true,
        tryItOutEnabled: true,
      });
    };
    document.body.appendChild(script);

    return () => {
      link.remove();
      script.remove();
    };
  }, []);

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="border-b border-slate-200 px-6 py-4">
        <h1 className="text-2xl font-semibold">The Byte Office MCP API</h1>
        <p className="mt-1 text-sm text-slate-600">
          Swagger docs for the HTTP MCP endpoint and finance tool REST wrappers. Click Authorize and paste your{' '}
          <code className="rounded bg-slate-100 px-1 py-0.5">MCP_API_KEY</code> before trying protected calls.
        </p>
      </div>
      <div id="swagger-ui" className="px-2 py-4" />
    </main>
  );
}
