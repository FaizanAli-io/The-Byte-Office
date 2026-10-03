import { AgentActionError, toPublicAction } from '@/lib/agent/action-utils';
import { createAgentAction } from '@/lib/agent/repository';
import { parseInquiry, sendInquiryEmail } from '@/lib/inquiry-email';
import type { AgentActionPayload } from '@/lib/agent/types';

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
