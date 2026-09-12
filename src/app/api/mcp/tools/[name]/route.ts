import { NextResponse } from 'next/server';
import { financeToolByName } from '@/mcp/catalog';
import { invokeFinanceTool } from '@/mcp/invoke';
import { unauthorizedResponse, verifyMcpRequest } from '@/mcp/auth';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{ name: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const authInfo = verifyMcpRequest(request);
  if (!authInfo) return unauthorizedResponse();

  const { name } = await context.params;
  const tool = financeToolByName.get(name);
  if (!tool) {
    return NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 404 });
  }
  if (tool.method !== 'get') {
    return NextResponse.json({ error: `${name} expects POST with a JSON body` }, { status: 405 });
  }

  try {
    const result = await invokeFinanceTool(name, {});
    return NextResponse.json({ tool: name, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const authInfo = verifyMcpRequest(request);
  if (!authInfo) return unauthorizedResponse();

  const { name } = await context.params;
  const tool = financeToolByName.get(name);
  if (!tool) {
    return NextResponse.json({ error: `Unknown tool: ${name}` }, { status: 404 });
  }

  let body: unknown = {};
  if (tool.method === 'post') {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be valid JSON' }, { status: 400 });
    }
  }

  try {
    const result = await invokeFinanceTool(name, body);
    return NextResponse.json({ tool: name, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed';
    const status = message.startsWith('Unknown tool') ? 404 : message.includes('required') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
