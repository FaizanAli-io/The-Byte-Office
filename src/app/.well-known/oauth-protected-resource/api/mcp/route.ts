import { metadataResponse, protectedResourceMetadata } from '@/lib/oauth/metadata';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return metadataResponse(protectedResourceMetadata(request));
}
