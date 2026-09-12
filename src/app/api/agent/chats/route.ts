import { createConversation, listConversations } from '@/lib/finance-agent/repository';
import { parseAgentWorkspace } from '@/lib/finance-agent/types';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const raw = new URL(request.url).searchParams.get('workspace');
    const workspace = raw === 'finance' || raw === 'personal' ? raw : undefined;
    return NextResponse.json({ chats: await listConversations(workspace) });
  } catch (cause) {
    console.error('GET /api/agent/chats error:', cause);
    return NextResponse.json({ error: 'Failed to load chats' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: unknown; workspace?: unknown };
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'New chat';
    const workspace = parseAgentWorkspace(body.workspace);
    return NextResponse.json({ chat: await createConversation(title, workspace) }, { status: 201 });
  } catch (cause) {
    console.error('POST /api/agent/chats error:', cause);
    return NextResponse.json({ error: 'Failed to create chat' }, { status: 500 });
  }
}
