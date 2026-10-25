import { NextResponse } from 'next/server';
import { httpMethodFor, mcpToolByName } from '@/lib/agent/registry';
import { ApiError, apiRoute, jsonBody } from '@/lib/api';
import { invokeAgentTool } from '@/mcp/invoke';
import { gateFor } from '@/mcp/http';
import { scopeForTool } from '@/lib/oauth/tokens';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ name: string }> };

async function call(request: Request, context: RouteContext, method: 'get' | 'post') {
  const auth = await gateFor(request)(request);
  if (auth instanceof Response) return auth;

  const { name } = await context.params;
  const tool = mcpToolByName.get(name);
  if (!tool) throw new ApiError(`Unknown tool: ${name}`, 404);

  const required = scopeForTool(tool);
  if (!auth.scopes.includes(required)) {
    return NextResponse.json(
      { error: 'insufficient_scope', error_description: `${name} requires the ${required} scope` },
      { status: 403, headers: { 'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${required}"` } }
    );
  }
  const expected = httpMethodFor(tool);
  if (expected !== method) throw new ApiError(`${name} expects ${expected.toUpperCase()}`, 405);

  const args = method === 'get' ? {} : await jsonBody<unknown>(request);
  return { tool: name, result: await invokeAgentTool(name, args, auth.clientId) };
}

export const GET = apiRoute('GET /api/mcp/tools/[name]', 'Tool execution failed', (req: Request, ctx: RouteContext) =>
  call(req, ctx, 'get')
);

export const POST = apiRoute('POST /api/mcp/tools/[name]', 'Tool execution failed', (req: Request, ctx: RouteContext) =>
  call(req, ctx, 'post')
);
