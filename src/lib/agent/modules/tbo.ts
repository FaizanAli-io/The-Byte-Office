import { company, faqs, processSteps, projects, services, whyChooseUs } from '@/app/data/site';
import { proposeTboInquiry } from '@/lib/agent/modules/tbo-actions';
import type { GroqTool } from '@/lib/finance-agent/tools';
import type { PendingAgentAction } from '@/lib/finance-agent/types';

export const tboTools: GroqTool[] = [
  {
    type: 'function',
    function: {
      name: 'tbo_info',
      description:
        'Get official The Byte Office information. Use this for services, work, process, FAQs, contact, or a general overview.',
      parameters: {
        type: 'object',
        properties: {
          topic: {
            type: 'string',
            enum: ['overview', 'services', 'projects', 'process', 'faqs', 'contact', 'all'],
          },
        },
        required: ['topic'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'tbo_send_inquiry',
      description:
        'Create a confirmation proposal to email The Byte Office with a visitor or user query. Never claim the email was sent until the user confirms.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          email: { type: 'string' },
          company: { type: 'string' },
          service: { type: 'string' },
          message: { type: 'string' },
        },
        required: ['name', 'email', 'message'],
        additionalProperties: false,
      },
    },
  },
];

export const tboToolNames = new Set(tboTools.map((tool) => tool.function.name));

export async function executeTboTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  if (name === 'tbo_info') {
    return { output: tboKnowledge(typeof args.topic === 'string' ? args.topic : 'overview') };
  }
  if (name === 'tbo_send_inquiry') {
    const pendingAction = await proposeTboInquiry(args);
    return {
      output: {
        status: 'pending_confirmation',
        action: pendingAction,
        instruction: 'Tell the user to review the confirmation card. Do not claim the email was sent.',
      },
      pendingAction,
    };
  }
  throw new Error(`Unknown TBO tool: ${name}`);
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
