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
  if (httpMethodFor(tool) !== method) {
    const expected = httpMethodFor(tool).toUpperCase();
    return { error: NextResponse.json({ error: `${name} expects ${expected}` }, { status: 405 }) };
  }

  return { name };
}

async function run(name: string, args: unknown) {
  try {
    return NextResponse.json({ tool: name, result: await invokeAgentTool(name, args) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    const status = message.startsWith('Unknown tool') ? 404 : message.includes('required') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: Request, context: RouteContext) {
  const resolved = await resolve(request, context, 'get');
  if (resolved.error) return resolved.error;
  return run(resolved.name, {});
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
  return run(resolved.name, body);
}
