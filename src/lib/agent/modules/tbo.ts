import { pendingResult } from '@/lib/agent/action-utils';
import { company, faqs, processSteps, projects, services, whyChooseUs } from '@/content/site';
import { proposeTboInquiry } from '@/lib/agent/modules/tbo-actions';
import { toolNamesForModule } from '@/lib/agent/registry';
import type { PendingAgentAction } from '@/lib/agent/types';

export const tboToolNames = toolNamesForModule('tbo');

export async function executeTboTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ output: unknown; pendingAction?: PendingAgentAction }> {
  if (name === 'tbo_info') {
    return { output: tboKnowledge(typeof args.topic === 'string' ? args.topic : 'overview') };
  }
  if (name === 'tbo_send_inquiry') {
    return pendingResult(
      await proposeTboInquiry(args),
      'Tell the user to review the confirmation card. Do not claim the email was sent.'
    );
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
