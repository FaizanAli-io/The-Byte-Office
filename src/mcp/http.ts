import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
} from '@modelcontextprotocol/server';
import { mcpResourceUrl } from '@/lib/oauth/metadata';
import { accessTokenVerifier } from './auth';
import { createMcpServer } from './server';

const handler = createMcpHandler((ctx) => createMcpServer(ctx.authInfo?.scopes ?? []), {
  legacy: 'stateless',
  responseMode: 'json',
});

export async function handleMcpRequest(request: Request) {
  const auth = await gateFor(request)(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}

export function gateFor(request: Request) {
  const resource = mcpResourceUrl(request);
  return requireBearerAuth({
    verifier: accessTokenVerifier(resource),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(resource)),
  });
}
