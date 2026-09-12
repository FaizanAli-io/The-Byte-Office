import { clearAgentMessages, getConversation, listAgentMessages, saveAgentMessage } from '@/lib/finance-agent/repository';
import type { FinanceChatMessage } from '@/lib/finance-agent/types';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const chatId = new URL(request.url).searchParams.get('chatId');
    if (!chatId || !(await getConversation(chatId))) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    return NextResponse.json({ messages: await listAgentMessages(chatId) });
  } catch (cause) {
    console.error('GET /api/finance-agent/messages error:', cause);
    return NextResponse.json({ error: 'Failed to load conversation' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { chatId?: unknown; message?: unknown };
    const chatId = typeof body.chatId === 'string' ? body.chatId : '';
    if (!chatId || !(await getConversation(chatId))) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    const message = parseMessage(body.message);
    await saveAgentMessage(chatId, message);
    return NextResponse.json({ message });
  } catch (cause) {
    console.error('POST /api/finance-agent/messages error:', cause);
    const status = cause instanceof MessageValidationError ? cause.status : 500;
    const message = cause instanceof Error ? cause.message : 'Failed to save message';
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: Request) {
  try {
    const chatId = new URL(request.url).searchParams.get('chatId');
    if (!chatId || !(await getConversation(chatId))) {
      return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }
    await clearAgentMessages(chatId);
    return NextResponse.json({ ok: true });
  } catch (cause) {
    console.error('DELETE /api/finance-agent/messages error:', cause);
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 });
  }
}

function parseMessage(value: unknown): FinanceChatMessage {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    !('role' in value) ||
    !('content' in value) ||
    !('createdAt' in value) ||
    typeof value.id !== 'string' ||
    (value.role !== 'user' && value.role !== 'assistant') ||
    typeof value.content !== 'string' ||
    typeof value.createdAt !== 'string'
  ) {
    throw new MessageValidationError('Invalid chat message');
  }
  return {
    id: value.id,
    role: value.role,
    content: value.content,
    createdAt: value.createdAt,
    actions: 'actions' in value && Array.isArray(value.actions) ? value.actions : undefined,
    isError: 'isError' in value && value.isError === true ? true : undefined,
  };
}

class MessageValidationError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
  }
}
