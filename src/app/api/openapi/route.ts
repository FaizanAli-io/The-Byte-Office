import { buildOpenApiDocument } from '@/mcp/openapi';

export const runtime = 'nodejs';

function requestOrigin(request: Request) {
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (!host) return 'http://localhost:3000';
  const protocol = request.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  return `${protocol}://${host}`;
}

export async function GET(request: Request) {
  const spec = buildOpenApiDocument(requestOrigin(request));
  return Response.json(spec, {
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
