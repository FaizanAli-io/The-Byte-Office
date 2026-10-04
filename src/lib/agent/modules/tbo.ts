import { ApiError } from '@/lib/api';
import { company, faqs, processSteps, projects, services, whyChooseUs } from '@/content/site';
import { parseInquiry, sendInquiryEmail } from '@/lib/inquiry-email';
import type { AgentActionPayload, AgentProposal } from '@/lib/agent/types';

export async function readTboTool(name: string, args: Record<string, unknown>) {
  if (name === 'tbo_info') return tboKnowledge(args.topic as string);
  throw new Error(`Unknown TBO tool: ${name}`);
}

export async function proposeTboInquiry(args: Record<string, unknown>): Promise<AgentProposal> {
  const inquiry = parseInquiry(args);
  return {
    actionType: 'tbo_send_inquiry',
    payload: { actionType: 'tbo_send_inquiry', ...inquiry },
    preview: { title: 'Send inquiry email to The Byte Office', after: inquiry },
  };
}

export async function executeTboInquiry(payload: Extract<AgentActionPayload, { actionType: 'tbo_send_inquiry' }>) {
  if (!(await sendInquiryEmail(payload))) {
    throw new ApiError('Email is not configured, so the inquiry could not be sent.', 503);
  }
  return { sent: true };
}

function tboKnowledge(topic: string) {
  const overview = {
    name: company.name,
    summary: company.summary,
    email: company.email,
    workingHours: company.workingHours,
    responseTime: company.responseTime,
    whyChooseUs,
  };

  switch (topic) {
    case 'services':
      return { services };
    case 'projects':
      return { projects };
    case 'process':
      return { process: processSteps };
    case 'faqs':
      return { faqs };
    case 'contact':
      return {
        email: company.email,
        workingHours: company.workingHours,
        responseTime: company.responseTime,
      };
    case 'all':
      return { ...overview, services, projects, process: processSteps, faqs };
    default:
      return overview;
  }
}
