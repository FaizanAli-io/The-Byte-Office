import {
  createMcpHandler,
  getOAuthProtectedResourceMetadataUrl,
  requireBearerAuth,
} from '@modelcontextprotocol/server';
import { mcpResourceUrl } from '@/lib/oauth/metadata';
import { accessTokenVerifier } from './auth';
import { createMcpServer } from './server';

/**
 * The server is built per request from the token's scopes, so a read-only
 * client never sees a write tool in `tools/list` rather than being refused
 * when it calls one.
 */
const handler = createMcpHandler((ctx) => createMcpServer(ctx.authInfo?.scopes ?? []), {
  legacy: 'stateless',
  responseMode: 'json',
});

export async function handleMcpRequest(request: Request) {
  const auth = await gateFor(request)(request);
  if (auth instanceof Response) return auth;
  return handler.fetch(request, { authInfo: auth });
}

/**
 * A 401 from here carries `WWW-Authenticate` with the metadata URL, which is
 * the whole bootstrap: it is how an unauthenticated client discovers where to
 * authorize.
 */
export function gateFor(request: Request) {
  const resource = mcpResourceUrl(request);
  // No scope is required to connect: every token carries at least one read
  // scope, and which tools exist is decided per tool when the server is built.
  return requireBearerAuth({
    verifier: accessTokenVerifier(resource),
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(new URL(resource)),
  });
}
