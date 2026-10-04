import { NextResponse } from 'next/server';
import { httpMethodFor, mcpToolByName } from '@/lib/agent/registry';
import { invokeAgentTool } from '@/mcp/invoke';
import { gateFor } from '@/mcp/http';
import { scopeForTool } from '@/lib/oauth/tokens';

export const runtime = 'nodejs';

type RouteContext = { params: Promise<{ name: string }> };

async function resolve(request: Request, context: RouteContext, method: 'get' | 'post') {
  const auth = await gateFor(request)(request);
  if (auth instanceof Response) return { error: auth };

  const { name } = await context.params;
  const tool = mcpToolByName.get(name);
  if (!tool) return { error: NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 404 }) };

  const required = scopeForTool(tool);
  if (!auth.scopes.includes(required)) {
    return {
      error: NextResponse.json(
        { error: 'insufficient_scope', error_description: `${name} requires the ${required} scope` },
        { status: 403, headers: { 'WWW-Authenticate': `Bearer error="insufficient_scope", scope="${required}"` } }
      ),
    };
  }
  const expected = httpMethodFor(tool);
  if (expected !== method) {
    return { error: NextResponse.json({ error: `${name} expects ${expected.toUpperCase()}` }, { status: 405 }) };
  }

  return { name, clientId: auth.clientId };
}

async function run(name: string, args: unknown, clientId: string) {
  try {
    return NextResponse.json({ tool: name, result: await invokeAgentTool(name, args, clientId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    const status = error instanceof Error && 'status' in error && typeof error.status === 'number' ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request, context: RouteContext) {
  const resolved = await resolve(request, context, 'get');
  if (resolved.error) return resolved.error;
  return run(resolved.name, {}, resolved.clientId);
}

export async function POST(request: Request, context: RouteContext) {
  const resolved = await resolve(request, context, 'post');
  if (resolved.error) return resolved.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
  }
  return run(resolved.name, body, resolved.clientId);
}
