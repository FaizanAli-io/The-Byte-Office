import { metadataResponse, protectedResourceMetadata } from '@/lib/oauth/metadata';

export const runtime = 'nodejs';

/**
 * RFC 9728 places the document at the resource's path under the well-known
 * prefix, so this mirrors `/api/mcp`. The `WWW-Authenticate` challenge on a
 * 401 points here.
 */
export async function GET(request: Request) {
  return metadataResponse(protectedResourceMetadata(request));
}
