import type { AuthInfo } from '@modelcontextprotocol/server';

export function getMcpApiKey() {
  return process.env.MCP_API_KEY;
}

export function verifyMcpRequest(request: Request): AuthInfo | undefined {
  const expected = getMcpApiKey();
  if (!expected) return undefined;

  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) return undefined;

  const token = header.slice('Bearer '.length).trim();
  if (!token || token !== expected) return undefined;

  return {
    token,
    clientId: 'mcp-client',
    scopes: ['finance:read', 'finance:write'],
  };
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: 'Unauthorized',
      message: 'Provide Authorization: Bearer <MCP_API_KEY>',
    },
    {
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="the-byte-office-mcp"',
      },
    }
  );
}
