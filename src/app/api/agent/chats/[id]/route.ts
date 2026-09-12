import { deleteConversation, getConversation, renameConversation } from '@/lib/finance-agent/repository';
import { NextResponse } from 'next/server';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const chat = await getConversation(id);
    return chat ? NextResponse.json({ chat }) : NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  } catch (cause) {
    console.error('GET /api/agent/chats/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to load chat' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = (await request.json()) as { title?: unknown };
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    const chat = await renameConversation(id, body.title.trim().slice(0, 80));
    return chat ? NextResponse.json({ chat }) : NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  } catch (cause) {
    console.error('PATCH /api/agent/chats/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to rename chat' }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const deleted = await deleteConversation(id);
    return deleted
      ? NextResponse.json({ success: true })
      : NextResponse.json({ error: 'Chat not found' }, { status: 404 });
  } catch (cause) {
    console.error('DELETE /api/agent/chats/[id] error:', cause);
    return NextResponse.json({ error: 'Failed to delete chat' }, { status: 500 });
  }
}
