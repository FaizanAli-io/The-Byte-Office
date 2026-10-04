import { appOrigin } from '@/lib/finance-auth';
import { buildOpenApiDocument } from '@/mcp/openapi';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return Response.json(buildOpenApiDocument(appOrigin(request)), { headers: { 'Cache-Control': 'no-store' } });
}
