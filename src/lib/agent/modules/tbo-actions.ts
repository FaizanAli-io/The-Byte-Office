import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { createAgentAction } from '@/lib/finance-agent/repository';
import { sendInquiryEmail } from '@/lib/inquiry-email';
import { isRecord, validName } from '@/lib/finance-validation';
import type { AgentActionPayload } from '@/lib/finance-agent/types';

export async function proposeTboInquiry(rawArgs: unknown) {
  const inquiry = parseInquiry(rawArgs);
  return toPublicAction(
    await createAgentAction({
      actionType: 'tbo_send_inquiry',
      payload: { actionType: 'tbo_send_inquiry', ...inquiry },
      preview: {
        title: 'Send inquiry email to The Byte Office',
        after: inquiry,
      },
    })
  );
}

export async function executeTboInquiry(payload: Extract<AgentActionPayload, { actionType: 'tbo_send_inquiry' }>) {
  const sent = await sendInquiryEmail(payload);
  if (!sent) {
    throw new AgentActionError('Email is not configured, so the inquiry could not be sent.', 503);
  }
  return { sent: true };
}

function parseInquiry(value: unknown) {
  if (!isRecord(value)) throw new AgentActionError('Invalid inquiry');
  if (!validName(value.name)) throw new AgentActionError('A name is required');
  if (typeof value.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email)) {
    throw new AgentActionError('A valid email is required');
  }
  if (!validName(value.message)) throw new AgentActionError('A message is required');
  return {
    name: value.name.trim(),
    email: value.email.trim(),
    company: typeof value.company === 'string' && value.company.trim() ? value.company.trim() : undefined,
    service: typeof value.service === 'string' && value.service.trim() ? value.service.trim() : undefined,
    message: value.message.trim(),
  };
}
